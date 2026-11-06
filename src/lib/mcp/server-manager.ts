import {
  ServerConfig,
  ServerManifest,
  ServerStatus,
  AllServersUnavailableError,
  ToolInvocationError,
  ServerConnectionError,
} from '@/lib/router/types';
import { MCPClient } from './client';
import { loadMCPConfig } from './config-loader';

interface ManagedServerEntry {
  config: ServerConfig;
  client: MCPClient | null;
  status: ServerStatus;
  manifest: ServerManifest;
}

export type ClientFactory = (config: ServerConfig) => MCPClient;

/**
 * Orchestrates multi-server MCP connections, health checks, schema caching,
 * and tool dispatch.
 */
export class MCPServerManager {
  private static instance: MCPServerManager | null = null;
  private readonly servers = new Map<string, ManagedServerEntry>();
  private healthCheckTimer: NodeJS.Timeout | null = null;
  private isShuttingDown = false;
  private clientFactory: ClientFactory;
  private exitHandler: (() => void) | null = null;

  constructor(clientFactory: ClientFactory = (cfg) => new MCPClient(cfg)) {
    this.clientFactory = clientFactory;
    this.setupGracefulShutdown();
  }

  /**
   * Singleton instance accessor.
   */
  public static getInstance(clientFactory?: ClientFactory): MCPServerManager {
    if (!MCPServerManager.instance) {
      MCPServerManager.instance = new MCPServerManager(clientFactory);
    }
    return MCPServerManager.instance;
  }

  /**
   * Reset the singleton instance (primarily for testing).
   */
  public static async resetInstance(): Promise<void> {
    if (MCPServerManager.instance) {
      await MCPServerManager.instance.shutdown();
      MCPServerManager.instance = null;
    }
  }

  /**
   * Register an MCP server configuration into the pool.
   */
  public registerServer(config: ServerConfig): void {
    if (this.servers.has(config.id)) {
      // Unregister prior entry if exists
      this.unregisterServer(config.id).catch(() => {});
    }

    const manifest: ServerManifest = {
      id: config.id,
      name: config.name,
      transport: config.transport,
      tools: [],
      status: 'disconnected',
    };

    this.servers.set(config.id, {
      config,
      client: null,
      status: 'disconnected',
      manifest,
    });
  }

  /**
   * Unregister an MCP server and disconnect its client process.
   */
  public async unregisterServer(serverID: string): Promise<void> {
    const entry = this.servers.get(serverID);
    if (!entry) {
      return;
    }

    if (entry.client) {
      await entry.client.disconnect().catch(() => {});
    }

    this.servers.delete(serverID);
  }

