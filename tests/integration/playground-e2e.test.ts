import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import path from 'path';
import { MCPServerManager } from '@/lib/mcp/server-manager';
import {
  ensureServersInitialized,
  _resetServerInitForTesting,
} from '@/lib/server/init';
import {
  startRouterProcess,
  stopRouterProcess,
  clearRoutingCache,
} from '@/lib/router/adapter';
import { resetSessionStats, getSessionStats } from '@/lib/router/stats';
import { POST } from '@/app/api/playground/chat/route';
import type { Turn } from '@/app/playground/types';

describe('Playground Chat - Task 6.1: Full Query Flow Integration Test (Real Data)', () => {
  let manager: MCPServerManager;

  const routerFixturePath = path.resolve(
    process.cwd(),
    'tests',
    'integration',
    'fixtures',
    'test-stdio-router.mjs'
  );

  beforeAll(async () => {
    resetSessionStats();
    clearRoutingCache();

    await MCPServerManager.resetInstance();
    _resetServerInitForTesting();

    await ensureServersInitialized();
    manager = MCPServerManager.getInstance();

    expect(manager.getServerStatus('notes')).toBe('connected');
    expect(manager.getServerStatus('tasks')).toBe('connected');
    expect(manager.getServerStatus('calculator')).toBe('connected');

    await startRouterProcess({
      command: 'node',
      args: [routerFixturePath],
    });
  }, 30000);

  afterAll(async () => {
    await stopRouterProcess();
    await manager.shutdown();
    await MCPServerManager.resetInstance();
    _resetServerInitForTesting();
    resetSessionStats();
    clearRoutingCache();
  });

  it('submits query 1: "Add a note about the meeting" -> routes to notes server, executes tool, records turn', async () => {
    const res = await POST(
      new Request('http://localhost/api/playground/chat', {
        method: 'POST',
        body: JSON.stringify({ query: 'Add a note about the meeting' }),
      })
    );

    expect(res.status).toBe(200);
    const turn: Turn = await res.json();

    expect(turn.userQuery).toBe('Add a note about the meeting');
    expect(turn.routing?.selectedServers).toContain('notes');
    expect(turn.routing?.toolsLoaded).toBeGreaterThan(0);
    expect(turn.routing?.toolsTrimmed).toBeGreaterThan(0);
    expect(turn.routing?.estimatedTokensSaved).toBeGreaterThan(0);

    // Verify tool execution on real notes MCP server
    expect(turn.toolResults).toBeDefined();
    expect(turn.toolResults!.length).toBeGreaterThan(0);
    const createNoteResult = turn.toolResults!.find((r) => r.toolName === 'create_note');
    expect(createNoteResult).toBeDefined();
    expect(createNoteResult!.status).toBe('success');
    expect(createNoteResult!.result).toBeDefined();

    // Verify turn recorded in getSessionStats()
    const stats = getSessionStats();
    expect(stats.turns).toHaveLength(1);
    expect(stats.turns[0].intent).toBe('Add a note about the meeting');
    expect(stats.turns[0].selectedServers).toContain('notes');
  });

  it('submits query 2: "Add a task Buy milk" -> routes to tasks server, executes tool, records turn', async () => {
    const res = await POST(
      new Request('http://localhost/api/playground/chat', {
        method: 'POST',
        body: JSON.stringify({ query: 'Add a task Buy milk' }),
      })
    );

    expect(res.status).toBe(200);
    const turn: Turn = await res.json();

    expect(turn.userQuery).toBe('Add a task Buy milk');
    expect(turn.routing?.selectedServers).toContain('tasks');

    const createTaskResult = turn.toolResults!.find((r) => r.toolName === 'create_task');
    expect(createTaskResult).toBeDefined();
    expect(createTaskResult!.status).toBe('success');

    const stats = getSessionStats();
    expect(stats.turns).toHaveLength(2);
    expect(stats.turns[1].intent).toBe('Add a task Buy milk');
    expect(stats.turns[1].selectedServers).toContain('tasks');
  });

  it('submits query 3: "Calculate 42 + 58" -> routes to calculator server, executes addition, records turn', async () => {
    const res = await POST(
      new Request('http://localhost/api/playground/chat', {
        method: 'POST',
        body: JSON.stringify({ query: 'Calculate 42 + 58' }),
      })
    );

    expect(res.status).toBe(200);
    const turn: Turn = await res.json();

    expect(turn.userQuery).toBe('Calculate 42 + 58');
    expect(turn.routing?.selectedServers).toContain('calculator');

    const addResult = turn.toolResults!.find((r) => r.toolName === 'add');
    expect(addResult).toBeDefined();
    expect(addResult!.status).toBe('success');
    expect(JSON.stringify(addResult!.result)).toContain('100');

    const stats = getSessionStats();
    expect(stats.turns).toHaveLength(3);
    expect(stats.turns[2].intent).toBe('Calculate 42 + 58');
    expect(stats.turns[2].selectedServers).toContain('calculator');
  });

  it('verifies 3 turns total in getSessionStats() with matching intents and expected statistics', () => {
    const stats = getSessionStats();
    expect(stats.turns).toHaveLength(3);
    expect(stats.turns.map((t) => t.intent)).toEqual([
      'Add a note about the meeting',
      'Add a task Buy milk',
      'Calculate 42 + 58',
    ]);
    expect(stats.totalToolsLoaded).toBeGreaterThan(0);
    expect(stats.totalToolsTrimmed).toBeGreaterThan(0);
    expect(stats.totalTokensSaved).toBeGreaterThan(0);
  });
});
