import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'path';
import { MCPServerManager } from '@/lib/mcp/server-manager';
import { recordTurn, resetSessionStats } from '@/lib/router/stats';
import { GET as getSessionStatsRoute } from '@/app/api/lab/session-stats/route';
import { GET as getServerStatusRoute } from '@/app/api/lab/server-status/route';
import type { TurnStatistics, ServerManifest } from '@/lib/router/types';

describe('Phase 2 - Lab API Routes Integration Tests', () => {
  beforeEach(async () => {
    resetSessionStats();
    await MCPServerManager.resetInstance();
  });

  afterEach(async () => {
    resetSessionStats();
    await MCPServerManager.resetInstance();
  });

  it('Task 2.1: returns live session statistics through GET /api/lab/session-stats', async () => {
    const turn: TurnStatistics = {
      turnID: 'turn-int-1',
      intent: 'fetch notes and save something',
      timestamp: Date.now(),
      toolsLoaded: 3,
      toolsTrimmed: 7,
      estimatedTokensSaved: 850,
      routingTimeMs: 42,
      selectedServers: ['notes'],
      toolFilter: [{ serverID: 'notes', includedTools: ['read_note', 'create_note', 'list_notes'] }],
      reasoning: 'User requested note retrieval and creation',
    };

    recordTurn(turn);

    const response = await getSessionStatsRoute();
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.stats).toBeDefined();
    expect(body.stats.totalToolsLoaded).toBe(3);
    expect(body.stats.totalToolsTrimmed).toBe(7);
    expect(body.stats.totalTokensSaved).toBe(850);
    expect(body.stats.turns).toHaveLength(1);
    expect(body.stats.turns[0].turnID).toBe('turn-int-1');
    expect(body.stats.turns[0].intent).toBe('fetch notes and save something');
    expect(body.stats.turns[0].toolFilter).toEqual([
      { serverID: 'notes', includedTools: ['read_note', 'create_note', 'list_notes'] },
    ]);
    expect(body.stats.turns[0].reasoning).toBe('User requested note retrieval and creation');
  });

  it('Task 2.2: actively detects terminated server and returns error with timestamp through GET /api/lab/server-status', async () => {
    const manager = MCPServerManager.getInstance();
    const notesPath = path.resolve(process.cwd(), 'src', 'mcp-servers', 'notes', 'index.mjs');

    manager.registerServer({
      id: 'api-notes-test',
      name: 'API Notes Test',
      transport: 'stdio',
      command: 'node',
      args: [notesPath],
    });

    await manager.connectServer('api-notes-test');
    expect(manager.getServerStatus('api-notes-test')).toBe('connected');

    // First API call: server is connected
    const connectedResponse = await getServerStatusRoute();
    expect(connectedResponse.status).toBe(200);
    const connectedBody = await connectedResponse.json();
    const initialManifest = connectedBody.manifests.find((m: ServerManifest) => m.id === 'api-notes-test');
    expect(initialManifest).toBeDefined();
    expect(initialManifest.status).toBe('connected');
    const initialChangeAt = initialManifest.lastStatusChangeAt;

    // Access underlying client & child process
    const entry = (manager as unknown as {
      servers: Map<string, { client: { transport?: { _process?: { kill: (signal: string) => void } } } }>;
    }).servers.get('api-notes-test');
    const childProc = entry?.client?.transport?._process;
    expect(childProc).toBeDefined();

    // Small delay so timestamp changes
    await new Promise((resolve) => setTimeout(resolve, 10));

    // Kill the subprocess to simulate sudden failure
    childProc!.kill('SIGTERM');

    // Calling the API actively runs health check round before returning manifests
    const deadResponse = await getServerStatusRoute();
    expect(deadResponse.status).toBe(200);

    const deadBody = await deadResponse.json();
    const deadManifest = deadBody.manifests.find((m: ServerManifest) => m.id === 'api-notes-test');
    expect(deadManifest).toBeDefined();
    expect(deadManifest.status).toBe('error');
    expect(deadManifest.lastStatusChangeAt).toBeDefined();
    expect(deadManifest.lastStatusChangeAt).toBeGreaterThan(initialChangeAt);

    // Verify detection bound is well within 10s (AC-4)
    const detectionDurationMs = Date.now() - deadManifest.lastStatusChangeAt;
    expect(detectionDurationMs).toBeLessThanOrEqual(10000);

    expect(deadManifest.lastError).toBeDefined();
    expect(deadManifest.lastError.length).toBeGreaterThan(0);
  }, 20000);
});
