import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'path';
import { MCPServerManager } from '@/lib/mcp/server-manager';
import { ServerConnectionError } from '@/lib/router/types';

describe('Phase 5 - Task 5.4 Integration: Demo Server Pre-Configuration (.kiro/settings/mcp.json)', () => {
  let manager: MCPServerManager;
  const configPath = path.resolve(process.cwd(), '.kiro', 'settings', 'mcp.json');

  beforeEach(async () => {
    await MCPServerManager.resetInstance();
    manager = MCPServerManager.getInstance();
  });

  afterEach(async () => {
    await MCPServerManager.resetInstance();
  });

  it('loads .kiro/settings/mcp.json, spawns all three demo servers, and exposes 15 total tools', async () => {
    // 1. Auto-register from .kiro/settings/mcp.json
    const configs = manager.loadAndRegisterConfig(configPath);
    expect(configs).toHaveLength(3);
    expect(configs.map((c) => c.id)).toEqual(['notes', 'tasks', 'calculator']);

    // 2. Connect all servers concurrently
    await manager.connectAll();

    // 3. Verify all three servers are reported as 'connected'
    expect(manager.getServerStatus('notes')).toBe('connected');
    expect(manager.getServerStatus('tasks')).toBe('connected');
    expect(manager.getServerStatus('calculator')).toBe('connected');

    // 4. Verify getServerManifests returns 15 total tools (5 tools per server)
    const manifests = manager.getServerManifests();
    expect(manifests).toHaveLength(3);

    const notesManifest = manifests.find((m) => m.id === 'notes');
    const tasksManifest = manifests.find((m) => m.id === 'tasks');
    const calcManifest = manifests.find((m) => m.id === 'calculator');

    expect(notesManifest?.tools).toHaveLength(5);
    expect(tasksManifest?.tools).toHaveLength(5);
    expect(calcManifest?.tools).toHaveLength(5);

    const totalToolCount = manifests.reduce((sum, m) => sum + m.tools.length, 0);
    expect(totalToolCount).toBe(15);

    // 5. Verify real tool execution through MCPServerManager
    const noteRes = (await manager.invokeToolCall('notes', 'list_notes', {})) as {
      content: Array<{ text: string }>;
    };
    expect(JSON.parse(noteRes.content[0].text).notes.length).toBeGreaterThanOrEqual(3);

    const taskRes = (await manager.invokeToolCall('tasks', 'list_tasks', {})) as {
      content: Array<{ text: string }>;
    };
    expect(JSON.parse(taskRes.content[0].text).tasks).toHaveLength(5);

    const calcRes = (await manager.invokeToolCall('calculator', 'add', { a: 21, b: 21 })) as {
      content: Array<{ text: string }>;
    };
    expect(JSON.parse(calcRes.content[0].text).result).toBe(42);
  }, 25000);

  it('fails loud when a server executable cannot be found', async () => {
    manager.registerServer({
      id: 'missing-server',
      name: 'Missing Server',
      transport: 'stdio',
      command: 'node',
      args: ['src/mcp-servers/non_existent_folder/index.mjs'],
    });

    await expect(
      manager.connectServer('missing-server', { maxRetries: 1, initialDelayMs: 50 })
    ).rejects.toThrow(ServerConnectionError);

    expect(manager.getServerStatus('missing-server')).toBe('error');
  }, 15000);
});
