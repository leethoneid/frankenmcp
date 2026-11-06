/**
 * Phase 7 - Task 7.1: Full Routing Flow Integration & End-to-End Test
 *
 * Requirements: AC-2, NFR-1.1, NFR-3.1
 *
 * This test validates the entire end-to-end execution pipeline with zero mocks:
 * 1. Spawns all three pre-configured demo servers (notes, tasks, calculator) as real Node stdio MCP subprocesses.
 * 2. Spawns the MCP dynamic router as a real stdio subprocess.
 * 3. Routes real natural language user intents to the appropriate servers and tools.
 * 4. Invokes the selected tools on the live subprocess servers and asserts on real responses.
 * 5. Asserts accurate per-turn and session-wide statistics (toolsLoaded, toolsTrimmed, estimatedTokensSaved).
 * 6. Guarantees clean teardown of all subprocesses without process leaks.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import path from 'path';
import { MCPServerManager } from '@/lib/mcp/server-manager';
import {
  startRouterProcess,
  stopRouterProcess,
  routeIntent,
  clearRoutingCache,
} from '@/lib/router/adapter';
import { resetSessionStats, getSessionStats } from '@/lib/router/stats';
import { ServerManifest, TurnStatistics } from '@/lib/router/types';

describe('Phase 7 - Task 7.1: Full Routing Flow End-to-End Integration', () => {
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

    // 1. Initialize ServerManager with live demo servers configured in .kiro/settings/mcp.json
    await MCPServerManager.resetInstance();
    manager = MCPServerManager.getInstance();
    manager.loadAndRegisterConfig(configPath);

    // 2. Connect all three demo servers in parallel (spawns real Node.js child processes)
    await manager.connectAll();

    expect(manager.getServerStatus('notes')).toBe('connected');
    expect(manager.getServerStatus('tasks')).toBe('connected');
    expect(manager.getServerStatus('calculator')).toBe('connected');

    manifests = manager.getServerManifests();
    expect(manifests).toHaveLength(3);
    const totalTools = manifests.reduce((sum, m) => sum + m.tools.length, 0);
    expect(totalTools).toBe(15); // 5 per server

    // 3. Spawn real stdio router subprocess
    await startRouterProcess({
      command: 'node',
      args: [routerFixturePath],
    });
  }, 30000);

  afterAll(async () => {
    // 6. Clean teardown of all subprocesses
    await stopRouterProcess();
    if (manager) {
      await manager.shutdown();
    }
    await MCPServerManager.resetInstance();
    clearRoutingCache();
  }, 15000);

  it('routes "Add a note about the meeting" -> selects notes server, create_note tool, and executes tool', async () => {
    let recordedStats: TurnStatistics | null = null;

    // Act: Route intent to notes server
    const decision = await routeIntent('Add a note about the meeting', manifests, {
      bypassCache: true,
      onTurnRecorded: (stats) => {
        recordedStats = stats;
      },
    });

    // Assert: Router correctly selected notes server and create_note tool
    expect(decision.selectedServers).toContain('notes');
    const notesFilter = decision.toolFilter.find((f) => f.serverID === 'notes');
    expect(notesFilter).toBeDefined();
    expect(notesFilter?.includedTools).toContain('create_note');
    expect(decision.reasoning).toBeDefined();

    // Act: Invoke the selected tool on the real notes server subprocess
    const toolResult = (await manager.invokeToolCall('notes', 'create_note', {
      title: 'Meeting Notes',
      content: 'Discussion regarding Kiroween hackathon roadmap',
    })) as { content: Array<{ type: string; text: string }> };

    expect(toolResult.content).toBeDefined();
    expect(toolResult.content[0].type).toBe('text');
    const parsedRes = JSON.parse(toolResult.content[0].text);
    expect(parsedRes.id).toBeDefined();

    // Verify turn statistics
    expect(recordedStats).not.toBeNull();
    expect(recordedStats!.toolsLoaded).toBe(notesFilter!.includedTools.length);
    // toolsTrimmed: total tools in notes server (5) - toolsLoaded
    expect(recordedStats!.toolsTrimmed).toBe(5 - notesFilter!.includedTools.length);
    expect(recordedStats!.toolsTrimmed).toBeGreaterThan(0);
    expect(recordedStats!.estimatedTokensSaved).toBeGreaterThan(0);
  }, 15000);

  it('routes "Show my tasks" -> selects tasks server, list_tasks tool, and retrieves demo tasks', async () => {
    let recordedStats: TurnStatistics | null = null;

    // Act: Route intent to tasks server
    const decision = await routeIntent('Show my tasks', manifests, {
      bypassCache: true,
      onTurnRecorded: (stats) => {
        recordedStats = stats;
      },
    });

    // Assert: Router correctly selected tasks server and list_tasks tool
    expect(decision.selectedServers).toContain('tasks');
    const tasksFilter = decision.toolFilter.find((f) => f.serverID === 'tasks');
    expect(tasksFilter).toBeDefined();
    expect(tasksFilter?.includedTools).toContain('list_tasks');

    // Act: Invoke the selected tool on the real tasks server subprocess
    const toolResult = (await manager.invokeToolCall('tasks', 'list_tasks', {})) as {
      content: Array<{ type: string; text: string }>;
    };

    expect(toolResult.content).toBeDefined();
    const parsedRes = JSON.parse(toolResult.content[0].text);
    expect(Array.isArray(parsedRes.tasks)).toBe(true);
    expect(parsedRes.tasks.length).toBeGreaterThanOrEqual(5);

    // Verify turn statistics
    expect(recordedStats).not.toBeNull();
    expect(recordedStats!.toolsLoaded).toBe(tasksFilter!.includedTools.length);
    expect(recordedStats!.toolsTrimmed).toBe(5 - tasksFilter!.includedTools.length);
    expect(recordedStats!.toolsTrimmed).toBeGreaterThan(0);
    expect(recordedStats!.estimatedTokensSaved).toBeGreaterThan(0);
  }, 15000);

  it('routes "Calculate 15 + 27" -> selects calculator server, add tool, and verifies result 42', async () => {
    let recordedStats: TurnStatistics | null = null;

    // Act: Route intent to calculator server
    const decision = await routeIntent('Calculate 15 + 27', manifests, {
      bypassCache: true,
      onTurnRecorded: (stats) => {
        recordedStats = stats;
      },
    });

    // Assert: Router correctly selected calculator server and add tool
    expect(decision.selectedServers).toContain('calculator');
    const calcFilter = decision.toolFilter.find((f) => f.serverID === 'calculator');
    expect(calcFilter).toBeDefined();
    expect(calcFilter?.includedTools).toContain('add');

    // Act: Invoke the selected tool on the real calculator server subprocess
    const toolResult = (await manager.invokeToolCall('calculator', 'add', {
      a: 15,
      b: 27,
    })) as { content: Array<{ type: string; text: string }> };

    expect(toolResult.content).toBeDefined();
    const parsedRes = JSON.parse(toolResult.content[0].text);
    expect(parsedRes.result).toBe(42);

    // Verify turn statistics
    expect(recordedStats).not.toBeNull();
    expect(recordedStats!.toolsLoaded).toBe(1);
    expect(recordedStats!.toolsTrimmed).toBe(4); // 5 calculator tools - 1 loaded = 4 trimmed
    expect(recordedStats!.estimatedTokensSaved).toBeGreaterThan(0);
  }, 15000);

  it('aggregates all turns into session statistics with non-zero token savings and valid latency', () => {
    const session = getSessionStats();

    expect(session.turns.length).toBeGreaterThanOrEqual(3);
    expect(session.totalToolsLoaded).toBeGreaterThan(0);
    expect(session.totalToolsTrimmed).toBeGreaterThan(0);
    expect(session.totalTokensSaved).toBeGreaterThan(0);
    expect(session.averageRoutingTimeMs).toBeGreaterThanOrEqual(0);

    const calculatedTotalLoaded = session.turns.reduce((sum, t) => sum + t.toolsLoaded, 0);
    const calculatedTotalTrimmed = session.turns.reduce((sum, t) => sum + t.toolsTrimmed, 0);
    const calculatedTotalTokens = session.turns.reduce((sum, t) => sum + t.estimatedTokensSaved, 0);

    expect(session.totalToolsLoaded).toBe(calculatedTotalLoaded);
    expect(session.totalToolsTrimmed).toBe(calculatedTotalTrimmed);
    expect(session.totalTokensSaved).toBe(calculatedTotalTokens);
  });
});
