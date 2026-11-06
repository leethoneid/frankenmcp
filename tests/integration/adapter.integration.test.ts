import { describe, it, expect, afterEach } from 'vitest';
import path from 'path';
import {
  startRouterProcess,
  stopRouterProcess,
  routeIntent,
  clearRoutingCache,
} from '@/lib/router/adapter';
import { ServerManifest } from '@/lib/router/types';

describe('Phase 3 - Router Adapter Integration with Stdio Router Subprocess', () => {
  const dummyServers: ServerManifest[] = [
    {
      id: 'notes',
      name: 'Notes Server',
      transport: 'stdio',
      status: 'connected',
      tools: [
        { name: 'create_note', description: 'Create note', inputSchema: { type: 'object' } },
        { name: 'read_note', description: 'Read note', inputSchema: { type: 'object' } },
        { name: 'list_notes', description: 'List notes', inputSchema: { type: 'object' } },
      ],
    },
    {
      id: 'calculator',
      name: 'Calculator Server',
      transport: 'stdio',
      status: 'connected',
      tools: [
        { name: 'add', description: 'Add two numbers', inputSchema: { type: 'object' } },
      ],
    },
  ];

  afterEach(async () => {
    await stopRouterProcess();
    clearRoutingCache();
  });

  it('spawns real router subprocess, completes handshake, and routes intent to notes server', async () => {
    const fixturePath = path.resolve(
      process.cwd(),
      'tests',
      'integration',
      'fixtures',
      'test-stdio-router.mjs'
    );

    // 1. Spawns router process via startRouterProcess
    const child = await startRouterProcess({
      command: 'node',
      args: [fixturePath],
    });

    expect(child).toBeDefined();
    expect(child.pid).toBeGreaterThan(0);

    // 2. Route intent "add a note" end-to-end
    const decision = await routeIntent('add a note', dummyServers, { bypassCache: true });

    expect(decision.selectedServers).toContain('notes');
    const notesFilter = decision.toolFilter.find((f) => f.serverID === 'notes');
    expect(notesFilter).toBeDefined();
    expect(notesFilter?.includedTools).toContain('create_note');
    expect(decision.reasoning).toBeDefined();

    // 3. Graceful shutdown
    await stopRouterProcess();
  }, 15000);

  it('routes intent to calculator server through real subprocess', async () => {
    const fixturePath = path.resolve(
      process.cwd(),
      'tests',
      'integration',
      'fixtures',
      'test-stdio-router.mjs'
    );

    await startRouterProcess({
      command: 'node',
      args: [fixturePath],
    });

    const decision = await routeIntent('calculate 2 + 2', dummyServers, { bypassCache: true });

    expect(decision.selectedServers).toEqual(['calculator']);
    const calcFilter = decision.toolFilter.find((f) => f.serverID === 'calculator');
    expect(calcFilter?.includedTools).toEqual(['add']);
  }, 15000);
});
