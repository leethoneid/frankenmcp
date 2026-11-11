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

  it('Step 8 Regression: routes and executes multi-phrasing arithmetic, unit conversion, and notes/tasks', async () => {
    process.env.VERCEL = '1';

    const manager = MCPServerManager.getInstance();
    await manager.connectAll();
    const manifests = manager.getServerManifests();

    // 1. Multiply across multiple phrasings
    const mulQueries = ['4241乘3235多少？', '4241 times 3235', '4241×3235'];
    for (const q of mulQueries) {
      const decision = await routeIntent(q, manifests, { bypassCache: true });
      expect(decision.selectedServers).toEqual(['calculator']);
      const tool = decision.toolFilter[0].includedTools[0];
      expect(tool).toBe('multiply');

      const args = extractToolArguments(q, 'multiply', 'calculator');
      expect(args).toEqual({ a: 4241, b: 3235 });

      const res = (await manager.invokeToolCall('calculator', 'multiply', args!)) as {
        result: number;
      };
      expect(res.result).toBe(13719635);
    }

    // 2. Add across multiple phrasings
    const addQueries = ['4241加3235', '4241 plus 3235', '4241 + 3235'];
    for (const q of addQueries) {
      const decision = await routeIntent(q, manifests, { bypassCache: true });
      expect(decision.selectedServers).toEqual(['calculator']);
      const tool = decision.toolFilter[0].includedTools[0];
      expect(tool).toBe('add');

      const args = extractToolArguments(q, 'add', 'calculator');
      expect(args).toEqual({ a: 4241, b: 3235 });

      const res = (await manager.invokeToolCall('calculator', 'add', args!)) as {
        result: number;
      };
      expect(res.result).toBe(7476);
    }

    // 3. Divide with Chinese phrasing
    const divQuery = '4241除以3235';
    const divDecision = await routeIntent(divQuery, manifests, { bypassCache: true });
    expect(divDecision.selectedServers).toEqual(['calculator']);
    expect(divDecision.toolFilter[0].includedTools[0]).toBe('divide');

    const divArgs = extractToolArguments(divQuery, 'divide', 'calculator');
    expect(divArgs).toEqual({ a: 4241, b: 3235 });

    const divRes = (await manager.invokeToolCall('calculator', 'divide', divArgs!)) as {
      result: number;
    };
    expect(divRes.result).toBeCloseTo(1.311, 2);

    // 4. Notes list
    const notesQuery = '列出我的笔记';
    const notesDecision = await routeIntent(notesQuery, manifests, { bypassCache: true });
    expect(notesDecision.selectedServers).toEqual(['notes']);
    expect(notesDecision.toolFilter[0].includedTools[0]).toBe('list_notes');

    const notesArgs = extractToolArguments(notesQuery, 'list_notes', 'notes');
    expect(notesArgs).toEqual({});

    const notesRes = (await manager.invokeToolCall('notes', 'list_notes', notesArgs!)) as Array<any>;
    expect(Array.isArray(notesRes)).toBe(true);
    expect(notesRes.length).toBeGreaterThan(0);

    // 5. Tasks list
    const tasksQuery = '显示我的任务';
    const tasksDecision = await routeIntent(tasksQuery, manifests, { bypassCache: true });
    expect(tasksDecision.selectedServers).toEqual(['tasks']);
    expect(tasksDecision.toolFilter[0].includedTools[0]).toBe('list_tasks');

    const tasksArgs = extractToolArguments(tasksQuery, 'list_tasks', 'tasks');
    expect(tasksArgs).toEqual({});

    const tasksRes = (await manager.invokeToolCall('tasks', 'list_tasks', tasksArgs!)) as Array<any>;
    expect(Array.isArray(tasksRes)).toBe(true);

    // 6. Unit conversion across Chinese and English
    const convQueries = ['100米等于多少英尺', 'Convert 100 meters to feet'];
    for (const q of convQueries) {
      const decision = await routeIntent(q, manifests, { bypassCache: true });
      expect(decision.selectedServers).toEqual(['calculator']);
      expect(decision.toolFilter[0].includedTools[0]).toBe('convert_units');

      const args = extractToolArguments(q, 'convert_units', 'calculator');
      expect(args).toEqual({ value: 100, from: 'm', to: 'ft' });

      const res = (await manager.invokeToolCall('calculator', 'convert_units', args!)) as {
        result: number;
      };
      expect(res.result).toBe(328.08399);
    }
  });

  it('Step 9 Regression: prioritizes arithmetic over unit conversion when queries contain 等于', async () => {
    process.env.VERCEL = '1';

    const manager = MCPServerManager.getInstance();
    await manager.connectAll();
    const manifests = manager.getServerManifests();

    // 1. "47474乘87587等于多少" -> multiply, { a: 47474, b: 87587 }, result 4158105238
    const mulQuery = '47474乘87587等于多少';
    const mulDecision = await routeIntent(mulQuery, manifests, { bypassCache: true });
    expect(mulDecision.selectedServers).toEqual(['calculator']);
    expect(mulDecision.toolFilter[0].includedTools).toEqual(['multiply']);
    const mulArgs = extractToolArguments(mulQuery, 'multiply', 'calculator');
    expect(mulArgs).toEqual({ a: 47474, b: 87587 });
    const mulRes = (await manager.invokeToolCall('calculator', 'multiply', mulArgs!)) as {
      result: number;
    };
    expect(mulRes.result).toBe(4158105238);

    // 2. "4241乘3235多少？" -> multiply, result 13719635
    const mulQuery2 = '4241乘3235多少？';
    const mulDecision2 = await routeIntent(mulQuery2, manifests, { bypassCache: true });
    expect(mulDecision2.selectedServers).toEqual(['calculator']);
    expect(mulDecision2.toolFilter[0].includedTools).toEqual(['multiply']);
    const mulArgs2 = extractToolArguments(mulQuery2, 'multiply', 'calculator');
    expect(mulArgs2).toEqual({ a: 4241, b: 3235 });
    const mulRes2 = (await manager.invokeToolCall('calculator', 'multiply', mulArgs2!)) as {
      result: number;
    };
    expect(mulRes2.result).toBe(13719635);

    // 3. "100米等于多少英尺" -> convert_units, result 328.08399
    const convQuery = '100米等于多少英尺';
    const convDecision = await routeIntent(convQuery, manifests, { bypassCache: true });
    expect(convDecision.selectedServers).toEqual(['calculator']);
    expect(convDecision.toolFilter[0].includedTools).toEqual(['convert_units']);
    const convArgs = extractToolArguments(convQuery, 'convert_units', 'calculator');
    expect(convArgs).toEqual({ value: 100, from: 'm', to: 'ft' });
    const convRes = (await manager.invokeToolCall('calculator', 'convert_units', convArgs!)) as {
      result: number;
    };
    expect(convRes.result).toBe(328.08399);

    // 4. "10加5等于多少" -> add, result 15
    const addQuery = '10加5等于多少';
    const addDecision = await routeIntent(addQuery, manifests, { bypassCache: true });
    expect(addDecision.selectedServers).toEqual(['calculator']);
    expect(addDecision.toolFilter[0].includedTools).toEqual(['add']);
    const addArgs = extractToolArguments(addQuery, 'add', 'calculator');
    expect(addArgs).toEqual({ a: 10, b: 5 });
    const addRes = (await manager.invokeToolCall('calculator', 'add', addArgs!)) as {
      result: number;
    };
    expect(addRes.result).toBe(15);
  });

  // Validates playground-chat FR-3.2a (Task 9.1): route → extract → invoke
  it('Task 9.1 Regression: "subtract X from Y" computes Y - X end to end', async () => {
    process.env.VERCEL = '1';

    const manager = MCPServerManager.getInstance();
    await manager.connectAll();
    const manifests = manager.getServerManifests();

    const cases: Array<[string, number]> = [
      ['Subtract 5 from 20', 15],
      ['Subtract 20 from 5', -15],
      ['20 minus 5', 15],
      ['What is 20 - 5?', 15],
      ['20减5等于多少', 15],
    ];

    for (const [query, expected] of cases) {
      const decision = await routeIntent(query, manifests, { bypassCache: true });
      expect(decision.selectedServers).toEqual(['calculator']);
      expect(decision.toolFilter[0].includedTools).toEqual(['subtract']);
      const args = extractToolArguments(query, 'subtract', 'calculator');
      expect(args).not.toBeNull();
      const res = (await manager.invokeToolCall('calculator', 'subtract', args!)) as { result: number };
      expect(res.result, query).toBe(expected);
    }
  });
});
