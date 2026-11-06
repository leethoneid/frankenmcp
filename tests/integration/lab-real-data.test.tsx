import React from 'react';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import path from 'path';
import { renderToStaticMarkup } from 'react-dom/server';
import { MCPServerManager } from '@/lib/mcp/server-manager';
import {
  startRouterProcess,
  stopRouterProcess,
  routeIntent,
  clearRoutingCache,
} from '@/lib/router/adapter';
import { resetSessionStats, getSessionStats } from '@/lib/router/stats';
import type { ServerManifest } from '@/lib/router/types';
import LabPage from '@/app/lab/page';
import { GET as getSessionStatsRoute } from '@/app/api/lab/session-stats/route';
import { GET as getServerStatusRoute } from '@/app/api/lab/server-status/route';

describe('Phase 7 - Task 7.1: Real-Data Integration Test', () => {
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
    expect(totalTools).toBe(15); // 5 tools per server

    // 3. Spawn real stdio router subprocess
    await startRouterProcess({
      command: 'node',
      args: [routerFixturePath],
    });
  }, 30000);

  afterAll(async () => {
    // Teardown: terminate all subprocesses cleanly
    await stopRouterProcess();
    await manager.shutdown();
    await MCPServerManager.resetInstance();
    resetSessionStats();
    clearRoutingCache();
  });

  it('records 3 real turns without mocks, renders /lab, and validates exact displayed metrics match getSessionStats()', async () => {
    // Act: Record 3 real routing turns using actual routeIntent (which auto-records turns to session stats)
    const turn1 = await routeIntent('Add a note about the meeting', manifests, {
      bypassCache: true,
    });
    expect(turn1.selectedServers).toContain('notes');

    const turn2 = await routeIntent('Show my active tasks', manifests, {
      bypassCache: true,
    });
    expect(turn2.selectedServers).toContain('tasks');

    const turn3 = await routeIntent('Calculate 128 * 4', manifests, {
      bypassCache: true,
    });
    expect(turn3.selectedServers).toContain('calculator');

    // Retrieve live session statistics
    const sessionStats = getSessionStats();
    expect(sessionStats.turns).toHaveLength(3);
    expect(sessionStats.totalToolsLoaded).toBeGreaterThan(0);
    expect(sessionStats.totalToolsTrimmed).toBeGreaterThan(0);
    expect(sessionStats.totalTokensSaved).toBeGreaterThan(0);
    expect(sessionStats.averageRoutingTimeMs).toBeGreaterThan(0);

    // Act: Render /lab page server-side without any mocks
    const pageElement = await LabPage();
    const html = renderToStaticMarkup(pageElement);

    // Extract displayed numbers from rendered output
    const toolsLoadedMatch = html.match(
      /Tools Loaded<\/div><div class="text-4xl font-bold text-green-400">(\d+)<\/div>/
    );
    expect(toolsLoadedMatch).not.toBeNull();
    const displayedToolsLoaded = parseInt(toolsLoadedMatch![1], 10);

    const toolsTrimmedMatch = html.match(
      /Tools Trimmed<\/div><div class="text-4xl font-bold text-purple-400">(\d+)<\/div>/
    );
    expect(toolsTrimmedMatch).not.toBeNull();
    const displayedToolsTrimmed = parseInt(toolsTrimmedMatch![1], 10);

    const tokensSavedMatch = html.match(
      /Tokens Saved<\/div><div class="text-4xl font-bold text-cyan-400">~([\d,]+)<\/div>/
    );
    expect(tokensSavedMatch).not.toBeNull();
    const displayedTokensSaved = parseInt(tokensSavedMatch![1].replace(/,/g, ''), 10);

    const avgTimeMatch = html.match(
      /Avg Routing Time<\/div><div class="text-4xl font-bold text-yellow-400">([\d.]+)<\/div>/
    );
    expect(avgTimeMatch).not.toBeNull();
    const displayedAvgTime = parseFloat(avgTimeMatch![1]);

    // Assert: Exact equality between displayed numbers and getSessionStats() output (AC-7, NFR-4.1)
    expect(displayedToolsLoaded).toBe(sessionStats.totalToolsLoaded);
    expect(displayedToolsTrimmed).toBe(sessionStats.totalToolsTrimmed);
    expect(displayedTokensSaved).toBe(sessionStats.totalTokensSaved);
    expect(displayedAvgTime).toBe(sessionStats.averageRoutingTimeMs);

    // Verify TurnHistoryPanel displays all 3 turns and singular/plural header
    expect(html).toContain('Turn History (3 turns)');
    expect(html).toContain('Add a note about the meeting');
    expect(html).toContain('Show my active tasks');
    expect(html).toContain('Calculate 128 * 4');

    // Verify ServerHealthPanel displays all 3 demo servers as connected
    expect(html).toContain('MCP Server Health');
    expect(html).toContain('notes');
    expect(html).toContain('tasks');
    expect(html).toContain('calculator');
    expect(html).not.toContain('All servers offline');

    // Verify live API route parity (/api/lab/session-stats)
    const statsApiResponse = await getSessionStatsRoute();
    expect(statsApiResponse.status).toBe(200);
    const statsApiData = await statsApiResponse.json();
    expect(statsApiData.stats.totalToolsLoaded).toBe(sessionStats.totalToolsLoaded);
    expect(statsApiData.stats.totalToolsTrimmed).toBe(sessionStats.totalToolsTrimmed);
    expect(statsApiData.stats.totalTokensSaved).toBe(sessionStats.totalTokensSaved);

    // Verify live API route parity (/api/lab/server-status)
    const serverApiResponse = await getServerStatusRoute();
    expect(serverApiResponse.status).toBe(200);
    const serverApiData = await serverApiResponse.json();
    expect(serverApiData.manifests).toHaveLength(3);
    expect(serverApiData.manifests.every((m: ServerManifest) => m.status === 'connected')).toBe(true);
  }, 35000);
});
