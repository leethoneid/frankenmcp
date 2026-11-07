import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { POST } from '@/app/api/playground/chat/route';
import * as serverInit from '@/lib/server/init';
import * as routerAdapter from '@/lib/router/adapter';
import * as routerStats from '@/lib/router/stats';
import { MCPServerManager } from '@/lib/mcp/server-manager';
import {
  NoRelevantToolsError,
  RouterUnavailableError,
  type ServerManifest,
  type RoutingDecision,
  type SessionStatistics,
} from '@/lib/router/types';
import ChatContainer from '@/app/playground/components/ChatContainer';
import TurnDisplay from '@/app/playground/components/TurnDisplay';
import type { Turn } from '@/app/playground/types';

describe('Playground Chat - Task 6.3: Error Scenario Integration Tests', () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    await MCPServerManager.resetInstance();
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await MCPServerManager.resetInstance();
  });

  it('Scenario 1: mock API route to return NoRelevantToolsError -> verify error displayed in turn', async () => {
    vi.spyOn(serverInit, 'ensureServersInitialized').mockResolvedValue();

    const manager = MCPServerManager.getInstance();
    vi.spyOn(manager, 'getServerManifests').mockReturnValue([
      { id: 'notes', name: 'Notes Server', transport: 'stdio', status: 'connected', tools: [] },
    ] as ServerManifest[]);

    // 1. routeIntent throws NoRelevantToolsError
    vi.spyOn(routerAdapter, 'routeIntent').mockRejectedValue(
      new NoRelevantToolsError('What is the weather in Tokyo?')
    );

    const apiResponse = await POST(
      new Request('http://localhost/api/playground/chat', {
        method: 'POST',
        body: JSON.stringify({ query: 'What is the weather in Tokyo?' }),
      })
    );

    expect(apiResponse.status).toBe(404);
    const body = await apiResponse.json();
    expect(body.error).toBe('No relevant tools found for this query');

    // 2. ChatContainer creates error turn
    const errorTurn: Turn = {
      id: 'turn-no-tools',
      timestamp: Date.now(),
      userQuery: 'What is the weather in Tokyo?',
      error: body.error,
    };

    const uiHtml = renderToStaticMarkup(<ChatContainer initialTurns={[errorTurn]} />);
    expect(uiHtml).toContain('What is the weather in Tokyo?');
    expect(uiHtml).toContain('No relevant tools found for this query');
    expect(uiHtml).toContain('text-red-300');
    // Input is NOT disabled for query errors
    expect(uiHtml).not.toContain('Router unavailable. Please restart the application.');
  });

  it('Scenario 2: mock API route to return Router unavailable error -> verify banner shown, input disabled', async () => {
    vi.spyOn(serverInit, 'ensureServersInitialized').mockResolvedValue();

    const manager = MCPServerManager.getInstance();
    vi.spyOn(manager, 'getServerManifests').mockReturnValue([
      { id: 'notes', name: 'Notes Server', transport: 'stdio', status: 'connected', tools: [] },
    ] as ServerManifest[]);

    // 1. routeIntent throws RouterUnavailableError
    vi.spyOn(routerAdapter, 'routeIntent').mockRejectedValue(
      new RouterUnavailableError(new Error('Router subprocess exit code 1'))
    );

    const apiResponse = await POST(
      new Request('http://localhost/api/playground/chat', {
        method: 'POST',
        body: JSON.stringify({ query: 'Add meeting note' }),
      })
    );

    expect(apiResponse.status).toBe(500);
    const body = await apiResponse.json();
    expect(body.error).toBe('Router unavailable. Please restart the application.');

    // 2. ChatContainer displays prominent red banner and disables input
    const uiHtml = renderToStaticMarkup(
      <ChatContainer initialError={body.error} />
    );

    expect(uiHtml).toContain('role="alert"');
    expect(uiHtml).toContain('bg-red-950/80');
    expect(uiHtml).toContain('border-red-500');
    expect(uiHtml).toContain('Router unavailable. Please restart the application.');
    expect(uiHtml).toContain('disabled=""');
  });

  it('Scenario 3: mock invokeToolCall to throw error -> verify error in tool result, turn still returned', async () => {
    vi.spyOn(serverInit, 'ensureServersInitialized').mockResolvedValue();

    const manager = MCPServerManager.getInstance();
    vi.spyOn(manager, 'getServerManifests').mockReturnValue([
      {
        id: 'notes',
        name: 'Notes Server',
        transport: 'stdio',
        status: 'connected',
        tools: [
          {
            name: 'create_note',
            description: 'Create note',
            inputSchema: { type: 'object' },
          },
        ],
      },
    ] as ServerManifest[]);

    vi.spyOn(routerAdapter, 'routeIntent').mockResolvedValue({
      selectedServers: ['notes'],
      toolFilter: [{ serverID: 'notes', includedTools: ['create_note'] }],
      reasoning: 'Create note matched',
    });

    // invokeToolCall throws error (e.g., disk full or server logic error)
    vi.spyOn(manager, 'invokeToolCall').mockRejectedValue(new Error('Disk quota exceeded on server'));

    vi.spyOn(routerStats, 'getSessionStats').mockReturnValue({
      turns: [
        {
          turnID: 'turn-tool-fail',
          timestamp: Date.now(),
          intent: 'Add a note about budget',
          selectedServers: ['notes'],
          toolsLoaded: 1,
          toolsTrimmed: 4,
          estimatedTokensSaved: 100,
          routingTimeMs: 15,
          toolFilter: [{ serverID: 'notes', includedTools: ['create_note'] }],
        },
      ],
      totalToolsLoaded: 1,
      totalToolsTrimmed: 4,
      totalTokensSaved: 100,
      averageRoutingTimeMs: 15,
    });

    const apiResponse = await POST(
      new Request('http://localhost/api/playground/chat', {
        method: 'POST',
        body: JSON.stringify({ query: 'Add a note about budget' }),
      })
    );

    // Turn is still returned successfully with 200
    expect(apiResponse.status).toBe(200);
    const turn: Turn = await apiResponse.json();
    expect(turn.toolResults).toHaveLength(1);
    expect(turn.toolResults![0]).toEqual({
      serverID: 'notes',
      toolName: 'create_note',
      status: 'error',
      error: 'Disk quota exceeded on server',
    });

    // UI displays error inline without crashing
    const turnHtml = renderToStaticMarkup(<TurnDisplay turn={turn} />);
    expect(turnHtml).toContain('Disk quota exceeded on server');
    expect(turnHtml).toContain('border-red-700/50');
  });

  it('Scenario 4: mock all demo servers offline -> API returns 503 -> verify error displayed', async () => {
    vi.spyOn(serverInit, 'ensureServersInitialized').mockResolvedValue();

    const manager = MCPServerManager.getInstance();
    // All servers in error or disconnected state
    vi.spyOn(manager, 'getServerManifests').mockReturnValue([
      { id: 'notes', name: 'Notes Server', transport: 'stdio', status: 'error', tools: [] },
      { id: 'tasks', name: 'Tasks Server', transport: 'stdio', status: 'disconnected', tools: [] },
      { id: 'calculator', name: 'Calculator Server', transport: 'stdio', status: 'error', tools: [] },
    ] as ServerManifest[]);

    const apiResponse = await POST(
      new Request('http://localhost/api/playground/chat', {
        method: 'POST',
        body: JSON.stringify({ query: 'List all notes' }),
      })
    );

    expect(apiResponse.status).toBe(503);
    const body = await apiResponse.json();
    expect(body.error).toContain('All servers offline');

    // UI displays error turn
    const errorTurn: Turn = {
      id: 'turn-all-offline',
      timestamp: Date.now(),
      userQuery: 'List all notes',
      error: body.error,
    };
    const uiHtml = renderToStaticMarkup(<ChatContainer initialTurns={[errorTurn]} />);
    expect(uiHtml).toContain('All servers offline. Please check server configuration.');
  });

  it('Scenario 5: simulate tool timeout in API route -> verify timeout error in tool results', async () => {
    vi.spyOn(serverInit, 'ensureServersInitialized').mockResolvedValue();

    const manifests: ServerManifest[] = [
      {
        id: 'calculator',
        name: 'Calculator Server',
        transport: 'stdio',
        status: 'connected',
        tools: [{ name: 'add', description: 'Add', inputSchema: { type: 'object' } }],
      },
    ];

    const manager = MCPServerManager.getInstance();
    vi.spyOn(manager, 'getServerManifests').mockReturnValue(manifests);

    const prevTimeout = process.env.PLAYGROUND_TOOL_TIMEOUT_MS;
    process.env.PLAYGROUND_TOOL_TIMEOUT_MS = '40';

    try {
      // invokeToolCall never resolves (hung tool)
      vi.spyOn(manager, 'invokeToolCall').mockImplementation(async () => new Promise(() => {}));

      vi.spyOn(routerAdapter, 'routeIntent').mockResolvedValue({
        selectedServers: ['calculator'],
        toolFilter: [{ serverID: 'calculator', includedTools: ['add'] }],
      });

      vi.spyOn(routerStats, 'getSessionStats').mockReturnValue({
        turns: [
          {
            turnID: 'turn-timeout-scen5',
            timestamp: Date.now(),
            intent: 'What is 10 + 20?',
            selectedServers: ['calculator'],
            toolsLoaded: 1,
            toolsTrimmed: 4,
            estimatedTokensSaved: 100,
            routingTimeMs: 10,
            toolFilter: [{ serverID: 'calculator', includedTools: ['add'] }],
          },
        ],
        totalToolsLoaded: 1,
        totalToolsTrimmed: 4,
        totalTokensSaved: 100,
        averageRoutingTimeMs: 10,
      });

      const apiResponse = await POST(
        new Request('http://localhost/api/playground/chat', {
          method: 'POST',
          body: JSON.stringify({ query: 'What is 10 + 20?' }),
        })
      );

      expect(apiResponse.status).toBe(200);
      const turn: Turn = await apiResponse.json();
      expect(turn.toolResults).toHaveLength(1);
      expect(turn.toolResults![0]).toEqual({
        serverID: 'calculator',
        toolName: 'add',
        status: 'error',
        error: 'Tool execution timed out',
      });

      const turnHtml = renderToStaticMarkup(<TurnDisplay turn={turn} />);
      expect(turnHtml).toContain('Tool execution timed out');
    } finally {
      if (prevTimeout !== undefined) {
        process.env.PLAYGROUND_TOOL_TIMEOUT_MS = prevTimeout;
      } else {
        delete process.env.PLAYGROUND_TOOL_TIMEOUT_MS;
      }
    }
  });

  it('Scenario 6: mock API route to return arg extraction error -> verify "Unable to extract arguments" in results', async () => {
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

    vi.spyOn(routerAdapter, 'routeIntent').mockResolvedValue({
      selectedServers: ['notes'],
      toolFilter: [{ serverID: 'notes', includedTools: ['delete_note'] }],
    });

    vi.spyOn(routerStats, 'getSessionStats').mockReturnValue({
      turns: [
        {
          turnID: 'turn-arg-fail',
          timestamp: Date.now(),
          intent: 'Delete something',
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

    const apiResponse = await POST(
      new Request('http://localhost/api/playground/chat', {
        method: 'POST',
        body: JSON.stringify({ query: 'Delete something' }),
      })
    );

    expect(apiResponse.status).toBe(200);
    const turn: Turn = await apiResponse.json();
    expect(turn.toolResults).toHaveLength(1);
    expect(turn.toolResults![0].status).toBe('error');
    expect(turn.toolResults![0].error).toContain('Unable to extract arguments for delete_note');

    const turnHtml = renderToStaticMarkup(<TurnDisplay turn={turn} />);
    expect(turnHtml).toContain('Unable to extract arguments for delete_note');
  });
});
