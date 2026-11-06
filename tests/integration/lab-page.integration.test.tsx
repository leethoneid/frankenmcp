import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import * as statsModule from '@/lib/router/stats';
import { MCPServerManager } from '@/lib/mcp/server-manager';
import type { TurnStatistics } from '@/lib/router/types';
import LabPage from '@/app/lab/page';

describe('Phase 4 & 6 - Lab Page Integration Tests', () => {
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

    // Verify real StatsPanel rendered
    expect(html).toContain('Tools Loaded');
    expect(html).toContain('4');
    expect(html).toContain('Tools Trimmed');
    expect(html).toContain('6');

    // Verify real TurnHistoryPanel rendered with turn
    expect(html).toContain('Turn History (1 turn)');
    expect(html).toContain('check tasks and calculate budget');

    // Verify real ServerHealthPanel rendered with registered server
    expect(html).toContain('MCP Server Health');
    expect(html).toContain('Mock Notes Server');

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
    expect(html).not.toContain('Tools Loaded');
    expect(html).not.toContain('Turn History');

    // Verify real ServerHealthPanel is still rendered
    expect(html).toContain('MCP Server Health');
    expect(html).toContain('Mock Tasks Server');
  });
});
