import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { POST } from '@/app/api/playground/chat/route';
import * as serverInit from '@/lib/server/init';
import * as routerAdapter from '@/lib/router/adapter';
import * as routerStats from '@/lib/router/stats';
import { MCPServerManager } from '@/lib/mcp/server-manager';
import {
  NoRelevantToolsError,
  RouterUnavailableError,
} from '@/lib/router/types';
import type { ServerManifest, RoutingDecision, SessionStatistics } from '@/lib/router/types';

describe('Playground Chat - Task 3.3: API Route POST /api/playground/chat', () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    await MCPServerManager.resetInstance();
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await MCPServerManager.resetInstance();
  });

  it('returns 400 if request body has no query or query is empty', async () => {
    const res1 = await POST(new Request('http://localhost/api/playground/chat', {
      method: 'POST',
      body: JSON.stringify({}),
    }));
    expect(res1.status).toBe(400);
    const data1 = await res1.json();
    expect(data1.error).toContain('Query required');

    const res2 = await POST(new Request('http://localhost/api/playground/chat', {
      method: 'POST',
      body: JSON.stringify({ query: '   ' }),
    }));
    expect(res2.status).toBe(400);
  });

  it('returns 400 if request body is not valid JSON', async () => {
    const res = await POST(new Request('http://localhost/api/playground/chat', {
      method: 'POST',
      body: 'invalid-json',
    }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe('Invalid JSON request body');
  });

  it('returns 503 if all servers are offline', async () => {
    vi.spyOn(serverInit, 'ensureServersInitialized').mockResolvedValue();

    const manager = MCPServerManager.getInstance();
    vi.spyOn(manager, 'getServerManifests').mockReturnValue([
      { id: 'notes', name: 'Notes Server', transport: 'stdio', status: 'error', tools: [] },
      { id: 'tasks', name: 'Tasks Server', transport: 'stdio', status: 'disconnected', tools: [] },
    ] as ServerManifest[]);

    const res = await POST(new Request('http://localhost/api/playground/chat', {
      method: 'POST',
      body: JSON.stringify({ query: 'Add a note' }),
    }));

    expect(res.status).toBe(503);
    const data = await res.json();
    expect(data.error).toContain('All servers offline');
  });

  it('successfully routes query, invokes tool, and returns completed Turn object', async () => {
    vi.spyOn(serverInit, 'ensureServersInitialized').mockResolvedValue();

    const manifests: ServerManifest[] = [
      {
        id: 'calculator',
        name: 'Calculator Server',
        transport: 'stdio',
        status: 'connected',
        tools: [
          {
            name: 'add',
            description: 'Add numbers',
            inputSchema: { type: 'object' },
          },
        ],
      },
    ];

    const manager = MCPServerManager.getInstance();
    vi.spyOn(manager, 'getServerManifests').mockReturnValue(manifests);
    const invokeSpy = vi.spyOn(manager, 'invokeToolCall').mockResolvedValue({ sum: 100 });

    const decision: RoutingDecision = {
      selectedServers: ['calculator'],
      toolFilter: [{ serverID: 'calculator', includedTools: ['add'] }],
      reasoning: 'Math expression detected',
    };
    vi.spyOn(routerAdapter, 'routeIntent').mockResolvedValue(decision);

    const mockStats: SessionStatistics = {
      turns: [
        {
          turnID: 'turn-calc-1',
          timestamp: 1700000000000,
          intent: 'What is 42 + 58?',
          selectedServers: ['calculator'],
          toolsLoaded: 1,
          toolsTrimmed: 4,
          estimatedTokensSaved: 120,
          routingTimeMs: 15,
          toolFilter: [{ serverID: 'calculator', includedTools: ['add'] }],
        },
      ],
      totalToolsLoaded: 1,
      totalToolsTrimmed: 4,
      totalTokensSaved: 120,
      averageRoutingTimeMs: 15,
    };
    vi.spyOn(routerStats, 'getSessionStats').mockReturnValue(mockStats);

    const res = await POST(new Request('http://localhost/api/playground/chat', {
      method: 'POST',
      body: JSON.stringify({ query: 'What is 42 + 58?' }),
    }));

    expect(res.status).toBe(200);
    const data = await res.json();

    expect(data.id).toBe('turn-calc-1');
    expect(data.userQuery).toBe('What is 42 + 58?');
    expect(data.routing.selectedServers).toEqual(['calculator']);
    expect(data.routing.toolsLoaded).toBe(1);
    expect(data.routing.toolsTrimmed).toBe(4);
    expect(data.routing.estimatedTokensSaved).toBe(120);
    expect(data.routing.reasoning).toBe('Math expression detected');

    expect(invokeSpy).toHaveBeenCalledWith('calculator', 'add', { a: 42, b: 58 });
    expect(data.toolResults).toHaveLength(1);
    expect(data.toolResults[0]).toEqual({
      serverID: 'calculator',
      toolName: 'add',
      status: 'success',
      result: { sum: 100 },
    });
  });

  it('records tool error if arguments cannot be extracted', async () => {
    vi.spyOn(serverInit, 'ensureServersInitialized').mockResolvedValue();

    const manifests: ServerManifest[] = [
      {
        id: 'notes',
        name: 'Notes Server',
        transport: 'stdio',
        status: 'connected',
        tools: [{ name: 'delete_note', description: 'Delete', inputSchema: { type: 'object' } }],
      },
    ];

    const manager = MCPServerManager.getInstance();
    vi.spyOn(manager, 'getServerManifests').mockReturnValue(manifests);

    const decision: RoutingDecision = {
      selectedServers: ['notes'],
      toolFilter: [{ serverID: 'notes', includedTools: ['delete_note'] }],
    };
    vi.spyOn(routerAdapter, 'routeIntent').mockResolvedValue(decision);

    vi.spyOn(routerStats, 'getSessionStats').mockReturnValue({
      turns: [
        {
          turnID: 'turn-del-1',
          timestamp: 1700000000000,
          intent: 'Delete note',
          selectedServers: ['notes'],
          toolsLoaded: 1,
          toolsTrimmed: 4,
          estimatedTokensSaved: 100,
          routingTimeMs: 10,
          toolFilter: [{ serverID: 'notes', includedTools: ['delete_note'] }],
        },
      ],
      totalToolsLoaded: 1,
      totalToolsTrimmed: 4,
      totalTokensSaved: 100,
      averageRoutingTimeMs: 10,
    });

    const res = await POST(new Request('http://localhost/api/playground/chat', {
      method: 'POST',
      body: JSON.stringify({ query: 'Delete note' }),
    }));

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.toolResults).toHaveLength(1);
    expect(data.toolResults[0].status).toBe('error');
    expect(data.toolResults[0].error).toContain('Unable to extract arguments for delete_note');
  });

  it('returns warnings when some servers are disconnected', async () => {
    vi.spyOn(serverInit, 'ensureServersInitialized').mockResolvedValue();

    const manifests: ServerManifest[] = [
      {
        id: 'notes',
        name: 'Notes Server',
        transport: 'stdio',
        status: 'connected',
        tools: [{ name: 'list_notes', description: 'List', inputSchema: { type: 'object' } }],
      },
      {
        id: 'tasks',
        name: 'Tasks Server',
        transport: 'stdio',
        status: 'error',
        tools: [],
      },
    ];

    const manager = MCPServerManager.getInstance();
    vi.spyOn(manager, 'getServerManifests').mockReturnValue(manifests);
    vi.spyOn(manager, 'invokeToolCall').mockResolvedValue(['Note 1']);

    vi.spyOn(routerAdapter, 'routeIntent').mockResolvedValue({
      selectedServers: ['notes'],
      toolFilter: [{ serverID: 'notes', includedTools: ['list_notes'] }],
    });

    vi.spyOn(routerStats, 'getSessionStats').mockReturnValue({
      turns: [
        {
          turnID: 'turn-warn-1',
          timestamp: Date.now(),
          intent: 'Show notes',
          selectedServers: ['notes'],
          toolsLoaded: 1,
          toolsTrimmed: 4,
          estimatedTokensSaved: 100,
          routingTimeMs: 5,
          toolFilter: [{ serverID: 'notes', includedTools: ['list_notes'] }],
        },
      ],
      totalToolsLoaded: 1,
      totalToolsTrimmed: 4,
      totalTokensSaved: 100,
      averageRoutingTimeMs: 5,
    });

    const res = await POST(new Request('http://localhost/api/playground/chat', {
      method: 'POST',
      body: JSON.stringify({ query: 'Show notes' }),
    }));

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.warnings).toEqual(["Server 'Tasks Server' unavailable"]);
  });

  it('catches router failure and returns 500 error response', async () => {
    vi.spyOn(serverInit, 'ensureServersInitialized').mockResolvedValue();

    const manager = MCPServerManager.getInstance();
    vi.spyOn(manager, 'getServerManifests').mockReturnValue([
      { id: 'notes', name: 'Notes', transport: 'stdio', status: 'connected', tools: [] },
    ] as ServerManifest[]);

    vi.spyOn(routerAdapter, 'routeIntent').mockRejectedValue(new Error('Router subprocess crashed'));

    const res = await POST(new Request('http://localhost/api/playground/chat', {
      method: 'POST',
      body: JSON.stringify({ query: 'Add note' }),
    }));

    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toBe('Router subprocess crashed');
  });

  it('Task 5.1: catches NoRelevantToolsError and returns 404 with error message', async () => {
    vi.spyOn(serverInit, 'ensureServersInitialized').mockResolvedValue();

    const manager = MCPServerManager.getInstance();
    vi.spyOn(manager, 'getServerManifests').mockReturnValue([
      { id: 'notes', name: 'Notes', transport: 'stdio', status: 'connected', tools: [] },
    ] as ServerManifest[]);

    vi.spyOn(routerAdapter, 'routeIntent').mockRejectedValue(
      new NoRelevantToolsError('find a unicorn')
    );

    const res = await POST(new Request('http://localhost/api/playground/chat', {
      method: 'POST',
      body: JSON.stringify({ query: 'find a unicorn' }),
    }));

    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data.error).toBe('No relevant tools found for this query');
  });

  it('Task 5.2: catches RouterUnavailableError and returns 500 with restart message', async () => {
    vi.spyOn(serverInit, 'ensureServersInitialized').mockResolvedValue();

    const manager = MCPServerManager.getInstance();
    vi.spyOn(manager, 'getServerManifests').mockReturnValue([
      { id: 'notes', name: 'Notes', transport: 'stdio', status: 'connected', tools: [] },
    ] as ServerManifest[]);

    vi.spyOn(routerAdapter, 'routeIntent').mockRejectedValue(
      new RouterUnavailableError(new Error('Process exit 1'))
    );

    const res = await POST(new Request('http://localhost/api/playground/chat', {
      method: 'POST',
      body: JSON.stringify({ query: 'Add a note' }),
    }));

    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toBe('Router unavailable. Please restart the application.');
  });

  it('Task 5.3: times out hung tool after timeout duration, records error, and continues sequentially', async () => {
    vi.spyOn(serverInit, 'ensureServersInitialized').mockResolvedValue();

    const manifests: ServerManifest[] = [
      {
        id: 'calculator',
        name: 'Calculator',
        transport: 'stdio',
        status: 'connected',
        tools: [
          { name: 'multiply', description: 'Hangs', inputSchema: { type: 'object' } },
          { name: 'add', description: 'Fast', inputSchema: { type: 'object' } },
        ],
      },
    ];

    const manager = MCPServerManager.getInstance();
    vi.spyOn(manager, 'getServerManifests').mockReturnValue(manifests);

    const prevTimeout = process.env.PLAYGROUND_TOOL_TIMEOUT_MS;
    process.env.PLAYGROUND_TOOL_TIMEOUT_MS = '50';

    try {
      vi.spyOn(manager, 'invokeToolCall').mockImplementation(async (_serverID, toolName) => {
        if (toolName === 'multiply') {
          // Hangs indefinitely
          return new Promise(() => {});
        }
        return { sum: 10 };
      });

      const decision: RoutingDecision = {
        selectedServers: ['calculator'],
        toolFilter: [
          {
            serverID: 'calculator',
            includedTools: ['multiply', 'add'],
          },
        ],
      };
      vi.spyOn(routerAdapter, 'routeIntent').mockResolvedValue(decision);

      vi.spyOn(routerStats, 'getSessionStats').mockReturnValue({
        turns: [
          {
            turnID: 'turn-timeout-test',
            timestamp: Date.now(),
            intent: 'Calculate 10 * 20 and 5 + 5',
            selectedServers: ['calculator'],
            toolsLoaded: 2,
            toolsTrimmed: 3,
            estimatedTokensSaved: 100,
            routingTimeMs: 10,
            toolFilter: decision.toolFilter,
          },
        ],
        totalToolsLoaded: 2,
        totalToolsTrimmed: 3,
        totalTokensSaved: 100,
        averageRoutingTimeMs: 10,
      });

      const res = await POST(
        new Request('http://localhost/api/playground/chat', {
          method: 'POST',
          body: JSON.stringify({ query: 'Calculate 10 * 20 and 5 + 5' }),
        })
      );

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.toolResults).toHaveLength(2);
      expect(data.toolResults[0]).toEqual({
        serverID: 'calculator',
        toolName: 'multiply',
        status: 'error',
        error: 'Tool execution timed out',
      });
      expect(data.toolResults[1]).toEqual({
        serverID: 'calculator',
        toolName: 'add',
        status: 'success',
        result: { sum: 10 },
      });
    } finally {
      if (prevTimeout !== undefined) {
        process.env.PLAYGROUND_TOOL_TIMEOUT_MS = prevTimeout;
      } else {
        delete process.env.PLAYGROUND_TOOL_TIMEOUT_MS;
      }
    }
  });

  it('Issue B1 Regression: unrecognized query returns no matching tools without invoking tools or producing error items', async () => {
    vi.spyOn(serverInit, 'ensureServersInitialized').mockResolvedValue();

    const manager = MCPServerManager.getInstance();
    vi.spyOn(manager, 'getServerManifests').mockReturnValue([
      { id: 'notes', name: 'Notes Server', transport: 'in-process', status: 'connected', tools: [{ name: 'list_notes', inputSchema: {} }] },
      { id: 'tasks', name: 'Tasks Server', transport: 'in-process', status: 'connected', tools: [{ name: 'list_tasks', inputSchema: {} }] },
      { id: 'calculator', name: 'Calculator Server', transport: 'in-process', status: 'connected', tools: [{ name: 'add', inputSchema: {} }] },
    ] as any);

    const invokeSpy = vi.spyOn(manager, 'invokeToolCall').mockResolvedValue({});

    const res = await POST(new Request('http://localhost/api/playground/chat', {
      method: 'POST',
      body: JSON.stringify({ query: 'What is the capital of France?' }),
    }));

    expect(res.status).toBe(200);
    const data = await res.json();

    // Must NOT invoke any tools
    expect(invokeSpy).not.toHaveBeenCalled();

    // Must have zero error items in toolResults
    const errorItems = (data.toolResults || []).filter((r: any) => r.status === 'error');
    expect(errorItems).toHaveLength(0);

    // Tool results must be empty
    expect(data.toolResults).toHaveLength(0);

    // Reasoning should indicate no matching tools
    expect(data.routing.reasoning).toMatch(/no (matching|relevant) tools/i);
  });

  it('Issue B2 Regression: "Mark task as done" without ID does not fabricate ID or invoke update_task', async () => {
    vi.spyOn(serverInit, 'ensureServersInitialized').mockResolvedValue();

    const manager = MCPServerManager.getInstance();
    vi.spyOn(manager, 'getServerManifests').mockReturnValue([
      {
        id: 'tasks',
        name: 'Tasks Server',
        transport: 'in-process',
        status: 'connected',
        tools: [{ name: 'update_task', inputSchema: {} }],
      },
    ] as any);

    const invokeSpy = vi.spyOn(manager, 'invokeToolCall').mockResolvedValue({});

    const res = await POST(new Request('http://localhost/api/playground/chat', {
      method: 'POST',
      body: JSON.stringify({ query: 'Mark task as done' }),
    }));

    expect(res.status).toBe(200);
    const data = await res.json();

    // Must NOT invoke update_task
    expect(invokeSpy).not.toHaveBeenCalled();

    // Must not contain fabricated garbage ID like 'task-as'
    const jsonStr = JSON.stringify(data);
    expect(jsonStr).not.toContain('task-as');

    // Returns clear "Task ID required" result
    expect(data.toolResults).toHaveLength(1);
    expect(data.toolResults[0].toolName).toBe('update_task');
    expect(data.toolResults[0].error).toMatch(/Task ID required/i);
  });
});
