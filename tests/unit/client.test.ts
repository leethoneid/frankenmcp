import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { MCPClient } from '@/lib/mcp/client';
import { ServerConnectionError, ToolInvocationError, ServerConfig } from '@/lib/router/types';

describe('Phase 2 - Task 2.1: MCPClient', () => {
  let mcpServer: Server;
  let clientTransport: InstanceType<typeof InMemoryTransport>;
  let serverTransport: InstanceType<typeof InMemoryTransport>;

  beforeEach(async () => {
    mcpServer = new Server(
      {
        name: 'test-demo-server',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    // Register test tool
    mcpServer.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'calculate_sum',
            description: 'Calculates the sum of two numbers',
            inputSchema: {
              type: 'object',
              properties: {
                a: { type: 'number' },
                b: { type: 'number' },
              },
              required: ['a', 'b'],
            },
          },
        ],
      };
    });

    mcpServer.setRequestHandler(CallToolRequestSchema, async (request) => {
      if (request.params.name === 'calculate_sum') {
        const { a, b } = request.params.arguments as { a: number; b: number };
        return {
          content: [
            {
              type: 'text',
              text: String(Number(a) + Number(b)),
            },
          ],
        };
      }
      throw new Error(`Tool not found: ${request.params.name}`);
    });

    const [cTransport, sTransport] = InMemoryTransport.createLinkedPair();
    clientTransport = cTransport;
    serverTransport = sTransport;

    await mcpServer.connect(serverTransport);
  });

  afterEach(async () => {
    await mcpServer.close().catch(() => {});
  });

  it('connects to server, lists tools, calls tool, and disconnects gracefully', () => {
    return new Promise<void>(async (resolve, reject) => {
      try {
        const config: ServerConfig = {
          id: 'test-server',
          name: 'Test Server',
          transport: 'stdio',
          command: 'node',
        };

        const client = new MCPClient(config, { transport: clientTransport });
        expect(client.isConnected()).toBe(false);

        await client.connect();
        expect(client.isConnected()).toBe(true);

        const tools = await client.listTools();
        expect(tools).toHaveLength(1);
        expect(tools[0].name).toBe('calculate_sum');
        expect(tools[0].description).toBe('Calculates the sum of two numbers');
        expect(tools[0].inputSchema.required).toEqual(['a', 'b']);

        const result = (await client.callTool('calculate_sum', { a: 10, b: 20 })) as {
          content: Array<{ text: string }>;
        };
        expect(result.content[0].text).toBe('30');

        await client.ping();

        await client.disconnect();
        expect(client.isConnected()).toBe(false);
        resolve();
      } catch (err) {
        reject(err);
      }
    });
  });

  it('throws ServerConnectionError when connection fails or transport config is invalid', async () => {
    const invalidConfig: ServerConfig = {
      id: 'broken-server',
      name: 'Broken Server',
      transport: 'stdio',
      command: 'non_existent_executable_12345',
      args: [],
    };

    const client = new MCPClient(invalidConfig, { connectionTimeoutMs: 500 });
    await expect(client.connect()).rejects.toThrow(ServerConnectionError);

    try {
      await client.connect();
    } catch (err) {
      expect(err).toBeInstanceOf(ServerConnectionError);
      expect((err as ServerConnectionError).serverID).toBe('broken-server');
    }
  });

  it('throws ServerConnectionError when listTools is called on unconnected client', async () => {
    const config: ServerConfig = {
      id: 'unconnected-server',
      name: 'Unconnected',
      transport: 'stdio',
      command: 'node',
    };

    const client = new MCPClient(config);
    await expect(client.listTools()).rejects.toThrow(ServerConnectionError);
  });

  it('throws ToolInvocationError when tool invocation fails or tool does not exist', async () => {
    const config: ServerConfig = {
      id: 'test-server',
      name: 'Test Server',
      transport: 'stdio',
      command: 'node',
    };

    const client = new MCPClient(config, { transport: clientTransport });
    await client.connect();

    try {
      await client.callTool('non_existent_tool', {});
      expect.fail('Should have thrown ToolInvocationError');
    } catch (err) {
      expect(err).toBeInstanceOf(ToolInvocationError);
      const toolErr = err as ToolInvocationError;
      expect(toolErr.serverID).toBe('test-server');
      expect(toolErr.toolName).toBe('non_existent_tool');
    }

    await client.disconnect();
  });

  it('dispatches incoming server notifications to registered handlers', async () => {
    const config: ServerConfig = {
      id: 'notif-server',
      name: 'Notif Server',
      transport: 'stdio',
      command: 'node',
    };

    const client = new MCPClient(config, { transport: clientTransport });
    await client.connect();

    const received: unknown[] = [];
    client.onNotification((notif) => {
      received.push(notif);
    });

    // Send a notification from server
    await mcpServer.notification({
      method: 'notifications/tools/list_changed',
    });

    // Brief tick to allow event dispatch
    await new Promise((r) => setTimeout(r, 50));

    expect(received.length).toBeGreaterThanOrEqual(1);
    await client.disconnect();
  });
});
