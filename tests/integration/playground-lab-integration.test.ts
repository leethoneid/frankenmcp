import React from 'react';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import path from 'path';
import { renderToStaticMarkup } from 'react-dom/server';
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
import LabPage from '@/app/lab/page';

describe('Playground Chat - Task 6.4: Dashboard Integration Validation (Real Data)', () => {
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

  it('submits 2 queries via API route and verifies getSessionStats has exactly 2 turns (not 4)', async () => {
    // 1. Submit Query 1
    const res1 = await POST(
      new Request('http://localhost/api/playground/chat', {
        method: 'POST',
        body: JSON.stringify({ query: 'Add a note about the meeting' }),
      })
    );
    expect(res1.status).toBe(200);

    // 2. Submit Query 2
    const res2 = await POST(
      new Request('http://localhost/api/playground/chat', {
        method: 'POST',
        body: JSON.stringify({ query: 'Add a task Buy milk' }),
      })
    );
    expect(res2.status).toBe(200);

    // 3. Call getSessionStats() server-side
    const stats = getSessionStats();

    // Critical assertion: exactly 2 turns recorded, not 4 (no double recording between routeIntent and API route)
    expect(stats.turns.length).toBe(2);
    expect(stats.turns.length).not.toBe(4);

    // Verify first and second turn intents
    expect(stats.turns[0].intent).toBe('Add a note about the meeting');
    expect(stats.turns[1].intent).toBe('Add a task Buy milk');

    // Verify tool counts and savings
    expect(stats.turns[0].toolsLoaded).toBeGreaterThan(0);
    expect(stats.turns[0].toolsTrimmed).toBeGreaterThan(0);
    expect(stats.turns[0].estimatedTokensSaved).toBeGreaterThan(0);

    expect(stats.turns[1].toolsLoaded).toBeGreaterThan(0);
    expect(stats.turns[1].toolsTrimmed).toBeGreaterThan(0);
    expect(stats.turns[1].estimatedTokensSaved).toBeGreaterThan(0);

    // Verify turn statistics include toolFilter and reasoning fields
    expect(stats.turns[0].toolFilter).toBeDefined();
    expect(Array.isArray(stats.turns[0].toolFilter)).toBe(true);
    expect(stats.turns[0].reasoning).toBeDefined();

    expect(stats.turns[1].toolFilter).toBeDefined();
    expect(Array.isArray(stats.turns[1].toolFilter)).toBe(true);
    expect(stats.turns[1].reasoning).toBeDefined();
  });

  it('submits 3rd query and verifies /lab page renders exactly 3 turns (not 6)', async () => {
    // 1. Submit Query 3
    const res3 = await POST(
      new Request('http://localhost/api/playground/chat', {
        method: 'POST',
        body: JSON.stringify({ query: 'Calculate 42 + 58' }),
      })
    );
    expect(res3.status).toBe(200);

    // 2. Call getSessionStats() server-side
    const stats = getSessionStats();

    // Critical assertion: exactly 3 turns recorded, not 6
    expect(stats.turns.length).toBe(3);
    expect(stats.turns.length).not.toBe(6);

    // 3. Render /lab page server component
    const labPageElement = await LabPage();
    const labHtml = renderToStaticMarkup(labPageElement);

    // Verify /lab dashboard displays the Monster Lab header
    expect(labHtml).toContain('🧪 Monster Lab Dashboard');

    // Verify /lab renders the 3 turn queries
    expect(labHtml).toContain('Add a note about the meeting');
    expect(labHtml).toContain('Add a task Buy milk');
    expect(labHtml).toContain('Calculate 42 + 58');

    // Verify server health panel shows connected status for all 3 demo servers
    expect(labHtml).toContain('notes');
    expect(labHtml).toContain('tasks');
    expect(labHtml).toContain('calculator');
  });
});
