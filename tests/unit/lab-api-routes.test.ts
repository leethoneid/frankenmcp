import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as statsModule from '@/lib/router/stats';
import { MCPServerManager } from '@/lib/mcp/server-manager';
import { GET as getSessionStatsRoute } from '@/app/api/lab/session-stats/route';
import { GET as getServerStatusRoute } from '@/app/api/lab/server-status/route';
import type { SessionStatistics, ServerManifest } from '@/lib/router/types';

describe('Phase 2 - Lab API Routes Unit Tests', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await MCPServerManager.resetInstance();
  });

  describe('Task 2.1: GET /api/lab/session-stats', () => {
    it('returns 200 and session stats when getSessionStats succeeds', async () => {
      const mockStats: SessionStatistics = {
        totalToolsLoaded: 5,
        totalToolsTrimmed: 10,
        totalTokensSaved: 1200,
        averageRoutingTimeMs: 15.5,
        turns: [
          {
            turnID: 'turn-1',
            intent: 'find my notes',
            timestamp: 123456789,
            toolsLoaded: 5,
            toolsTrimmed: 10,
            estimatedTokensSaved: 1200,
            routingTimeMs: 15.5,
            selectedServers: ['notes'],
            toolFilter: [{ serverID: 'notes', includedTools: ['read_note'] }],
            reasoning: 'Notes lookup intent',
          },
        ],
      };

      vi.spyOn(statsModule, 'getSessionStats').mockReturnValue(mockStats);

      const response = await getSessionStatsRoute();
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data).toEqual({ stats: mockStats });
      expect(data.stats.totalToolsLoaded).toBe(5);
      expect(data.stats.turns[0].toolFilter).toEqual([{ serverID: 'notes', includedTools: ['read_note'] }]);
      expect(data.stats.turns[0].reasoning).toBe('Notes lookup intent');
    });

    it('returns 500 with error message when getSessionStats throws', async () => {
      vi.spyOn(statsModule, 'getSessionStats').mockImplementation(() => {
        throw new Error('In-memory session state corrupted');
      });

      const response = await getSessionStatsRoute();
      expect(response.status).toBe(500);

      const data = await response.json();
      expect(data).toHaveProperty('error');
      expect(data.error).toBe('In-memory session state corrupted');
    });
  });

  describe('Task 2.2: GET /api/lab/server-status', () => {
    it('calls runHealthCheckRound before getServerManifests and returns 200 with manifests', async () => {
      const manager = MCPServerManager.getInstance();
      const callOrder: string[] = [];

      const mockManifests: ServerManifest[] = [
        {
          id: 'notes',
          name: 'Notes Server',
          transport: 'stdio',
          status: 'connected',
          tools: [],
          lastStatusChangeAt: 1000,
        },
        {
          id: 'tasks',
          name: 'Tasks Server',
          transport: 'stdio',
          status: 'error',
          tools: [],
          lastStatusChangeAt: 2000,
          lastError: 'Subprocess exited',
        },
      ];

      vi.spyOn(manager, 'runHealthCheckRound').mockImplementation(async () => {
        callOrder.push('runHealthCheckRound');
      });

      vi.spyOn(manager, 'getServerManifests').mockImplementation(() => {
        callOrder.push('getServerManifests');
        return mockManifests;
      });

      const response = await getServerStatusRoute();
      expect(response.status).toBe(200);

      expect(callOrder).toEqual(['runHealthCheckRound', 'getServerManifests']);

      const data = await response.json();
      expect(data).toEqual({ manifests: mockManifests });
      expect(data.manifests).toHaveLength(2);
      expect(data.manifests[1].lastError).toBe('Subprocess exited');
    });

    it('returns 500 when MCPServerManager throws an error during health check', async () => {
      const manager = MCPServerManager.getInstance();
      vi.spyOn(manager, 'runHealthCheckRound').mockRejectedValue(new Error('Internal manager failure'));

      const response = await getServerStatusRoute();
      expect(response.status).toBe(500);

      const data = await response.json();
      expect(data).toHaveProperty('error');
      expect(data.error).toBe('Internal manager failure');
    });

    it('returns 500 when getServerManifests throws an error', async () => {
      const manager = MCPServerManager.getInstance();
      vi.spyOn(manager, 'runHealthCheckRound').mockResolvedValue();
      vi.spyOn(manager, 'getServerManifests').mockImplementation(() => {
        throw new Error('Manifest retrieval failed');
      });

      const response = await getServerStatusRoute();
      expect(response.status).toBe(500);

      const data = await response.json();
      expect(data).toHaveProperty('error');
      expect(data.error).toBe('Manifest retrieval failed');
    });
  });
});
