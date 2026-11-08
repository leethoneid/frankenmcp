import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  recordTurn,
  getSessionStats,
  resetSessionStats,
  estimateTokenSavings,
  computeTurnStats,
  formatTokenSavings,
  getRecordedTurnsCount,
  SESSION_TURNS_STORAGE_KEY,
  readSessionStorageTurns,
  mergeTurnsByTurnId,
  mergeSessionStats,
} from '@/lib/router/stats';
import { StatsDisplay } from '@/components/StatsDisplay';
import { TurnStatistics, SessionStatistics, ToolSchema, ServerManifest, RoutingDecision } from '@/lib/router/types';

describe('Phase 4 - Task 4.1: Statistics Calculation', () => {
  beforeEach(() => {
    resetSessionStats();
  });

  it('records a single turn and retrieves session statistics accurately', () => {
    const turn1: TurnStatistics = {
      turnID: 'turn-1',
      timestamp: 1700000000000,
      intent: 'Show notes',
      selectedServers: ['notes'],
      toolsLoaded: 2,
      toolsTrimmed: 3,
      estimatedTokensSaved: 150,
      routingTimeMs: 40,
      toolFilter: [{ serverID: 'notes', includedTools: ['read_note', 'list_notes'] }],
      reasoning: 'Selected notes tools',
    };

    recordTurn(turn1);
    expect(getRecordedTurnsCount()).toBe(1);

    const stats = getSessionStats();
    expect(stats.turns).toHaveLength(1);
    expect(stats.totalToolsLoaded).toBe(2);
    expect(stats.totalToolsTrimmed).toBe(3);
    expect(stats.totalTokensSaved).toBe(150);
    expect(stats.averageRoutingTimeMs).toBe(40);
    expect(stats.turns[0].toolFilter).toEqual([{ serverID: 'notes', includedTools: ['read_note', 'list_notes'] }]);
    expect(stats.turns[0].reasoning).toBe('Selected notes tools');
  });

  it('aggregates multiple turns across session with accurate sums and average routing time', () => {
    const turn1: TurnStatistics = {
      turnID: 'turn-1',
      timestamp: 1700000000000,
      intent: 'Show notes',
      selectedServers: ['notes'],
      toolsLoaded: 2,
      toolsTrimmed: 3,
      estimatedTokensSaved: 150,
      routingTimeMs: 40,
      toolFilter: [{ serverID: 'notes', includedTools: ['read_note', 'list_notes'] }],
    };

    const turn2: TurnStatistics = {
      turnID: 'turn-2',
      timestamp: 1700000001000,
      intent: 'Calculate tax',
      selectedServers: ['calculator'],
      toolsLoaded: 1,
      toolsTrimmed: 4,
      estimatedTokensSaved: 220,
      routingTimeMs: 60,
      toolFilter: [{ serverID: 'calculator', includedTools: ['add'] }],
    };

    const turn3: TurnStatistics = {
      turnID: 'turn-3',
      timestamp: 1700000002000,
      intent: 'List tasks',
      selectedServers: ['tasks'],
      toolsLoaded: 3,
      toolsTrimmed: 2,
      estimatedTokensSaved: 110,
      routingTimeMs: 50,
      toolFilter: [{ serverID: 'tasks', includedTools: ['list_tasks', 'read_task', 'create_task'] }],
    };

    recordTurn(turn1);
    recordTurn(turn2);
    recordTurn(turn3);

    const stats = getSessionStats();
    expect(stats.turns).toHaveLength(3);
    expect(stats.totalToolsLoaded).toBe(2 + 1 + 3); // 6
    expect(stats.totalToolsTrimmed).toBe(3 + 4 + 2); // 9
    expect(stats.totalTokensSaved).toBe(150 + 220 + 110); // 480
    expect(stats.averageRoutingTimeMs).toBe(Math.round((40 + 60 + 50) / 3)); // 50
  });

  it('calculates estimateTokenSavings using Math.ceil(charCount / 4)', () => {
    const toolA: ToolSchema = {
      name: 'tool_a',
      description: 'First test tool description',
      inputSchema: { type: 'object', properties: { x: { type: 'number' } } },
    };
    const toolB: ToolSchema = {
      name: 'tool_b',
      description: 'Second tool description',
      inputSchema: { type: 'object' },
    };

    const expectedChars = JSON.stringify(toolA).length + JSON.stringify(toolB).length;
    const expectedTokens = Math.ceil(expectedChars / 4);

    const savings = estimateTokenSavings([toolA, toolB]);
    expect(savings).toBe(expectedTokens);

    // Empty array returns 0
    expect(estimateTokenSavings([])).toBe(0);

    // Non-array or malformed input returns null
    expect(estimateTokenSavings(null as unknown as ToolSchema[])).toBeNull();
    expect(estimateTokenSavings([{ bad: true } as unknown as ToolSchema])).toBeNull();
  });

  it('computes toolsLoaded and toolsTrimmed strictly within selected servers', () => {
    const servers: ServerManifest[] = [
      {
        id: 'notes',
        name: 'Notes',
        transport: 'stdio',
        status: 'connected',
        tools: [
          { name: 'n1', description: 'n1', inputSchema: { type: 'object' } },
          { name: 'n2', description: 'n2', inputSchema: { type: 'object' } },
          { name: 'n3', description: 'n3', inputSchema: { type: 'object' } },
          { name: 'n4', description: 'n4', inputSchema: { type: 'object' } },
          { name: 'n5', description: 'n5', inputSchema: { type: 'object' } },
        ],
      },
      {
        id: 'calculator',
        name: 'Calculator',
        transport: 'stdio',
        status: 'connected',
        tools: [
          { name: 'c1', description: 'c1', inputSchema: { type: 'object' } },
          { name: 'c2', description: 'c2', inputSchema: { type: 'object' } },
        ],
      },
    ];

    const decision: RoutingDecision = {
      selectedServers: ['notes'],
      toolFilter: [
        {
          serverID: 'notes',
          includedTools: ['n1', 'n2'], // 2 tools loaded
        },
      ],
    };

    const turnStats = computeTurnStats('turn-test', 'read my notes', decision, servers, 25);

    expect(turnStats.toolsLoaded).toBe(2);
    // Notes has 5 tools total. toolsTrimmed = 5 - 2 = 3.
    // Calculator's 2 tools must NOT be counted in toolsTrimmed.
    expect(turnStats.toolsTrimmed).toBe(3);
    expect(turnStats.estimatedTokensSaved).toBeGreaterThan(0);
  });

  it('throws an error when recordTurn receives invalid inputs', () => {
    expect(() => recordTurn(null as unknown as TurnStatistics)).toThrow();
    expect(() =>
      recordTurn({
        turnID: 'bad',
        toolsLoaded: NaN,
      } as unknown as TurnStatistics)
    ).toThrow();
  });
});

