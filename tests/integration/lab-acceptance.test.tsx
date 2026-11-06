import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import path from 'path';
import { renderToStaticMarkup } from 'react-dom/server';
import { MCPServerManager } from '@/lib/mcp/server-manager';
import * as statsModule from '@/lib/router/stats';
import type { ServerManifest, TurnStatistics } from '@/lib/router/types';
import LabPage from '@/app/lab/page';

describe('Phase 7 - Task 7.4: Acceptance Criteria (AC-1 to AC-7) Validation', () => {
  let manager: MCPServerManager;
  const configPath = path.resolve(process.cwd(), '.kiro', 'settings', 'mcp.json');

  beforeEach(async () => {
    statsModule.resetSessionStats();
    await MCPServerManager.resetInstance();
  });

  afterEach(async () => {
    statsModule.resetSessionStats();
    if (manager) {
      await manager.shutdown();
    }
    await MCPServerManager.resetInstance();
  });

  it('validates AC-1: User can navigate to /lab and see dashboard even with zero turns completed', async () => {
    manager = MCPServerManager.getInstance();
    manager.loadAndRegisterConfig(configPath);

    // Initial state: 0 turns completed
    expect(statsModule.getSessionStats().turns).toHaveLength(0);

    const pageElement = await LabPage();
    const html = renderToStaticMarkup(pageElement);

    expect(html).toContain('🧪 Monster Lab Dashboard');
    expect(html).toContain('Tools Loaded');
    expect(html).toContain('0');
    expect(html).toContain('No routing decisions yet. Submit a query in the Playground to see statistics.');
  });

  it('validates AC-2: After submitting query, refreshing /lab shows the new turn statistics', async () => {
    manager = MCPServerManager.getInstance();
    manager.loadAndRegisterConfig(configPath);

    // Simulate query submission in Playground
    const newTurn: TurnStatistics = {
      turnID: 'turn-ac2-test',
      intent: 'List all active tasks',
      timestamp: Date.now(),
      selectedServers: ['tasks'],
      toolsLoaded: 1,
      toolsTrimmed: 4,
      estimatedTokensSaved: 160,
      routingTimeMs: 12,
      toolFilter: [{ serverID: 'tasks', includedTools: ['list_tasks'] }],
      reasoning: 'Routing to tasks server for list_tasks',
    };
    statsModule.recordTurn(newTurn);

    // Render /lab
    const pageElement = await LabPage();
    const html = renderToStaticMarkup(pageElement);

    expect(html).toContain('Turn History (1 turn)');
    expect(html).toContain('List all active tasks');
    expect(html).toContain('1 loaded');
    expect(html).toContain('4 trimmed');
    expect(html).toContain('~160 tokens saved');
  });

  it('validates AC-3: Dashboard displays accurate server health status with 3 demo servers connected on first load', async () => {
    manager = MCPServerManager.getInstance();
    manager.loadAndRegisterConfig(configPath);
    await manager.connectAll();

    expect(manager.getServerStatus('notes')).toBe('connected');
    expect(manager.getServerStatus('tasks')).toBe('connected');
    expect(manager.getServerStatus('calculator')).toBe('connected');

    const pageElement = await LabPage();
    const html = renderToStaticMarkup(pageElement);

    expect(html).toContain('MCP Server Health');
    expect(html).toContain('notes');
    expect(html).toContain('tasks');
    expect(html).toContain('calculator');
    expect(html).not.toContain('⚠️ All servers offline');
  }, 20000);

  it('validates AC-4: When a server is manually disconnected, dashboard reflects error within 10s', async () => {
    manager = MCPServerManager.getInstance();
    manager.registerServer({
      id: 'ac4-notes-server',
      name: 'AC-4 Notes Server',
      transport: 'stdio',
      command: 'node',
      args: [path.resolve(process.cwd(), 'src', 'mcp-servers', 'notes', 'index.mjs')],
    });

    await manager.connectServer('ac4-notes-server');
    expect(manager.getServerStatus('ac4-notes-server')).toBe('connected');

    // Simulate kill
    const entry = (manager as unknown as {
      servers: Map<string, { client: { transport?: { _process?: { kill: (signal: string) => void } } } }>;
    }).servers.get('ac4-notes-server');
    const childProc = entry?.client?.transport?._process;
    expect(childProc).toBeDefined();

    childProc!.kill('SIGTERM');

    // Active health check round detects failure
    await manager.runHealthCheckRound();

    const manifests = manager.getServerManifests();
    const killedManifest = manifests.find((m) => m.id === 'ac4-notes-server')!;
    expect(killedManifest.status).toBe('error');
    expect(Date.now() - killedManifest.lastStatusChangeAt!).toBeLessThanOrEqual(10000);

    const pageElement = await LabPage();
    const html = renderToStaticMarkup(pageElement);
    expect(html).toContain('AC-4 Notes Server');
    expect(html).toContain('Offline for');
  }, 20000);

  it('validates AC-5: When getSessionStats() throws an error, dashboard displays Stats unavailable instead of crashing', async () => {
    const errorSpy = vi.spyOn(statsModule, 'getSessionStats').mockImplementation(() => {
      throw new Error('Simulated memory corruption');
    });

    // LabPage execution must not throw
    const pageElement = await LabPage();
    const html = renderToStaticMarkup(pageElement);

    expect(html).toContain('Stats Unavailable');
    expect(html).toContain('Unable to load routing statistics. Please check server logs.');
    expect(html).not.toContain('Turn History');

    errorSpy.mockRestore();
  });

  it('validates AC-6: Visual design uses dark theme with lab aesthetics (green/purple accents, prominent numbers)', async () => {
    manager = MCPServerManager.getInstance();
    const pageElement = await LabPage();
    const html = renderToStaticMarkup(pageElement);

    // Dark theme classes
    expect(html).toContain('bg-gray-950');
    expect(html).toContain('text-gray-100');

    // Lab green and purple accents
    expect(html).toContain('text-green-400');
    expect(html).toContain('border-green-900/30');
    expect(html).toContain('text-purple-400');

    // Prominent metrics text-4xl
    expect(html).toContain('text-4xl font-bold');
  });

  it('validates AC-7: All displayed numbers match getSessionStats() output', async () => {
    statsModule.recordTurn({
      turnID: 'ac7-turn-1',
      intent: 'test turn 1',
      timestamp: Date.now(),
      selectedServers: ['notes'],
      toolsLoaded: 2,
      toolsTrimmed: 3,
      estimatedTokensSaved: 140,
      routingTimeMs: 18,
      toolFilter: [{ serverID: 'notes', includedTools: ['read_note', 'create_note'] }],
    });

    statsModule.recordTurn({
      turnID: 'ac7-turn-2',
      intent: 'test turn 2',
      timestamp: Date.now(),
      selectedServers: ['calculator'],
      toolsLoaded: 1,
      toolsTrimmed: 4,
      estimatedTokensSaved: 210,
      routingTimeMs: 22,
      toolFilter: [{ serverID: 'calculator', includedTools: ['add'] }],
    });

    const stats = statsModule.getSessionStats();

    const pageElement = await LabPage();
    const html = renderToStaticMarkup(pageElement);

    expect(html).toContain(`>${stats.totalToolsLoaded}<`);
    expect(html).toContain(`>${stats.totalToolsTrimmed}<`);
    expect(html).toContain(`>~${stats.totalTokensSaved.toLocaleString()}<`);
    expect(html).toContain(`>${stats.averageRoutingTimeMs}<`);
  });
});
