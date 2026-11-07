import {
  ServerConfig,
  ServerManifest,
  ServerStatus,
  ToolSchema,
  AllServersUnavailableError,
  ToolInvocationError,
  ServerConnectionError,
} from '@/lib/router/types';
import { MCPClient } from './client';
import { loadMCPConfig } from './config-loader';
import { detectEnvironment, isVercel, RuntimeEnvironment } from '@/lib/deployment/env';
import { InProcessMCPAdapter } from './in-process-adapter';
import { NotesAdapter } from '@/mcp-servers/notes/adapter';
import { TasksAdapter } from '@/mcp-servers/tasks/adapter';
import { CalculatorAdapter } from '@/mcp-servers/calculator/adapter';

export type ConnectionType = 'stdio' | 'in-process';

interface ManagedServerEntry {
  config: ServerConfig;
  client: MCPClient | null;
  adapter?: InProcessMCPAdapter;
  connectionType: ConnectionType;
  status: ServerStatus;
  manifest: ServerManifest;
  lastStatusChangeAt?: number;
  lastError?: string;
}

export type ClientFactory = (config: ServerConfig) => MCPClient;

/**
 * Orchestrates multi-server MCP connections, health checks, schema caching,
 * and tool dispatch across dual modes (Local stdio subprocesses vs Vercel in-process adapters).
 */
export class MCPServerManager {
  private static instance: MCPServerManager | null = null;
  private readonly servers = new Map<string, ManagedServerEntry>();
  private healthCheckTimer: NodeJS.Timeout | null = null;
  private isShuttingDown = false;
  private clientFactory: ClientFactory;
  private exitHandler: (() => void) | null = null;
  private runtimeEnv: RuntimeEnvironment;

