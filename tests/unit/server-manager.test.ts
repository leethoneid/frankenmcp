import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MCPServerManager } from '@/lib/mcp/server-manager';
import { MCPClient } from '@/lib/mcp/client';
import {
  ServerConfig,
  AllServersUnavailableError,
  ToolInvocationError,
  ToolSchema,
} from '@/lib/router/types';

describe('Phase 2 - Task 2.2: MCPServerManager', () => {
  beforeEach(async () => {
    await MCPServerManager.resetInstance();
  });

  afterEach(async () => {
    await MCPServerManager.resetInstance();
  });

  function createMockClient(
    config: ServerConfig,
    options: {
      connectFailsTimes?: number;
      failPing?: boolean;
      tools?: ToolSchema[];
      callToolResult?: unknown;
    } = {}
  ): MCPClient {
    let connectAttempts = 0;
    const failsTimes = options.connectFailsTimes ?? 0;
    let connected = false;

    const mock = {
      config,
      isConnected: () => connected,
      connect: vi.fn(async () => {
        connectAttempts++;
        if (connectAttempts <= failsTimes) {
          throw new Error(`Connection attempt ${connectAttempts} failed`);
        }
        connected = true;
      }),
      listTools: vi.fn(async () => {
        return (
          options.tools ?? [
            {
              name: `${config.id}_tool`,
              description: `Tool for ${config.id}`,
              inputSchema: { type: 'object' },
            },
          ]
        );
      }),
      callTool: vi.fn(async (name: string, args: Record<string, unknown>) => {
        return options.callToolResult ?? { echoed: { name, args } };
      }),
      ping: vi.fn(async () => {
        if (options.failPing) {
          throw new Error('Ping timeout');
        }
      }),
      disconnect: vi.fn(async () => {
        connected = false;
      }),
      onNotification: vi.fn(),
    } as unknown as MCPClient;

    return mock;
  }

  it('manages singleton lifecycle correctly', () => {
    const manager1 = MCPServerManager.getInstance();
    const manager2 = MCPServerManager.getInstance();
    expect(manager1).toBe(manager2);
  });

  it('registers, tracks, and unregisters servers', async () => {
    const manager = new MCPServerManager();
    const config: ServerConfig = {
      id: 'server-1',
      name: 'Server 1',
      transport: 'stdio',
      command: 'node',
    };

    manager.registerServer(config);
    expect(manager.getServerStatus('server-1')).toBe('disconnected');

    const manifests = manager.getServerManifests();
    expect(manifests).toHaveLength(1);
    expect(manifests[0].id).toBe('server-1');
    expect(manifests[0].status).toBe('disconnected');

    await manager.unregisterServer('server-1');
    expect(manager.getServerManifests()).toHaveLength(0);
    expect(manager.getServerStatus('server-1')).toBe('disconnected');
  });

  it('connectAll connects servers in parallel and caches schemas', async () => {
    const client1 = createMockClient({ id: 's1', name: 'S1', transport: 'stdio' });
    const client2 = createMockClient({ id: 's2', name: 'S2', transport: 'stdio' });

    const manager = new MCPServerManager((cfg) => {
      return cfg.id === 's1' ? client1 : client2;
    });

    manager.registerServer({ id: 's1', name: 'S1', transport: 'stdio', command: 'node' });
    manager.registerServer({ id: 's2', name: 'S2', transport: 'stdio', command: 'node' });

    await manager.connectAll();

    expect(manager.getServerStatus('s1')).toBe('connected');
    expect(manager.getServerStatus('s2')).toBe('connected');

    const manifests = manager.getServerManifests();
    expect(manifests).toHaveLength(2);
    expect(manifests.find((m) => m.id === 's1')?.tools).toHaveLength(1);
    expect(manifests.find((m) => m.id === 's2')?.tools).toHaveLength(1);
  });

  it('retries connection up to 3 times with exponential backoff on failure', async () => {
    // Fails 2 times, succeeds on the 3rd attempt
    const client = createMockClient(
      { id: 'flake', name: 'Flake', transport: 'stdio' },
      { connectFailsTimes: 2 }
    );

    const manager = new MCPServerManager(() => client);
    manager.registerServer({ id: 'flake', name: 'Flake', transport: 'stdio', command: 'node' });

    await manager.connectServer('flake', { maxRetries: 3, initialDelayMs: 10 });
    expect(manager.getServerStatus('flake')).toBe('connected');
    expect(client.connect).toHaveBeenCalledTimes(3);
  });

  it('throws AllServersUnavailableError when all registered servers fail to connect', async () => {
    const failingClient = createMockClient(
      { id: 'broken', name: 'Broken', transport: 'stdio' },
      { connectFailsTimes: 10 }
    );

    const manager = new MCPServerManager(() => failingClient);
    manager.registerServer({ id: 'broken', name: 'Broken', transport: 'stdio', command: 'node' });

    await expect(
      manager.connectAll({ maxRetries: 1, initialDelayMs: 5 })
    ).rejects.toThrow(AllServersUnavailableError);

    expect(manager.getServerStatus('broken')).toBe('error');
  });

  it('dispatches invokeToolCall to the designated connected server', async () => {
    const client = createMockClient(
      { id: 'notes', name: 'Notes', transport: 'stdio' },
      { callToolResult: { noteId: '123', status: 'created' } }
    );

    const manager = new MCPServerManager(() => client);
    manager.registerServer({ id: 'notes', name: 'Notes', transport: 'stdio', command: 'node' });
    await manager.connectServer('notes');

    const result = await manager.invokeToolCall('notes', 'create_note', { title: 'Test' });
    expect(result).toEqual({ noteId: '123', status: 'created' });
    expect(client.callTool).toHaveBeenCalledWith('create_note', { title: 'Test' });
  });

  it('throws ToolInvocationError when attempting to invoke on an unavailable server', async () => {
    const manager = new MCPServerManager();
    manager.registerServer({ id: 'notes', name: 'Notes', transport: 'stdio', command: 'node' });
    // Not connected yet!

    await expect(
      manager.invokeToolCall('notes', 'create_note', {})
    ).rejects.toThrow(ToolInvocationError);
  });

  it('runs health check rounds and marks failing servers as error', async () => {
    const client = createMockClient(
      { id: 'sick', name: 'Sick Server', transport: 'stdio' },
      { failPing: true }
    );

    const manager = new MCPServerManager(() => client);
    manager.registerServer({ id: 'sick', name: 'Sick Server', transport: 'stdio', command: 'node' });
    await manager.connectServer('sick');
    expect(manager.getServerStatus('sick')).toBe('connected');

    // Run health check round
    await manager.runHealthCheckRound();
    expect(manager.getServerStatus('sick')).toBe('error');
  });

  it('shuts down cleanly and terminates all clients', async () => {
    const client = createMockClient({ id: 's1', name: 'S1', transport: 'stdio' });
    const manager = new MCPServerManager(() => client);
    manager.registerServer({ id: 's1', name: 'S1', transport: 'stdio', command: 'node' });
    await manager.connectServer('s1');

    await manager.shutdown();
    expect(client.disconnect).toHaveBeenCalled();
    expect(manager.getServerManifests()).toHaveLength(0);
  });
});
