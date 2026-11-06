import { describe, it, expect, afterEach } from 'vitest';
import path from 'path';
import {
  startRouterProcess,
  stopRouterProcess,
  routeIntent,
  clearRoutingCache,
} from '@/lib/router/adapter';
import { resetSessionStats, getSessionStats } from '@/lib/router/stats';
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

  it('routes 3 intents and verifies session stats match expected sums and trimmed formula', async () => {
    resetSessionStats();

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

    // Intent 1: "add a note" -> notes server selected (2 loaded, 1 trimmed)
    const dec1 = await routeIntent('add a note', dummyServers, { bypassCache: true });
    expect(dec1.selectedServers).toContain('notes');

    // Intent 2: "calculate 5 + 5" -> calculator server selected (1 loaded, 0 trimmed)
    const dec2 = await routeIntent('calculate 5 + 5', dummyServers, { bypassCache: true });
    expect(dec2.selectedServers).toContain('calculator');

    // Intent 3: "read note" -> notes server selected (2 loaded, 1 trimmed)
    const dec3 = await routeIntent('read note', dummyServers, { bypassCache: true });
    expect(dec3.selectedServers).toContain('notes');

    const sessionStats = getSessionStats();
    expect(sessionStats.turns).toHaveLength(3);

    // Sums verification
    expect(sessionStats.totalToolsLoaded).toBe(2 + 1 + 2); // 5
    expect(sessionStats.totalToolsTrimmed).toBe(1 + 0 + 1); // 2
    expect(sessionStats.totalTokensSaved).toBeGreaterThan(0);
    expect(sessionStats.averageRoutingTimeMs).toBeGreaterThanOrEqual(0);

    // Verify per-turn trimmed formula
    for (const turn of sessionStats.turns) {
      let selectedServerToolsTotal = 0;
      for (const sId of turn.selectedServers) {
        const manifest = dummyServers.find((s) => s.id === sId);
        if (manifest) {
          selectedServerToolsTotal += manifest.tools.length;
        }
      }
      expect(turn.toolsTrimmed).toBe(selectedServerToolsTotal - turn.toolsLoaded);
    }
  }, 20000);
});