  constructor(clientFactory: ClientFactory = (cfg) => new MCPClient(cfg)) {
    this.clientFactory = clientFactory;
    this.runtimeEnv = detectEnvironment();
    console.log(`[MCPServerManager] Runtime: ${this.runtimeEnv}`);
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
   * Helper to atomically transition server status, record timestamp of status change,
   * and update or clear lastError.
   */
  private updateServerStatus(entry: ManagedServerEntry, newStatus: ServerStatus, error?: unknown): void {
    const statusChanged = entry.status !== newStatus;
    if (statusChanged) {
      entry.status = newStatus;
      entry.manifest.status = newStatus;
      const now = Date.now();
      entry.lastStatusChangeAt = now;
      entry.manifest.lastStatusChangeAt = now;
    }

    if (error !== undefined) {
      const errMsg = error instanceof Error ? error.message : String(error);
      entry.lastError = errMsg;
      entry.manifest.lastError = errMsg;
    } else if (newStatus === 'connected') {
      entry.lastError = undefined;
      entry.manifest.lastError = undefined;
    }
  }

  /**
   * Register an MCP server configuration into the pool.
   */
  public registerServer(config: ServerConfig): void {
    if (this.servers.has(config.id)) {
      this.unregisterServer(config.id).catch(() => {});
    }

    const now = Date.now();
    const manifest: ServerManifest = {
      id: config.id,
      name: config.name,
      transport: config.transport,
      tools: [],
      status: 'disconnected',
      lastStatusChangeAt: now,
    };

    this.servers.set(config.id, {
      config,
      client: null,
      connectionType: config.transport === 'in-process' ? 'in-process' : 'stdio',
      status: 'disconnected',
      manifest,
      lastStatusChangeAt: now,
    });
  }

  /**
   * Unregister an MCP server and disconnect its client process or dispose adapter.
   */
  public async unregisterServer(serverID: string): Promise<void> {
    const entry = this.servers.get(serverID);
    if (!entry) {
      return;
    }

    if (entry.adapter) {
      entry.adapter.dispose();
      entry.adapter = undefined;
    }

    if (entry.client) {
      await entry.client.disconnect().catch(() => {});
      entry.client = null;
    }

    this.servers.delete(serverID);
  }

  /**
   * Load in-process adapters for all demo servers (notes, tasks, calculator) in Vercel mode.
   * Execution completes in <100ms with zero subprocess spawning.
   */
  public async loadInProcessAdapters(customAdapters?: InProcessMCPAdapter[]): Promise<void> {
    const startTime = Date.now();
    const adapters: InProcessMCPAdapter[] = customAdapters ?? [
      new NotesAdapter(),
      new TasksAdapter(),
      new CalculatorAdapter(),
    ];

    for (const adapter of adapters) {
      try {
        const tools = adapter.listTools();
        const now = Date.now();
        const manifest: ServerManifest = {
          id: adapter.serverID,
          name: adapter.name,
          transport: 'in-process',
          tools: tools.map((t) => ({
            name: t.name,
            description: t.description,
            inputSchema: t.inputSchema,
          })),
          status: 'connected',
          lastStatusChangeAt: now,
        };

        const entry: ManagedServerEntry = {
          config: {
            id: adapter.serverID,
            name: adapter.name,
            transport: 'in-process',
          },
          client: null,
          adapter,
          connectionType: 'in-process',
          status: 'connected',
          manifest,
          lastStatusChangeAt: now,
        };

        this.servers.set(adapter.serverID, entry);
        console.log(`[MCPServerManager] Loaded in-process adapter: ${adapter.serverID} (${tools.length} tools)`);
      } catch (error) {
        console.error(`[MCPServerManager] Failed to load adapter ${adapter.serverID}:`, error);
        const now = Date.now();
        const errMsg = error instanceof Error ? error.message : 'Unknown error';
        this.servers.set(adapter.serverID, {
          config: {
            id: adapter.serverID,
            name: adapter.name,
            transport: 'in-process',
          },
          client: null,
          adapter: undefined,
          connectionType: 'in-process',
          status: 'error',
          manifest: {
            id: adapter.serverID,
            name: adapter.name,
            transport: 'in-process',
            status: 'error',
            tools: [],
            lastStatusChangeAt: now,
            lastError: errMsg,
          },
          lastStatusChangeAt: now,
          lastError: errMsg,
        });
      }
    }

    const durationMs = Date.now() - startTime;
    console.log(`[MCPServerManager] In-process adapters loaded in ${durationMs}ms`);

    const connectedCount = Array.from(this.servers.values()).filter(
      (e) => e.connectionType === 'in-process' && e.status === 'connected'
    ).length;

    if (connectedCount === 0 && adapters.length > 0) {
      throw new AllServersUnavailableError(adapters.map((a) => a.serverID));
    }
  }

  /**
   * Spawns stdio servers using existing multi-server connection logic with retry.
   */
  public async spawnStdioServers(options: { maxRetries?: number; initialDelayMs?: number } = {}): Promise<void> {
    const targetEntries = Array.from(this.servers.values()).filter((e) => !e.config.disabled);

    if (targetEntries.length === 0) {
      if (this.servers.size > 0) {
        throw new AllServersUnavailableError(Array.from(this.servers.keys()));
      }
      return;
    }

    await Promise.allSettled(
      targetEntries.map((entry) => this.connectServer(entry.config.id, options))
    );

    const connectedCount = targetEntries.filter((e) => e.status === 'connected').length;

    if (connectedCount === 0) {
      const failedIDs = targetEntries.map((e) => e.config.id);
      throw new AllServersUnavailableError(failedIDs);
    }
  }

  /**
   * Connect a single server with 3 retry attempts and exponential backoff.
   */
  public async connectServer(
    serverID: string,
    options: { maxRetries?: number; initialDelayMs?: number } = {}
  ): Promise<void> {
    let entry = this.servers.get(serverID);

    // If on Vercel and server is an in-process adapter server
    if (isVercel()) {
      if (entry && entry.connectionType === 'in-process' && entry.status === 'connected') {
        return;
      }
      let adapter: InProcessMCPAdapter | null = null;
      if (serverID === 'notes') adapter = new NotesAdapter();
      else if (serverID === 'tasks') adapter = new TasksAdapter();
      else if (serverID === 'calculator') adapter = new CalculatorAdapter();

      if (adapter) {
        await this.loadInProcessAdapters([adapter]);
        return;
      }
    }

    if (!entry) {
      throw new ServerConnectionError(serverID, new Error(`Server '${serverID}' is not registered`));
    }

    if (entry.config.disabled) {
      this.updateServerStatus(entry, 'disconnected');
      return;
    }

    const maxRetries = options.maxRetries ?? 3;
    const initialDelayMs = options.initialDelayMs ?? 100;

    this.updateServerStatus(entry, 'starting');

    let lastError: unknown = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        if (!entry.client) {
          entry.client = this.clientFactory(entry.config);
        }

        await entry.client.connect();
        const tools = await entry.client.listTools();

        this.updateServerStatus(entry, 'connected');
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
    this.updateServerStatus(entry, 'error', lastError);
    console.error(`[MCPServerManager] Failed to connect to server '${serverID}' after ${maxRetries} attempts:`, lastError);
    throw new ServerConnectionError(serverID, lastError);
  }

  /**
   * Connect all registered and non-disabled servers.
   * In Vercel mode: loads in-process adapters with zero subprocesses.
   * In Local mode: spawns stdio server subprocesses in parallel.
   */
  public async connectAll(options: { maxRetries?: number; initialDelayMs?: number } = {}): Promise<void> {
    if (isVercel()) {
      await this.loadInProcessAdapters();
      return;
    }

    await this.spawnStdioServers(options);
  }

  /**
   * Dispatch a tool invocation to the specified server.
   * In-process adapters invoke directly in-memory; stdio servers invoke via MCP client IPC.
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

    if (entry.status !== 'connected') {
      throw new ToolInvocationError(
        serverID,
        toolName,
        new Error(`Server '${serverID}' is unavailable (current status: '${entry.status}')`)
      );
    }

    if (entry.connectionType === 'in-process') {
      if (!entry.adapter) {
        throw new ToolInvocationError(
          serverID,
          toolName,
          new Error(`In-process adapter not loaded: '${serverID}'`)
        );
      }
      try {
        return await entry.adapter.invokeTool(toolName, args);
      } catch (cause) {
        throw new ToolInvocationError(serverID, toolName, cause);
      }
    }

    if (!entry.client) {
      throw new ToolInvocationError(
        serverID,
        toolName,
        new Error(`Server '${serverID}' is unavailable (client not connected)`)
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
   * Get all registered server manifests with their cached tool schemas and transport.
   */
  public getServerManifests(): ServerManifest[] {
    return Array.from(this.servers.values()).map((entry) => ({
      ...entry.manifest,
      transport: entry.connectionType === 'in-process' ? 'in-process' : (entry.manifest.transport || 'stdio'),
      tools: [...entry.manifest.tools],
      lastStatusChangeAt: entry.lastStatusChangeAt,
      lastError: entry.lastError,
    }));
  }

  /**
   * Look up a cached tool schema across registered servers (or within a specific server).
   */
  public getToolSchema(toolName: string, serverID?: string): ToolSchema | undefined {
    for (const entry of this.servers.values()) {
      if (serverID && entry.config.id !== serverID) {
        continue;
      }
      const tool = entry.manifest.tools.find((t) => t.name === toolName);
      if (tool) {
        return tool;
      }
    }
    return undefined;
  }

  /**
   * Refresh tool schemas from all connected MCP servers.
   */
  public async refreshAllSchemas(): Promise<void> {
    for (const entry of this.servers.values()) {
      if (entry.status === 'connected') {
        if (entry.connectionType === 'in-process' && entry.adapter) {
          const tools = entry.adapter.listTools();
          entry.manifest.tools = tools.map((t) => ({
            name: t.name,
            description: t.description,
            inputSchema: t.inputSchema,
          }));
        } else if (entry.client) {
          const tools = await entry.client.listTools();
          entry.manifest.tools = tools;
        }
      }
    }
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
   * Start health check loop that pings connected stdio servers periodically.
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

      // In-process adapters are embedded in memory and always healthy
      if (entry.connectionType === 'in-process') {
        continue;
      }

      if (entry.status === 'connected' && entry.client) {
        try {
          await entry.client.ping();
        } catch (err) {
          console.warn(`[MCPServerManager] Health check ping failed for server '${serverID}':`, err);
          this.updateServerStatus(entry, 'error', err);
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
      if (entry.adapter) {
        entry.adapter.dispose();
        entry.adapter = undefined;
      }
      if (entry.client) {
        await entry.client.disconnect().catch(() => {});
        entry.client = null;
      }
      this.updateServerStatus(entry, 'disconnected');
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