describe('Phase 4 - Task 4.2: Statistics Display Fail-Safe', () => {
  it('renders "Stats unavailable" when stats is null or error is provided', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // Null stats
    const html1 = renderToStaticMarkup(React.createElement(StatsDisplay, { stats: null }));
    expect(html1).toContain('Stats unavailable');
    expect(html1).not.toContain('Tools Loaded');

    // Error passed
    const html2 = renderToStaticMarkup(
      React.createElement(StatsDisplay, { error: new Error('Database corruption') })
    );
    expect(html2).toContain('Stats unavailable');
    expect(consoleSpy).toHaveBeenCalled();

    consoleSpy.mockRestore();
  });

  it('renders "Token savings unavailable" when token savings value is null or undefined', () => {
    const turnWithNullSavings = {
      turnID: 't1',
      timestamp: Date.now(),
      intent: 'test',
      selectedServers: ['notes'],
      toolsLoaded: 2,
      toolsTrimmed: 3,
      estimatedTokensSaved: null as unknown as number,
      routingTimeMs: 30,
      toolFilter: [{ serverID: 'notes', includedTools: ['read_note'] }],
    };

    const html = renderToStaticMarkup(React.createElement(StatsDisplay, { stats: turnWithNullSavings }));
    expect(html).toContain('Token savings unavailable');
    expect(html).toContain('Tools Loaded');
    expect(html).toContain('2');
    expect(html).toContain('3');
  });

  it('renders "Stats unavailable" when toolsLoaded or toolsTrimmed contains NaN', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const invalidStats: TurnStatistics = {
      turnID: 't1',
      timestamp: Date.now(),
      intent: 'test',
      selectedServers: ['notes'],
      toolsLoaded: NaN,
      toolsTrimmed: 2,
      estimatedTokensSaved: 100,
      routingTimeMs: 30,
      toolFilter: [],
    };

    const html = renderToStaticMarkup(React.createElement(StatsDisplay, { stats: invalidStats }));
    expect(html).toContain('Stats unavailable');

    consoleSpy.mockRestore();
  });

  it('formats token savings using formatTokenSavings helper', () => {
    expect(formatTokenSavings(250)).toBe('250 tokens');
    expect(formatTokenSavings(null)).toBe('Token savings unavailable');
    expect(formatTokenSavings(undefined)).toBe('Token savings unavailable');
    expect(formatTokenSavings(NaN)).toBe('Token savings unavailable');
  });

  it('Phase 1 - Task 1.2: computeTurnStats copies toolFilter and reasoning from RoutingDecision', () => {
    const mockDecision: RoutingDecision = {
      selectedServers: ['notes', 'calculator'],
      toolFilter: [
        { serverID: 'notes', includedTools: ['create_note', 'read_note'] },
        { serverID: 'calculator', includedTools: ['add'] },
      ],
      reasoning: 'Selected notes and calculator based on composite query',
    };

    const mockManifests: ServerManifest[] = [
      {
        id: 'notes',
        name: 'Notes',
        transport: 'stdio',
        status: 'connected',
        tools: [
          { name: 'create_note', description: '', inputSchema: { type: 'object' } },
          { name: 'read_note', description: '', inputSchema: { type: 'object' } },
          { name: 'delete_note', description: '', inputSchema: { type: 'object' } },
        ],
      },
      {
        id: 'calculator',
        name: 'Calculator',
        transport: 'stdio',
        status: 'connected',
        tools: [{ name: 'add', description: '', inputSchema: { type: 'object' } }],
      },
    ];

    const turn = computeTurnStats('turn-100', 'add a note and 2+2', mockDecision, mockManifests, 45);

    expect(turn.toolFilter).toEqual([
      { serverID: 'notes', includedTools: ['create_note', 'read_note'] },
      { serverID: 'calculator', includedTools: ['add'] },
    ]);
    expect(turn.reasoning).toBe('Selected notes and calculator based on composite query');

    // Verify deep copy (modifying mockDecision does not mutate turn.toolFilter)
    mockDecision.toolFilter[0].includedTools.push('delete_note');
    expect(turn.toolFilter[0].includedTools).toEqual(['create_note', 'read_note']);

    // Verify recording into session history preserves new fields
    resetSessionStats();
    recordTurn(turn);
    const session = getSessionStats();
    expect(session.turns[0].toolFilter).toEqual(turn.toolFilter);
    expect(session.turns[0].reasoning).toBe(turn.reasoning);
  });

  describe('SessionStorage Turn Persistence & Merge Operations', () => {
    const originalWindow = (globalThis as any).window;

    afterEach(() => {
      if (originalWindow === undefined) {
        delete (globalThis as any).window;
      } else {
        (globalThis as any).window = originalWindow;
      }
    });

    it('exports expected SESSION_TURNS_STORAGE_KEY', () => {
      expect(SESSION_TURNS_STORAGE_KEY).toBe('frankenmcp_session_turns');
    });

    it('readSessionStorageTurns returns empty array when window is undefined', () => {
      delete (globalThis as any).window;
      expect(readSessionStorageTurns()).toEqual([]);
    });

    it('readSessionStorageTurns reads and filters valid TurnStatistics from sessionStorage', () => {
      const mockStorage: Record<string, string> = {
        [SESSION_TURNS_STORAGE_KEY]: JSON.stringify([
          {
            turnID: 'turn-client-1',
            timestamp: 1000,
            intent: 'What is 5 + 5?',
            selectedServers: ['calculator'],
            toolsLoaded: 1,
            toolsTrimmed: 4,
            estimatedTokensSaved: 120,
            routingTimeMs: 15,
            toolFilter: [{ serverID: 'calculator', includedTools: ['add'] }],
          },
          {
            // invalid turn missing toolsLoaded
            turnID: 'turn-invalid',
            toolsTrimmed: 2,
          },
        ]),
      };

      (globalThis as any).window = {
        sessionStorage: {
          getItem: (key: string) => mockStorage[key] || null,
          setItem: (key: string, val: string) => {
            mockStorage[key] = val;
          },
        },
      };

      const result = readSessionStorageTurns();
      expect(result).toHaveLength(1);
      expect(result[0].turnID).toBe('turn-client-1');
      expect(result[0].toolsLoaded).toBe(1);
    });

    it('mergeTurnsByTurnId merges and deduplicates turns by turnID, sorting by timestamp', () => {
      const serverTurn1: TurnStatistics = {
        turnID: 'turn-1',
        timestamp: 1000,
        intent: 'server intent 1',
        selectedServers: ['notes'],
        toolsLoaded: 2,
        toolsTrimmed: 3,
        estimatedTokensSaved: 100,
        routingTimeMs: 20,
        toolFilter: [{ serverID: 'notes', includedTools: ['read_note', 'create_note'] }],
      };

      const clientTurn1Updated: TurnStatistics = {
        turnID: 'turn-1', // duplicate ID
        timestamp: 1000,
        intent: 'client intent 1 updated',
        selectedServers: ['notes'],
        toolsLoaded: 2,
        toolsTrimmed: 3,
        estimatedTokensSaved: 100,
        routingTimeMs: 20,
        toolFilter: [{ serverID: 'notes', includedTools: ['read_note', 'create_note'] }],
      };

      const clientTurn2: TurnStatistics = {
        turnID: 'turn-2',
        timestamp: 2000,
        intent: 'client intent 2',
        selectedServers: ['calculator'],
        toolsLoaded: 1,
        toolsTrimmed: 4,
        estimatedTokensSaved: 200,
        routingTimeMs: 10,
        toolFilter: [{ serverID: 'calculator', includedTools: ['add'] }],
      };

      const merged = mergeTurnsByTurnId([serverTurn1], [clientTurn1Updated, clientTurn2]);
      expect(merged).toHaveLength(2);
      expect(merged.map((t) => t.turnID)).toEqual(['turn-1', 'turn-2']);
      expect(merged[0].intent).toBe('client intent 1 updated');
    });

    it('mergeSessionStats combines server and sessionStorage turns, recalculating aggregate metrics', () => {
      const initialServerStats: SessionStatistics = {
        turns: [
          {
            turnID: 'turn-srv-1',
            timestamp: 100,
            intent: 'srv query',
            selectedServers: ['notes'],
            toolsLoaded: 2,
            toolsTrimmed: 3,
            estimatedTokensSaved: 150,
            routingTimeMs: 30,
            toolFilter: [{ serverID: 'notes', includedTools: ['read_note'] }],
          },
        ],
        totalToolsLoaded: 2,
        totalToolsTrimmed: 3,
        totalTokensSaved: 150,
        averageRoutingTimeMs: 30,
      };

      const storageTurns: TurnStatistics[] = [
        {
          turnID: 'turn-cli-2',
          timestamp: 200,
          intent: 'cli query',
          selectedServers: ['calculator'],
          toolsLoaded: 1,
          toolsTrimmed: 4,
          estimatedTokensSaved: 250,
          routingTimeMs: 10,
          toolFilter: [{ serverID: 'calculator', includedTools: ['add'] }],
        },
      ];

      const mergedStats = mergeSessionStats(initialServerStats, storageTurns);
      expect(mergedStats.turns).toHaveLength(2);
      expect(mergedStats.totalToolsLoaded).toBe(3); // 2 + 1
      expect(mergedStats.totalToolsTrimmed).toBe(7); // 3 + 4
      expect(mergedStats.totalTokensSaved).toBe(400); // 150 + 250
      expect(mergedStats.averageRoutingTimeMs).toBe(20); // (30 + 10) / 2
    });

    it('mergeSessionStats returns unmodified serverStats if storageTurns is empty', () => {
      const initialServerStats: SessionStatistics = {
        turns: [],
        totalToolsLoaded: 0,
        totalToolsTrimmed: 0,
        totalTokensSaved: 0,
        averageRoutingTimeMs: 0,
      };

      const result = mergeSessionStats(initialServerStats, []);
      expect(result).toBe(initialServerStats);
    });
  });
});
