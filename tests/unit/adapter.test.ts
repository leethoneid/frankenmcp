import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  deriveRoutingDecision,
  searchTools,
  routeIntent,
  calculateTurnStats,
  clearRoutingCache,
  getRoutingCacheSize,
  startRouterProcess,
  stopRouterProcess,
  setRouterClient,
} from '@/lib/router/adapter';
import {
  ServerManifest,
  SearchResult,
  RoutingTimeoutError,
  NoRelevantToolsError,
  InvalidRoutingDecisionError,
  RouterUnavailableError,
  AllServersUnavailableError,
} from '@/lib/router/types';
import { getSessionStats, resetSessionStats } from '@/lib/router/stats';
import { MCPClient } from '@/lib/mcp/client';

describe('Phase 3 - Task 3.1 & 3.3 & 3.4: Router Adapter Unit Tests', () => {
  const dummyServers: ServerManifest[] = [
    {
      id: 'notes',
      name: 'Notes Server',
      transport: 'stdio',
      status: 'connected',
      tools: [
        { name: 'create_note', description: 'Create note', inputSchema: { type: 'object' } },
        { name: 'read_note', description: 'Read note', inputSchema: { type: 'object' } },
        { name: 'list_notes', description: 'List notes', inputSchema: { type: 'object' } },
        { name: 'update_note', description: 'Update note', inputSchema: { type: 'object' } },
        { name: 'delete_note', description: 'Delete note', inputSchema: { type: 'object' } },
      ],
    },
    {
      id: 'tasks',
      name: 'Tasks Server',
      transport: 'stdio',
      status: 'connected',
      tools: [
        { name: 'create_task', description: 'Create task', inputSchema: { type: 'object' } },
        { name: 'list_tasks', description: 'List tasks', inputSchema: { type: 'object' } },
      ],
    },
    {
      id: 'calculator',
      name: 'Calculator Server',
      transport: 'stdio',
      status: 'connected',
      tools: [
        { name: 'add', description: 'Add numbers', inputSchema: { type: 'object' } },
        { name: 'divide', description: 'Divide numbers', inputSchema: { type: 'object' } },
      ],
    },
  ];

  beforeEach(() => {
    clearRoutingCache();
    setRouterClient(null);
  });

  afterEach(async () => {
    await stopRouterProcess();
    clearRoutingCache();
  });

  describe('deriveRoutingDecision', () => {
    it('groups search results by server and derives selectedServers and toolFilter', () => {
      const results: SearchResult[] = [
        { tool: 'read_note', server: 'notes', score: 0.95, description: 'Read note' },
        { tool: 'list_notes', server: 'notes', score: 0.85, description: 'List notes' },
        { tool: 'create_task', server: 'tasks', score: 0.75, description: 'Create task' },
      ];

      const decision = deriveRoutingDecision(results, dummyServers);

      expect(decision.selectedServers).toEqual(['notes', 'tasks']);
      expect(decision.toolFilter).toHaveLength(2);

      const notesFilter = decision.toolFilter.find((f) => f.serverID === 'notes');
      expect(notesFilter?.includedTools).toEqual(['read_note', 'list_notes']);

      const tasksFilter = decision.toolFilter.find((f) => f.serverID === 'tasks');
      expect(tasksFilter?.includedTools).toEqual(['create_task']);

      expect(decision.reasoning).toContain('0.95');
    });

    it('ignores tools from servers not present in availableServers', () => {
      const results: SearchResult[] = [
        { tool: 'read_note', server: 'notes', score: 0.9, description: 'Read note' },
        { tool: 'unknown_tool', server: 'non_existent_server', score: 0.99, description: 'Unknown' },
      ];

      const decision = deriveRoutingDecision(results, dummyServers);
      expect(decision.selectedServers).toEqual(['notes']);
      expect(decision.toolFilter).toHaveLength(1);
    });

    it('throws NoRelevantToolsError when no results or all results belong to unavailable servers', () => {
      expect(() => deriveRoutingDecision([], dummyServers)).toThrow(NoRelevantToolsError);

      const foreignResults: SearchResult[] = [
        { tool: 'foo', server: 'foreign_server', score: 0.9, description: 'foo' },
      ];
      expect(() => deriveRoutingDecision(foreignResults, dummyServers)).toThrow(NoRelevantToolsError);
    });
  });

  describe('calculateTurnStats (Semantics verification per design.md)', () => {
    it('accurately calculates toolsLoaded and toolsTrimmed only across selected servers', () => {
      // Notes server has 5 tools total.
      // Decision selects 'notes' with 2 tools loaded ('read_note', 'list_notes').
      // 'tasks' and 'calculator' servers are not selected.
      const decision = {
        selectedServers: ['notes'],
        toolFilter: [
          {
            serverID: 'notes',
            includedTools: ['read_note', 'list_notes'],
          },
        ],
      };

      const stats = calculateTurnStats('turn-1', 'Show my notes', decision, dummyServers, 42);

      expect(stats.toolsLoaded).toBe(2);
      // Selected server (notes) has 5 tools. toolsTrimmed = 5 - 2 = 3.
      // (Total across all servers is 9, but unselected servers are NOT counted as trimmed!)
      expect(stats.toolsTrimmed).toBe(3);
      expect(stats.selectedServers).toEqual(['notes']);
      expect(stats.estimatedTokensSaved).toBeGreaterThan(0);
      expect(stats.routingTimeMs).toBe(42);
    });
  });

  describe('searchTools', () => {
    it('invokes client mcp_search_tools and parses response', async () => {
      const mockClient = {
        callTool: vi.fn(async () => ({
          content: [
            {
              type: 'text',
              text: JSON.stringify([
                { tool: 'read_note', server: 'notes', score: 0.92, description: 'Read note' },
              ]),
            },
          ],
        })),
      } as unknown as MCPClient;

      const results = await searchTools('read note', { client: mockClient });
      expect(results).toHaveLength(1);
      expect(results[0].tool).toBe('read_note');
      expect(results[0].server).toBe('notes');
      expect(mockClient.callTool).toHaveBeenCalledWith('mcp_search_tools', { query: 'read note' });
    });

    it('throws RoutingTimeoutError when call exceeds timeoutMs', async () => {
      const slowClient = {
        callTool: vi.fn(
          () => new Promise((resolve) => setTimeout(resolve, 500))
        ),
      } as unknown as MCPClient;

      await expect(
        searchTools('slow query', { client: slowClient, timeoutMs: 50 })
      ).rejects.toThrow(RoutingTimeoutError);
    });

    it('throws NoRelevantToolsError when empty results returned', async () => {
      const emptyClient = {
        callTool: vi.fn(async () => ({
          content: [{ type: 'text', text: '[]' }],
        })),
      } as unknown as MCPClient;

      await expect(
        searchTools('unknown query', { client: emptyClient })
      ).rejects.toThrow(NoRelevantToolsError);
    });

    it('throws InvalidRoutingDecisionError when response is malformed', async () => {
      const brokenClient = {
        callTool: vi.fn(async () => ({
          content: [{ type: 'text', text: 'NOT_VALID_JSON' }],
        })),
      } as unknown as MCPClient;

      await expect(
        searchTools('broken query', { client: brokenClient })
      ).rejects.toThrow(InvalidRoutingDecisionError);
    });
  });

  describe('routeIntent and LRU Caching', () => {
    it('caches routing decisions and serves cache on identical intent and servers', async () => {
      const searchFn = vi.fn(async () => [
        { tool: 'read_note', server: 'notes', score: 0.9, description: 'Read' },
      ]);

      const decision1 = await routeIntent('find my note', dummyServers, { searchFn });
      expect(searchFn).toHaveBeenCalledTimes(1);
      expect(getRoutingCacheSize()).toBe(1);

      // Second call should hit cache without calling searchFn
      const decision2 = await routeIntent('find my note', dummyServers, { searchFn });
      expect(searchFn).toHaveBeenCalledTimes(1);
      expect(decision2).toEqual(decision1);

      // Bypass cache
      await routeIntent('find my note', dummyServers, { searchFn, bypassCache: true });
      expect(searchFn).toHaveBeenCalledTimes(2);
    });

    it('Issue B1 Regression: records a new turn in session stats on cache hit (one turn per real query)', async () => {
      resetSessionStats();
      const searchFn = vi.fn(async () => [
        { tool: 'add', server: 'calculator', score: 0.95, description: 'Add numbers' },
      ]);

      // First call (cache miss)
      await routeIntent('What is 42 + 58?', dummyServers, { searchFn });
      expect(getSessionStats().turns).toHaveLength(1);

      // Second identical call (cache hit) must still record a turn in session stats
      await routeIntent('What is 42 + 58?', dummyServers, { searchFn });
      expect(searchFn).toHaveBeenCalledTimes(1);
      const stats = getSessionStats();
      expect(stats.turns).toHaveLength(2);
      expect(stats.turns[0].turnID).not.toBe(stats.turns[1].turnID);
      expect(stats.totalToolsLoaded).toBe(2);
    });

    it('clears routing cache via clearRoutingCache', async () => {
      const searchFn = vi.fn(async () => [
        { tool: 'read_note', server: 'notes', score: 0.9, description: 'Read' },
      ]);

      await routeIntent('query 1', dummyServers, { searchFn });
      expect(getRoutingCacheSize()).toBe(1);

      clearRoutingCache();
      expect(getRoutingCacheSize()).toBe(0);
    });

    it('throws AllServersUnavailableError when no servers are available', async () => {
      await expect(routeIntent('query', [])).rejects.toThrow(AllServersUnavailableError);
    });
  });

  describe('startRouterProcess error handling', () => {
    it('throws RouterUnavailableError when spawn fails', async () => {
      await expect(
        startRouterProcess({ command: 'invalid_router_command_xyz' })
      ).rejects.toThrow(RouterUnavailableError);
    });
  });
});
