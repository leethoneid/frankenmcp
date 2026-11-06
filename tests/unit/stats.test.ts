import { describe, it, expect, beforeEach, vi } from 'vitest';
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
} from '@/lib/router/stats';
import { StatsDisplay } from '@/components/StatsDisplay';
import { TurnStatistics, ToolSchema, ServerManifest, RoutingDecision } from '@/lib/router/types';

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
    };

    recordTurn(turn1);
    expect(getRecordedTurnsCount()).toBe(1);

    const stats = getSessionStats();
    expect(stats.turns).toHaveLength(1);
    expect(stats.totalToolsLoaded).toBe(2);
    expect(stats.totalToolsTrimmed).toBe(3);
    expect(stats.totalTokensSaved).toBe(150);
    expect(stats.averageRoutingTimeMs).toBe(40);
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
});
