import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MCPServerManager } from '@/lib/mcp/server-manager';
import { routeIntent } from '@/lib/router/adapter';
import { extractToolArguments } from '@/lib/server/extractToolArguments';

describe('Task 4.2: Vercel Mode Integration Tests', () => {
  const originalVercel = process.env.VERCEL;

  beforeEach(async () => {
    await MCPServerManager.resetInstance();
  });

  afterEach(async () => {
    process.env.VERCEL = originalVercel;
    await MCPServerManager.resetInstance();
  });

  it('loads in-process adapters in <100ms when VERCEL=1', async () => {
    process.env.VERCEL = '1';

    const manager = MCPServerManager.getInstance();
    const startTime = performance.now();
    await manager.connectAll();
    const durationMs = performance.now() - startTime;

    expect(durationMs).toBeLessThan(100);

    const manifests = manager.getServerManifests();
    expect(manifests).toHaveLength(3);

    const notes = manifests.find((m) => m.id === 'notes');
    const tasks = manifests.find((m) => m.id === 'tasks');
    const calc = manifests.find((m) => m.id === 'calculator');

    expect(notes?.transport).toBe('in-process');
    expect(tasks?.transport).toBe('in-process');
    expect(calc?.transport).toBe('in-process');

    expect(notes?.tools).toHaveLength(5);
    expect(tasks?.tools).toHaveLength(5);
    expect(calc?.tools).toHaveLength(5);
  });

  it('executes full end-to-end query workflow in Vercel mode', async () => {
    process.env.VERCEL = '1';

    const manager = MCPServerManager.getInstance();
    await manager.connectAll();
    const manifests = manager.getServerManifests();

    // 1. Math Query
    const mathQuery = 'What is 42 + 58?';
    const mathDecision = await routeIntent(mathQuery, manifests, { bypassCache: true });
    expect(mathDecision.selectedServers).toEqual(['calculator']);

    const mathFilter = mathDecision.toolFilter.find((tf) => tf.serverID === 'calculator');
    expect(mathFilter?.includedTools).toEqual(['add']);

    const mathArgs = extractToolArguments(mathQuery, 'add', 'calculator');
    expect(mathArgs).toEqual({ a: 42, b: 58 });

    const mathResult = (await manager.invokeToolCall('calculator', 'add', mathArgs!)) as {
      result: number;
    };
    expect(mathResult.result).toBe(100);

    // 2. Note Creation Query
    const noteQuery = 'Add a note about testing';
    const noteDecision = await routeIntent(noteQuery, manifests, { bypassCache: true });
    expect(noteDecision.selectedServers).toEqual(['notes']);

    const noteFilter = noteDecision.toolFilter.find((tf) => tf.serverID === 'notes');
    expect(noteFilter?.includedTools).toEqual(['create_note']);

    const noteArgs = extractToolArguments(noteQuery, 'create_note', 'notes');
    expect(noteArgs).toBeDefined();

    const noteResult = (await manager.invokeToolCall(
      'notes',
      'create_note',
      noteArgs!
    )) as { id: string; title: string };
    expect(noteResult.id).toBeDefined();
    expect(noteResult.title).toBe('testing');

    // 3. List Notes Query
    const listQuery = 'List my notes';
    const listDecision = await routeIntent(listQuery, manifests, { bypassCache: true });
    expect(listDecision.selectedServers).toEqual(['notes']);

    const listFilter = listDecision.toolFilter.find((tf) => tf.serverID === 'notes');
    expect(listFilter?.includedTools).toEqual(['list_notes']);

    const listResult = (await manager.invokeToolCall('notes', 'list_notes', {})) as Array<{
      id: string;
      title: string;
    }>;
    expect(listResult.length).toBeGreaterThanOrEqual(4); // 3 fixtures + 1 created
    expect(listResult.some((n) => n.id === noteResult.id)).toBe(true);
  });
});
