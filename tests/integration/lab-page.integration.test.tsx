import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import * as statsModule from '@/lib/router/stats';
import { MCPServerManager } from '@/lib/mcp/server-manager';
import type { SessionStatistics, ServerManifest, TurnStatistics } from '@/lib/router/types';

// Mock the three panel components that will be built in Phase 5 and Phase 6
vi.mock('@/app/lab/components/StatsPanel', () => ({
  default: ({ initialStats }: { initialStats: SessionStatistics }) => (
    <div data-testid="stats-panel">
      StatsPanel: loaded={initialStats?.totalToolsLoaded}
    </div>
  ),
}));

vi.mock('@/app/lab/components/TurnHistoryPanel', () => ({
  default: ({ initialTurns }: { initialTurns: TurnStatistics[] }) => (
    <div data-testid="turn-history-panel">
      TurnHistoryPanel: count={initialTurns?.length}
    </div>
  ),
}));

vi.mock('@/app/lab/components/ServerHealthPanel', () => ({
  default: ({ initialManifests }: { initialManifests: ServerManifest[] }) => (
    <div data-testid="server-health-panel">
      ServerHealthPanel: count={initialManifests?.length}
    </div>
  ),
}));

// Import LabPage after the mocks are defined
import LabPage from '@/app/lab/page';

describe('Phase 4 - Task 4.1: Lab Page Integration Tests', () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    statsModule.resetSessionStats();
    await MCPServerManager.resetInstance();
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    statsModule.resetSessionStats();
    await MCPServerManager.resetInstance();
  });

  it('renders dashboard with dark theme header and initial data when getSessionStats succeeds', async () => {
    const turn: TurnStatistics = {
      turnID: 'turn-lab-1',
      intent: 'check tasks and calculate budget',
      timestamp: Date.now(),
      toolsLoaded: 4,
      toolsTrimmed: 6,
      estimatedTokensSaved: 1100,
      routingTimeMs: 25,
      selectedServers: ['tasks', 'calculator'],
      toolFilter: [
        { serverID: 'tasks', includedTools: ['list_tasks'] },
        { serverID: 'calculator', includedTools: ['add'] },
      ],
      reasoning: 'Routing to tasks and calculator servers',
    };

    statsModule.recordTurn(turn);

    const manager = MCPServerManager.getInstance();
    manager.registerServer({
      id: 'mock-notes',
      name: 'Mock Notes Server',
      transport: 'stdio',
      command: 'echo',
    });

    const pageElement = await LabPage();
    const html = renderToStaticMarkup(pageElement);

    // Verify header and styling
    expect(html).toContain('🧪 Monster Lab Dashboard');
    expect(html).toContain('text-green-400');
    expect(html).toContain('bg-gray-950');

    // Verify sub-components rendered with initial data
    expect(html).toContain('StatsPanel: loaded=4');
    expect(html).toContain('TurnHistoryPanel: count=1');
    expect(html).toContain('ServerHealthPanel: count=1');

    // Verify error fallback is NOT rendered
    expect(html).not.toContain('Stats Unavailable');
  });

  it('catches getSessionStats error gracefully, renders ErrorFallback, and still renders ServerHealthPanel', async () => {
    vi.spyOn(statsModule, 'getSessionStats').mockImplementation(() => {
      throw new Error('In-memory session state corrupted or unavailable');
    });

    const manager = MCPServerManager.getInstance();
    manager.registerServer({
      id: 'mock-tasks',
      name: 'Mock Tasks Server',
      transport: 'stdio',
      command: 'echo',
    });

    // Should not throw
    const pageElement = await LabPage();
    const html = renderToStaticMarkup(pageElement);

    // Verify header still renders
    expect(html).toContain('🧪 Monster Lab Dashboard');

    // Verify ErrorFallback is rendered
    expect(html).toContain('Stats Unavailable');
    expect(html).toContain('Unable to load routing statistics. Please check server logs.');

    // Verify stats panels are not rendered
    expect(html).not.toContain('StatsPanel:');
    expect(html).not.toContain('TurnHistoryPanel:');

    // Verify ServerHealthPanel is still rendered
    expect(html).toContain('ServerHealthPanel: count=1');
  });
});
