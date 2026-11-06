import { describe, it, expect, afterEach } from 'vitest';
import path from 'path';
import { MCPServerManager } from '@/lib/mcp/server-manager';
import { ServerConfig } from '@/lib/router/types';

describe('Phase 2 - Task 2.2 Integration: MCPServerManager with Real Stdio Subprocess', () => {
  let manager: MCPServerManager | null = null;

  afterEach(async () => {
    if (manager) {
      await manager.shutdown();
      manager = null;
    }
  });

  it('spawns a real Node stdio MCP server, performs handshake, lists tools, and invokes tool', async () => {
    manager = new MCPServerManager();

    const fixturePath = path.resolve(
      process.cwd(),
      'tests',
      'integration',
      'fixtures',
      'test-stdio-server.mjs'
    );

    const config: ServerConfig = {
      id: 'real-stdio-echo',
      name: 'Real Stdio Echo Server',
      transport: 'stdio',
      command: 'node',
      args: [fixturePath],
    };

    manager.registerServer(config);
    expect(manager.getServerStatus('real-stdio-echo')).toBe('disconnected');

    // Attempt real connection via child process
    await manager.connectServer('real-stdio-echo', { maxRetries: 3, initialDelayMs: 200 });
    expect(manager.getServerStatus('real-stdio-echo')).toBe('connected');

    // Verify manifest has retrieved and cached tool schema
    const manifests = manager.getServerManifests();
    const serverManifest = manifests.find((m) => m.id === 'real-stdio-echo');
    expect(serverManifest).toBeDefined();
    expect(serverManifest?.status).toBe('connected');
    expect(serverManifest?.tools).toHaveLength(1);
    expect(serverManifest?.tools[0].name).toBe('echo_message');
    expect(serverManifest?.tools[0].inputSchema.required).toEqual(['text']);

    // Invoke tool call on real subprocess
    const response = (await manager.invokeToolCall('real-stdio-echo', 'echo_message', {
      text: 'FrankenMCP handshake ok',
    })) as { content: Array<{ text: string }> };

    expect(response).toBeDefined();
    expect(response.content[0].text).toBe('ECHO: FrankenMCP handshake ok');

    // Graceful disconnect terminates child process
    await manager.shutdown();
    expect(manager.getServerStatus('real-stdio-echo')).toBe('disconnected');
  }, 15000);

  it('Phase 1 - Task 1.4 Integration: reflects error and updated timestamp when subprocess terminates unexpectedly', async () => {
    manager = new MCPServerManager();

    const notesPath = path.resolve(process.cwd(), 'src', 'mcp-servers', 'notes', 'index.mjs');
    manager.registerServer({
      id: 'notes-kill-test',
      name: 'Notes Kill Test',
      transport: 'stdio',
      command: 'node',
      args: [notesPath],
    });

    await manager.connectServer('notes-kill-test');
    expect(manager.getServerStatus('notes-kill-test')).toBe('connected');

    const connectedManifest = manager.getServerManifests().find((m) => m.id === 'notes-kill-test')!;
    const connectedAt = connectedManifest.lastStatusChangeAt!;

    // Access underlying client & child process
    const entry = (manager as unknown as { servers: Map<string, { client: { transport?: { _process?: { kill: (signal: string) => void } } } }> }).servers.get('notes-kill-test');
    const childProc = entry?.client?.transport?._process;
    expect(childProc).toBeDefined();

    // Small delay to ensure timestamp progression
    await new Promise((resolve) => setTimeout(resolve, 5));

    // Kill the subprocess to simulate sudden failure
    childProc!.kill('SIGTERM');

    // Run health check round to detect the termination
    await manager.runHealthCheckRound();

    const deadManifest = manager.getServerManifests().find((m) => m.id === 'notes-kill-test')!;
    expect(deadManifest.status).toBe('error');
    expect(deadManifest.lastStatusChangeAt!).toBeGreaterThan(connectedAt);
    expect(deadManifest.lastError).toBeDefined();
    expect(deadManifest.lastError!.length).toBeGreaterThan(0);
  }, 15000);
});
