/**
 * Phase 7 - Task 7.2: Error Handling Integration Tests
 *
 * Requirements: FR-1.7, FR-2.5, NFR-2.1 (Fail-Loud Error Handling)
 *
 * Verifies that the system consistently and loudly fails when encountering faults:
 * 1. Router spawn failure throws RouterUnavailableError without silent mock fallback.
 * 2. All servers disabled in config throws AllServersUnavailableError.
 * 3. Malformed config JSON throws MCPConfigParseError at startup.
 * 4. Mid-session server disconnection marks server as disconnected and excludes it from routing pool.
 * 5. Empty search results throw NoRelevantToolsError without synthetic response generation.
 * 6. Tool call to disconnected server throws ToolInvocationError with server ID.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { MCPServerManager } from '@/lib/mcp/server-manager';
import {
  startRouterProcess,
  stopRouterProcess,
  routeIntent,
  clearRoutingCache,
} from '@/lib/router/adapter';
import {
  RouterUnavailableError,
  AllServersUnavailableError,
  MCPConfigParseError,
  NoRelevantToolsError,
  ToolInvocationError,
  ServerManifest,
} from '@/lib/router/types';

describe('Phase 7 - Task 7.2: Fail-Loud Error Handling Integration Tests', () => {
  let manager: MCPServerManager;
  let tempDir: string;

  const routerFixturePath = path.resolve(
    process.cwd(),
    'tests',
    'integration',
    'fixtures',
    'test-stdio-router.mjs'
  );

  beforeEach(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'frankenmcp-err-test-'));
    await MCPServerManager.resetInstance();
    manager = MCPServerManager.getInstance();
    clearRoutingCache();
  });

  afterEach(async () => {
    await stopRouterProcess();
    if (manager) {
      await manager.shutdown();
    }
    await MCPServerManager.resetInstance();
    clearRoutingCache();

    if (fs.existsSync(tempDir)) {
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch {
        // ignore Windows file lock cleanup race
      }
    }
  });

  it('throws RouterUnavailableError on router spawn failure with no silent fallback', async () => {
    // Attempt to spawn a non-existent executable as router
    await expect(
      startRouterProcess({
        command: 'non_existent_router_binary_xyz_123',
        args: [],
      })
    ).rejects.toThrow(RouterUnavailableError);
  }, 10000);

  it('throws AllServersUnavailableError when all demo servers are disabled in config', async () => {
    manager.registerServer({
      id: 'disabled-srv-1',
      name: 'Disabled 1',
      transport: 'stdio',
      command: 'node',
      args: ['src/mcp-servers/notes/index.mjs'],
      disabled: true,
    });
    manager.registerServer({
      id: 'disabled-srv-2',
      name: 'Disabled 2',
      transport: 'stdio',
      command: 'node',
      args: ['src/mcp-servers/tasks/index.mjs'],
      disabled: true,
    });

    await expect(manager.connectAll()).rejects.toThrow(AllServersUnavailableError);
  });

  it('throws MCPConfigParseError at startup when config JSON is malformed or invalid', () => {
    const malformedJsonPath = path.join(tempDir, 'malformed-mcp.json');
    fs.writeFileSync(malformedJsonPath, '{ "mcpServers": { broken json syntax ... ');

    expect(() => {
      manager.loadAndRegisterConfig(malformedJsonPath);
    }).toThrow(MCPConfigParseError);

    const invalidStructurePath = path.join(tempDir, 'invalid-structure.json');
    fs.writeFileSync(invalidStructurePath, JSON.stringify({ wrongField: true }));

    expect(() => {
      manager.loadAndRegisterConfig(invalidStructurePath);
    }).toThrow(MCPConfigParseError);
  });

  it('marks server as disconnected mid-session and excludes it from subsequent routing pool', async () => {
    const notesServerPath = path.resolve(process.cwd(), 'src/mcp-servers/notes/index.mjs');
    manager.registerServer({
      id: 'notes',
      name: 'Notes Server',
      transport: 'stdio',
      command: 'node',
      args: [notesServerPath],
      disabled: false,
    });

    // 1. Connect server
    await manager.connectServer('notes');
    expect(manager.getServerStatus('notes')).toBe('connected');

    // 2. Disconnect server mid-session
    await manager.unregisterServer('notes');
    expect(manager.getServerStatus('notes')).toBe('disconnected');

    // 3. Manifest pool reflects disconnection
    const manifests = manager.getServerManifests();
    expect(manifests.find((m) => m.id === 'notes')).toBeUndefined();

    // 4. Calling routeIntent with only disconnected/empty servers fails loudly with AllServersUnavailableError
    await expect(routeIntent('Add a note', manifests)).rejects.toThrow(
      AllServersUnavailableError
    );
  }, 15000);

  it('throws NoRelevantToolsError when router returns empty search results without synthetic fallback', async () => {
    await startRouterProcess({
      command: 'node',
      args: [routerFixturePath],
    });

    const activeServers: ServerManifest[] = [
      {
        id: 'notes',
        name: 'Notes Server',
        transport: 'stdio',
        status: 'connected',
        tools: [{ name: 'create_note', description: 'Create note', inputSchema: { type: 'object' } }],
      },
    ];

    // Intent '__empty__' causes test router fixture to return []
    await expect(
      routeIntent('__empty__', activeServers, { bypassCache: true })
    ).rejects.toThrow(NoRelevantToolsError);
  }, 15000);

  it('throws ToolInvocationError with server ID when tool call is dispatched to disconnected server', async () => {
    manager.registerServer({
      id: 'unconnected-srv',
      name: 'Unconnected Server',
      transport: 'stdio',
      command: 'node',
      args: ['src/mcp-servers/notes/index.mjs'],
      disabled: false,
    });

    // Server is registered but not connected (status: 'disconnected')
    expect(manager.getServerStatus('unconnected-srv')).toBe('disconnected');

    try {
      await manager.invokeToolCall('unconnected-srv', 'some_tool', {});
      expect.unreachable('Should have thrown ToolInvocationError');
    } catch (err) {
      expect(err).toBeInstanceOf(ToolInvocationError);
      const toolErr = err as ToolInvocationError;
      expect(toolErr.serverID).toBe('unconnected-srv');
      expect(toolErr.toolName).toBe('some_tool');
    }
  });
});