  /**
   * Connect a single server with 3 retry attempts and exponential backoff.
   */
  public async connectServer(
    serverID: string,
    options: { maxRetries?: number; initialDelayMs?: number } = {}
  ): Promise<void> {
    const entry = this.servers.get(serverID);
    if (!entry) {
      throw new ServerConnectionError(serverID, new Error(`Server '${serverID}' is not registered`));
    }

    if (entry.config.disabled) {
      entry.status = 'disconnected';
      entry.manifest.status = 'disconnected';
      return;
    }

    const maxRetries = options.maxRetries ?? 3;
    const initialDelayMs = options.initialDelayMs ?? 100;

    entry.status = 'starting';
    entry.manifest.status = 'starting';

    let lastError: unknown = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        if (!entry.client) {
          entry.client = this.clientFactory(entry.config);
        }

        await entry.client.connect();
        const tools = await entry.client.listTools();

        entry.status = 'connected';
        entry.manifest.status = 'connected';
        entry.manifest.tools = tools;
        return;
      } catch (err) {
        lastError = err;
        if (entry.client) {
          await entry.client.disconnect().catch(() => {});
          entry.client = null;
        }

        if (attempt < maxRetries) {
          const delay = initialDelayMs * Math.pow(2, attempt - 1);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    // All retries failed
    entry.status = 'error';
    entry.manifest.status = 'error';
    console.error(`[MCPServerManager] Failed to connect to server '${serverID}' after ${maxRetries} attempts:`, lastError);
    throw new ServerConnectionError(serverID, lastError);
  }

  /**
   * Connect all registered and non-disabled servers in parallel.
   * Throws AllServersUnavailableError if all target servers fail.
   */
  public async connectAll(options: { maxRetries?: number; initialDelayMs?: number } = {}): Promise<void> {
    const targetEntries = Array.from(this.servers.values()).filter((e) => !e.config.disabled);

    if (targetEntries.length === 0) {
      return;
    }

    const results = await Promise.allSettled(
      targetEntries.map((entry) => this.connectServer(entry.config.id, options))
    );

    const connectedCount = targetEntries.filter((e) => e.status === 'connected').length;

    if (connectedCount === 0) {
      const failedIDs = targetEntries.map((e) => e.config.id);
      throw new AllServersUnavailableError(failedIDs);
    }
  }

  /**
   * Dispatch a tool invocation to the specified server.
   */
  public async invokeToolCall(
    serverID: string,
    toolName: string,
    args: Record<string, unknown> = {}
  ): Promise<unknown> {
    const entry = this.servers.get(serverID);
    if (!entry) {
      throw new ToolInvocationError(
        serverID,
        toolName,
        new Error(`Server '${serverID}' is not registered`)
      );
    }

    if (entry.status !== 'connected' || !entry.client) {
      throw new ToolInvocationError(
        serverID,
        toolName,
        new Error(`Server '${serverID}' is unavailable (current status: '${entry.status}')`)
      );
    }

    return entry.client.callTool(toolName, args);
  }

  /**
   * Get current status of a server.
   */
  public getServerStatus(serverID: string): ServerStatus {
    const entry = this.servers.get(serverID);
    return entry ? entry.status : 'disconnected';
  }

  /**
   * Get all registered server manifests with their cached tool schemas.
   */
  public getServerManifests(): ServerManifest[] {
    return Array.from(this.servers.values()).map((entry) => ({
      ...entry.manifest,
      tools: [...entry.manifest.tools],
    }));
  }

  /**
   * Load server configurations from file and register all of them into the pool.
   */
  public loadAndRegisterConfig(configPath: string): ServerConfig[] {
    const configs = loadMCPConfig(configPath);
    for (const config of configs) {
      this.registerServer(config);
    }
    return configs;
  }

  /**
   * Start health check loop that pings connected servers periodically.
   */
  public startHealthCheck(intervalMs = 30000): void {
    this.stopHealthCheck();

    this.healthCheckTimer = setInterval(async () => {
      await this.runHealthCheckRound();
    }, intervalMs);

    this.healthCheckTimer.unref();
  }

  /**
   * Stop the recurring health check loop.
   */
  public stopHealthCheck(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }
  }

  /**
   * Execute a single health check sweep over all servers.
   */
  public async runHealthCheckRound(): Promise<void> {
    for (const [serverID, entry] of this.servers.entries()) {
      if (entry.config.disabled) {
        continue;
      }

      if (entry.status === 'connected' && entry.client) {
        try {
          await entry.client.ping();
        } catch (err) {
          console.warn(`[MCPServerManager] Health check ping failed for server '${serverID}':`, err);
          entry.status = 'error';
          entry.manifest.status = 'error';
          if (entry.client) {
            await entry.client.disconnect().catch(() => {});
            entry.client = null;
          }
          // Schedule background reconnection attempt after a short delay
          setTimeout(() => {
            if (this.servers.has(serverID) && !this.isShuttingDown) {
              this.connectServer(serverID, { maxRetries: 1, initialDelayMs: 200 }).catch(() => {});
            }
          }, 1000).unref();
        }
      } else if (entry.status === 'error' || entry.status === 'disconnected') {
        // Attempt background reconnection
        setTimeout(() => {
          if (this.servers.has(serverID) && !this.isShuttingDown) {
            this.connectServer(serverID, { maxRetries: 1, initialDelayMs: 200 }).catch(() => {});
          }
        }, 1000).unref();
      }
    }
  }

  /**
   * Gracefully terminate all active server connections and clear timers.
   */
  public async shutdown(): Promise<void> {
    if (this.isShuttingDown) {
      return;
    }
    this.isShuttingDown = true;

    this.stopHealthCheck();

    const disconnectPromises = Array.from(this.servers.values()).map(async (entry) => {
      if (entry.client) {
        await entry.client.disconnect().catch(() => {});
        entry.client = null;
      }
      entry.status = 'disconnected';
      entry.manifest.status = 'disconnected';
    });

    await Promise.all(disconnectPromises);
    this.servers.clear();
    this.cleanupGracefulShutdown();
    this.isShuttingDown = false;
  }

  private setupGracefulShutdown(): void {
    if (typeof process !== 'undefined' && !this.exitHandler) {
      this.exitHandler = () => {
        this.shutdown().catch(() => {});
      };
      process.once('beforeExit', this.exitHandler);
    }
  }

  private cleanupGracefulShutdown(): void {
    if (typeof process !== 'undefined' && this.exitHandler) {
      process.removeListener('beforeExit', this.exitHandler);
      this.exitHandler = null;
    }
  }
}

export { loadMCPConfig } from './config-loader';
