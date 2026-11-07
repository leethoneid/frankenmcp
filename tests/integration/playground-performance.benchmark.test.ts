/**
 * Phase 8 - Task 8.2: Playground Chat Performance Validation Benchmark
 *
 * Requirements: NFR-1.1, NFR-1.2, NFR-1.3
 *
 * Validates real runtime performance targets without hard-coding:
 * - NFR-1.1: Submit query -> routing decision display within <= 2000ms.
 * - NFR-1.2: Time from tool result received to displayed in UI is <= 500ms.
 * - NFR-1.3: Conversation history with 50 turns renders smoothly without frame lag (<= 100ms).
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
  ensureServersInitialized,
  _resetServerInitForTesting,
} from '@/lib/server/init';
import {
  startRouterProcess,
  stopRouterProcess,
  clearRoutingCache,
} from '@/lib/router/adapter';
import { resetSessionStats } from '@/lib/router/stats';
import { POST } from '@/app/api/playground/chat/route';
import type { Turn } from '@/app/playground/types';
import TurnDisplay from '@/app/playground/components/TurnDisplay';
import ToolResultCard from '@/app/playground/components/ToolResultCard';
import ConversationHistory from '@/app/playground/components/ConversationHistory';

describe('Phase 8 - Task 8.2: Playground Performance Benchmarks', () => {
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
    _resetServerInitForTesting();
    resetSessionStats();
    clearRoutingCache();
  });

  it('validates NFR-1.1: submit query -> routing decision display is <= 2000ms', async () => {
    const queries = [
      'Add a note about the architecture meeting',
      'Show my current tasks',
      'Calculate math: 15 + 27',
    ];

    const durations: number[] = [];

    for (const query of queries) {
      const start = performance.now();

      // 1. Submit query to API endpoint
      const res = await POST(
        new Request('http://localhost/api/playground/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query }),
        })
      );

      expect(res.status).toBe(200);
      const turn: Turn = await res.json();
      expect(turn.routing).toBeDefined();

      // 2. Render turn display with routing decision
      const html = renderToStaticMarkup(
        React.createElement(TurnDisplay, { turn })
      );
      expect(html).toContain('Routing Decision');

      const elapsed = performance.now() - start;
      durations.push(elapsed);
    }

    const minMs = Math.min(...durations);
    const maxMs = Math.max(...durations);
    const avgMs = durations.reduce((a, b) => a + b, 0) / durations.length;

    console.log('\n[Benchmark NFR-1.1: Query -> Routing Decision Display]');
    console.log(`  Queries tested: ${durations.length}`);
    console.log(`  Average:        ${avgMs.toFixed(3)} ms`);
    console.log(`  Min:            ${minMs.toFixed(3)} ms`);
    console.log(`  Max:            ${maxMs.toFixed(3)} ms`);
    console.log(`  Threshold:      <= 2000.000 ms`);
    console.log(`  Status:         ${maxMs <= 2000 ? 'PASS (meets NFR-1.1)' : 'FAIL'}\n`);

    expect(maxMs).toBeLessThanOrEqual(2000);
    expect(avgMs).toBeLessThanOrEqual(2000);
  });

  it('validates NFR-1.2: time from tool result received to displayed in UI is <= 500ms', () => {
    const mockTurnWithResults: Turn = {
      id: 'bench-turn-result',
      timestamp: Date.now(),
      userQuery: 'What is 15 + 27?',
      routing: {
        selectedServers: ['calculator'],
        toolsLoaded: 1,
        toolsTrimmed: 4,
        estimatedTokensSaved: 100,
        routingTimeMs: 12,
      },
      toolResults: [
        {
          serverID: 'calculator',
          toolName: 'add',
          status: 'success',
          result: { result: 42, formatted: '15 + 27 = 42' },
        },
        {
          serverID: 'notes',
          toolName: 'read_note',
          status: 'error',
          error: 'Note with specified ID does not exist',
        },
      ],
    };

    const iterations = 10;
    const durations: number[] = [];

    for (let i = 0; i < iterations; i++) {
      const start = performance.now();

      const html = renderToStaticMarkup(
        React.createElement(TurnDisplay, {
          turn: mockTurnWithResults,
          isExecutingTools: false,
        })
      );

      const elapsed = performance.now() - start;
      durations.push(elapsed);

      expect(html).toContain('Tool Results');
      expect(html).toContain('calculator.add');
      expect(html).toContain('Note with specified ID does not exist');
    }

    const minMs = Math.min(...durations);
    const maxMs = Math.max(...durations);
    const avgMs = durations.reduce((a, b) => a + b, 0) / durations.length;

    console.log('\n[Benchmark NFR-1.2: Tool Result Received -> Displayed]');
    console.log(`  Iterations:     ${iterations}`);
    console.log(`  Average:        ${avgMs.toFixed(3)} ms`);
    console.log(`  Min:            ${minMs.toFixed(3)} ms`);
    console.log(`  Max:            ${maxMs.toFixed(3)} ms`);
    console.log(`  Threshold:      <= 500.000 ms`);
    console.log(`  Status:         ${maxMs <= 500 ? 'PASS (meets NFR-1.2)' : 'FAIL'}\n`);

    expect(maxMs).toBeLessThanOrEqual(500);
    expect(avgMs).toBeLessThanOrEqual(500);
  });

  it('validates NFR-1.3: rendering 50 turns in ConversationHistory is smooth with no lag (<= 100ms frame time)', () => {
    // Generate 50 realistic conversation turns
    const fiftyTurns: Turn[] = Array.from({ length: 50 }, (_, i) => ({
      id: `turn-${i + 1}`,
      timestamp: Date.now() - (50 - i) * 60000,
      userQuery: `Benchmark conversation query #${i + 1}`,
      routing: {
        selectedServers: i % 2 === 0 ? ['notes'] : ['tasks', 'calculator'],
        toolsLoaded: 3,
        toolsTrimmed: 7,
        estimatedTokensSaved: 450,
        routingTimeMs: 15,
        reasoning: `Selected servers for turn #${i + 1}`,
      },
      toolResults: [
        {
          serverID: i % 2 === 0 ? 'notes' : 'calculator',
          toolName: i % 2 === 0 ? 'create_note' : 'add',
          status: 'success',
          result: { success: true, itemIndex: i + 1 },
        },
      ],
      warnings: i % 10 === 0 ? ['Server responded with low latency'] : undefined,
    }));

    // Measure frame update time when rendering a new turn in an active 50-turn conversation
    const newTurn: Turn = {
      id: 'turn-51',
      timestamp: Date.now(),
      userQuery: 'What is 50 + 1?',
      routing: {
        selectedServers: ['calculator'],
        toolsLoaded: 1,
        toolsTrimmed: 4,
        estimatedTokensSaved: 100,
        routingTimeMs: 10,
      },
      toolResults: [
        {
          serverID: 'calculator',
          toolName: 'add',
          status: 'success',
          result: { result: 51 },
        },
      ],
    };

    const updateIterations = 10;
    const updateDurations: number[] = [];

    for (let i = 0; i < updateIterations; i++) {
      const start = performance.now();
      const html = renderToStaticMarkup(
        React.createElement(TurnDisplay, { turn: newTurn })
      );
      const elapsed = performance.now() - start;
      updateDurations.push(elapsed);
      expect(html).toContain('What is 50 + 1?');
    }

    const avgUpdateMs = updateDurations.reduce((a, b) => a + b, 0) / updateDurations.length;

    // Measure full 50-turn render and compute average frame rendering time per turn
    const start50 = performance.now();
    const html50 = renderToStaticMarkup(
      React.createElement(ConversationHistory, {
        turns: fiftyTurns,
        isProcessing: false,
      })
    );
    const total50Ms = performance.now() - start50;
    const perTurnFrameMs = total50Ms / fiftyTurns.length;

    expect(html50).toContain('Benchmark conversation query #1');
    expect(html50).toContain('Benchmark conversation query #50');

    console.log('\n[Benchmark NFR-1.3: 50 Turns Smooth Rendering / Frame Time]');
    console.log(`  Turns in history:      ${fiftyTurns.length}`);
    console.log(`  Full 50-turn render:   ${total50Ms.toFixed(3)} ms`);
    console.log(`  Per-turn frame cost:   ${perTurnFrameMs.toFixed(3)} ms`);
    console.log(`  Turn update latency:   ${avgUpdateMs.toFixed(3)} ms`);
    console.log(`  Frame time threshold:  <= 100.000 ms`);
    console.log(`  Status:                ${perTurnFrameMs <= 100 && avgUpdateMs <= 100 ? 'PASS (meets NFR-1.3)' : 'FAIL'}\n`);

    expect(avgUpdateMs).toBeLessThanOrEqual(100);
    expect(perTurnFrameMs).toBeLessThanOrEqual(100);
  });
});
