/**
 * Phase 8 - Task 8.2: Performance Validation Benchmark
 *
 * Requirements: NFR-1.1, NFR-1.2
 *
 * Validates real runtime performance targets without hard-coding:
 * - NFR-1.1: `getSessionStats()` with 1000 turns completes within 100ms.
 * - NFR-1.2: Time from new turn to /lab UI update is ≤500ms after poll.
 *   Driven directly via `routeIntent` script with live demo servers.
 *
 * Benchmark results are measured dynamically and logged to the console.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import path from 'path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { performance } from 'perf_hooks';
import { MCPServerManager } from '@/lib/mcp/server-manager';
import {
  startRouterProcess,
  stopRouterProcess,
  routeIntent,
  clearRoutingCache,
} from '@/lib/router/adapter';
import {
  recordTurn,
  getSessionStats,
  resetSessionStats,
} from '@/lib/router/stats';
import type { ServerManifest, TurnStatistics } from '@/lib/router/types';
import { GET as getSessionStatsRoute } from '@/app/api/lab/session-stats/route';
import TurnHistoryPanel from '@/app/lab/components/TurnHistoryPanel';
import StatsPanel from '@/app/lab/components/StatsPanel';

describe('Phase 8 - Task 8.2: Monster Lab Performance Benchmarks', () => {
  let manager: MCPServerManager;
  let manifests: ServerManifest[];

  const configPath = path.resolve(process.cwd(), '.kiro', 'settings', 'mcp.json');
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

    // Initialize MCPServerManager with 3 live demo servers
    await MCPServerManager.resetInstance();
    manager = MCPServerManager.getInstance();
    manager.loadAndRegisterConfig(configPath);
    await manager.connectAll();

    manifests = manager.getServerManifests();

    // Start live stdio router subprocess
    await startRouterProcess({
      command: 'node',
      args: [routerFixturePath],
    });
  }, 30000);

  afterAll(async () => {
    await stopRouterProcess();
    if (manager) {
      await manager.shutdown();
    }
    await MCPServerManager.resetInstance();
    resetSessionStats();
    clearRoutingCache();
  });

  it('validates NFR-1.1: calling getSessionStats() with 1000 turns completes within 100ms', () => {
    resetSessionStats();

    // Seed 1000 realistic TurnStatistics records
    const turnsToGenerate = 1000;
    const baseTimestamp = Date.now() - turnsToGenerate * 1000;

    for (let i = 0; i < turnsToGenerate; i++) {
      const turn: TurnStatistics = {
        turnID: `bench-turn-${i}`,
        timestamp: baseTimestamp + i * 1000,
        intent: `Performance benchmark query iteration ${i}`,
        selectedServers: i % 2 === 0 ? ['notes'] : ['tasks', 'calculator'],
        toolsLoaded: 5,
        toolsTrimmed: 10,
        estimatedTokensSaved: 750,
        routingTimeMs: 12 + (i % 10),
        toolFilter: [
          {
            serverID: 'notes',
            includedTools: ['add_note', 'get_notes'],
          },
        ],
        reasoning: `Selected servers for intent iteration ${i}`,
      };
      recordTurn(turn);
    }

    // Benchmark getSessionStats() execution latency across multiple iterations
    const iterations = 10;
    const durations: number[] = [];

    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      const stats = getSessionStats();
      const elapsed = performance.now() - start;
      durations.push(elapsed);

      expect(stats.turns).toHaveLength(1000);
      expect(stats.totalToolsLoaded).toBe(5000);
      expect(stats.totalToolsTrimmed).toBe(10000);
      expect(stats.totalTokensSaved).toBe(750000);
    }

    const minMs = Math.min(...durations);
    const maxMs = Math.max(...durations);
    const avgMs = durations.reduce((a, b) => a + b, 0) / durations.length;

    // Log benchmark results directly to console (truth-in-advertising)
    console.log('\n[Benchmark NFR-1.1: getSessionStats() with 1000 turns]');
    console.log(`  Iterations:  ${iterations}`);
    console.log(`  Average:     ${avgMs.toFixed(3)} ms`);
    console.log(`  Min:         ${minMs.toFixed(3)} ms`);
    console.log(`  Max:         ${maxMs.toFixed(3)} ms`);
    console.log(`  Threshold:   < 100.000 ms`);
    console.log(`  Status:      ${maxMs < 100 ? 'PASS (meets NFR-1.1)' : 'FAIL'}\n`);

    // Strict assertion: must complete within 100ms
    expect(maxMs).toBeLessThan(100);
    expect(avgMs).toBeLessThan(100);
  });

  it('validates NFR-1.2: UI update latency after routing query is <= 500ms upon poll', async () => {
    resetSessionStats();

    // 1. Execute real routing intent using routeIntent to produce a new turn
    const uniqueQuery = `Calculate benchmark invoice total: ${Date.now()}`;
    const routingDecision = await routeIntent(uniqueQuery, manifests, {
      bypassCache: true,
    });

    expect(routingDecision.selectedServers).toContain('calculator');

    // 2. Measure time from poll trigger to UI update (rendering /lab panels with the new turn)
    const pollStart = performance.now();

    // Simulate client poll to /api/lab/session-stats
    const pollResponse = await getSessionStatsRoute();
    expect(pollResponse.status).toBe(200);

    const data = await pollResponse.json();
    expect(data.stats).toBeDefined();
    expect(data.stats.turns.length).toBeGreaterThanOrEqual(1);

    const latestTurn = data.stats.turns[data.stats.turns.length - 1];
    expect(latestTurn.intent).toBe(uniqueQuery);

    // Simulate UI component update with newly polled data
    const allServerTools = new Map<string, string[]>();
    for (const m of manifests) {
      allServerTools.set(m.id, m.tools.map((t) => t.name));
    }

    const renderedTurnsHtml = renderToStaticMarkup(
      React.createElement(TurnHistoryPanel, {
        initialTurns: data.stats.turns,
        allServerTools,
      })
    );

    const renderedStatsHtml = renderToStaticMarkup(
      React.createElement(StatsPanel, {
        initialStats: data.stats,
      })
    );

    const pollToUiDurationMs = performance.now() - pollStart;

    // Verify UI reflects the new turn and updated stats
    expect(renderedTurnsHtml).toContain(uniqueQuery.slice(0, 50));
    expect(renderedStatsHtml).toContain('Tools Loaded');

    // Log benchmark results directly to console (truth-in-advertising)
    console.log('\n[Benchmark NFR-1.2: UI update latency after poll]');
    console.log(`  Query:       "${uniqueQuery}"`);
    console.log(`  Poll -> UI:  ${pollToUiDurationMs.toFixed(3)} ms`);
    console.log(`  Threshold:   <= 500.000 ms`);
    console.log(`  Status:      ${pollToUiDurationMs <= 500 ? 'PASS (meets NFR-1.2)' : 'FAIL'}\n`);

    // Strict assertion: latency must be <= 500ms
    expect(pollToUiDurationMs).toBeLessThanOrEqual(500);
  });
});
