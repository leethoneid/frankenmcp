import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import {
  ServerConfig,
  ToolSchema,
  JSONSchema,
  ServerConnectionError,
  ToolInvocationError,
} from '@/lib/router/types';

export interface MCPClientOptions {
  /**
   * Optional custom transport instance (primarily for mocking / unit tests).
   */
  transport?: Transport;
  /**
   * Timeout in ms for connection operations (default 10000ms).
   */
  connectionTimeoutMs?: number;
}

/**
 * Wrapper around @modelcontextprotocol/sdk client to handle lifecycle,
 * tool discovery, and tool execution for a single MCP server.
 */
export class MCPClient {
  public readonly config: ServerConfig;
  private client: Client | null = null;
  private transport: Transport | null = null;
  private notificationHandlers: Array<(notification: unknown) => void> = [];
  private readonly options: MCPClientOptions;

  constructor(config: ServerConfig, options: MCPClientOptions = {}) {
    this.config = config;
    this.options = options;
  }

  /**
   * Check if client is currently connected.
   */
  public isConnected(): boolean {
    return this.client !== null;
  }

  /**
   * Register a callback for incoming server notifications.
   */
  public onNotification(handler: (notification: unknown) => void): void {
    this.notificationHandlers.push(handler);
  }

  /**
   * Establish stdio, SSE, or HTTP transport connection and perform MCP handshake.
   * Throws ServerConnectionError on failure.
   */
  public async connect(): Promise<void> {
    try {
      if (this.client) {
        return;
      }

      if (this.options.transport) {
        this.transport = this.options.transport;
      } else {
        this.transport = this.createTransport();
      }

      const client = new Client(
        {
          name: `frankenmcp-client-${this.config.id}`,
          version: '1.0.0',
        },
        {
          capabilities: {},
        }
      );

      // Register fallback handler to intercept and dispatch any incoming notifications
      (client as unknown as { fallbackNotificationHandler?: (n: unknown) => void }).fallbackNotificationHandler = (
        notification: unknown
      ) => {
        for (const handler of this.notificationHandlers) {
          try {
            handler(notification);
          } catch (err) {
            console.error(`[MCPClient:${this.config.id}] Notification handler error:`, err);
          }
        }
      };

      const timeoutMs = this.options.connectionTimeoutMs ?? 10000;
      await Promise.race([
        client.connect(this.transport),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error(`Connection timed out after ${timeoutMs}ms`)), timeoutMs).unref()
        ),
      ]);

      this.client = client;
    } catch (cause) {
      await this.disconnect().catch(() => {});
      throw new ServerConnectionError(this.config.id, cause);
    }
  }

  /**
   * Retrieve tool schemas exposed by the connected MCP server.
   * Throws ServerConnectionError on failure.
   */
  public async listTools(): Promise<ToolSchema[]> {
    if (!this.client) {
      throw new ServerConnectionError(this.config.id, new Error('Client is not connected'));
    }

    try {
      const response = await this.client.listTools();
      const rawTools = response.tools || [];

      return rawTools.map((tool) => ({
        name: tool.name,
        description: tool.description || '',
        inputSchema: (tool.inputSchema as JSONSchema) || { type: 'object' },
        outputSchema: tool.outputSchema as JSONSchema | undefined,
      }));
    } catch (cause) {
      throw new ServerConnectionError(this.config.id, cause);
    }
  }

  /**
   * Invoke a tool on the connected server with arguments.
   * Throws ToolInvocationError on failure.
   */
  public async callTool(name: string, args: Record<string, unknown> = {}): Promise<unknown> {
    if (!this.client) {
      throw new ToolInvocationError(this.config.id, name, new Error('Client is not connected'));
    }

    try {
      const result = await this.client.callTool({
        name,
        arguments: args,
      });
      return result;
    } catch (cause) {
      throw new ToolInvocationError(this.config.id, name, cause);
    }
  }

  /**
   * Ping server to check responsiveness.
   */
  public async ping(): Promise<void> {
    if (!this.client) {
      throw new ServerConnectionError(this.config.id, new Error('Client is not connected'));
    }

    try {
      await this.client.ping();
    } catch (cause) {
      throw new ServerConnectionError(this.config.id, cause);
    }
  }

  /**
   * Disconnect and release client and transport resources.
   */
  public async disconnect(): Promise<void> {
    const clientToClose = this.client;
    const transportToClose = this.transport;

    this.client = null;
    this.transport = null;

    if (clientToClose) {
      try {
        await clientToClose.close();
      } catch (err) {
        console.warn(`[MCPClient:${this.config.id}] Warning closing client:`, err);
      }
    }

    if (transportToClose && typeof (transportToClose as { close?: () => Promise<void> }).close === 'function') {
      try {
        await (transportToClose as { close: () => Promise<void> }).close();
      } catch (err) {
        console.warn(`[MCPClient:${this.config.id}] Warning closing transport:`, err);
      }
    }
  }

  /**
   * Create transport based on ServerConfig.
   */
  private createTransport(): Transport {
    switch (this.config.transport) {
      case 'stdio': {
        if (!this.config.command) {
          throw new Error(`Missing 'command' for stdio transport on server '${this.config.id}'`);
        }
        const env: Record<string, string> = {};
        for (const [k, v] of Object.entries(process.env)) {
          if (typeof v === 'string') {
            env[k] = v;
          }
        }
        return new StdioClientTransport({
          command: this.config.command,
          args: this.config.args || [],
          env,
        });
      }
      case 'sse': {
        if (!this.config.endpoint) {
          throw new Error(`Missing 'endpoint' for sse transport on server '${this.config.id}'`);
        }
        return new SSEClientTransport(new URL(this.config.endpoint), {
          requestInit: {
            headers: this.config.headers,
          },
        });
      }
      case 'http': {
        if (!this.config.endpoint) {
          throw new Error(`Missing 'endpoint' for http transport on server '${this.config.id}'`);
        }
        return new StreamableHTTPClientTransport(new URL(this.config.endpoint), {
          requestInit: {
            headers: this.config.headers,
          },
        });
      }
      default: {
        throw new Error(
          `Unsupported transport '${(this.config as { transport: string }).transport}' for server '${this.config.id}'`
        );
      }
    }
  }
}
