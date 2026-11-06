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

describe('Playground Chat - Phase 5 Integration Tests (Tasks 5.1, 5.2, 5.4)', () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    await MCPServerManager.resetInstance();
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await MCPServerManager.resetInstance();
  });

  it('Task 5.1: mocks routeIntent in API to throw NoRelevantToolsError and verifies error displayed in Turn UI', async () => {
    vi.spyOn(serverInit, 'ensureServersInitialized').mockResolvedValue();

    const manager = MCPServerManager.getInstance();
    vi.spyOn(manager, 'getServerManifests').mockReturnValue([
      { id: 'notes', name: 'Notes Server', transport: 'stdio', status: 'connected', tools: [] },
    ] as ServerManifest[]);

    // routeIntent throws NoRelevantToolsError
    vi.spyOn(routerAdapter, 'routeIntent').mockRejectedValue(
      new NoRelevantToolsError('unicorn query')
    );

    const apiResponse = await POST(
      new Request('http://localhost/api/playground/chat', {
        method: 'POST',
        body: JSON.stringify({ query: 'unicorn query' }),
      })
    );

    expect(apiResponse.status).toBe(404);
    const body = await apiResponse.json();
    expect(body.error).toBe('No relevant tools found for this query');

    // Simulate turn created by ChatContainer.handleSubmit from this API error
    const errorTurn: Turn = {
      id: 'turn-err-test',
      timestamp: Date.now(),
      userQuery: 'unicorn query',
      error: body.error,
    };

    // Verify error is displayed in UI without crashing or disabling input
    const uiHtml = renderToStaticMarkup(<ChatContainer initialTurns={[errorTurn]} />);
    expect(uiHtml).toContain('unicorn query');
    expect(uiHtml).toContain('No relevant tools found for this query');
    expect(uiHtml).toContain('text-red-300');
    // Input is NOT disabled for non-router errors
    expect(uiHtml).not.toContain('Router unavailable. Please restart the application.');
  });

  it('Task 5.2: mocks API to return RouterUnavailable and verifies banner and disabled input', async () => {
    vi.spyOn(serverInit, 'ensureServersInitialized').mockResolvedValue();

    const manager = MCPServerManager.getInstance();
    vi.spyOn(manager, 'getServerManifests').mockReturnValue([
      { id: 'notes', name: 'Notes Server', transport: 'stdio', status: 'connected', tools: [] },
    ] as ServerManifest[]);

    // routeIntent throws RouterUnavailableError
    vi.spyOn(routerAdapter, 'routeIntent').mockRejectedValue(
      new RouterUnavailableError(new Error('Child process died'))
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

    // Render ChatContainer with the returned router error
    const uiHtml = renderToStaticMarkup(
      <ChatContainer initialError={body.error} />
    );

    // Prominent red banner
    expect(uiHtml).toContain('role="alert"');
    expect(uiHtml).toContain('bg-red-950/80');
    expect(uiHtml).toContain('border-red-500');
    expect(uiHtml).toContain('Router unavailable. Please restart the application.');

    // InputBar receives disabled={true}
    expect(uiHtml).toContain('disabled=""');
  });

  it('Task 5.4: mocks one server as disconnected, verifies warning in Turn response and UI', async () => {
    vi.spyOn(serverInit, 'ensureServersInitialized').mockResolvedValue();

    const manifests: ServerManifest[] = [
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
      {
        id: 'calculator',
        name: 'Calculator Server',
        transport: 'stdio',
        status: 'error',
        tools: [],
      },
    ];

    const manager = MCPServerManager.getInstance();
    vi.spyOn(manager, 'getServerManifests').mockReturnValue(manifests);
    vi.spyOn(manager, 'invokeToolCall').mockResolvedValue({ success: true, id: 'n1' });

    const decision: RoutingDecision = {
      selectedServers: ['notes'],
      toolFilter: [{ serverID: 'notes', includedTools: ['create_note'] }],
      reasoning: 'Notes matched',
    };
    vi.spyOn(routerAdapter, 'routeIntent').mockResolvedValue(decision);

    const mockStats: SessionStatistics = {
      turns: [
        {
          turnID: 'turn-warn-integration',
          timestamp: 1700000000000,
          intent: 'Create a note about release',
          selectedServers: ['notes'],
          toolsLoaded: 1,
          toolsTrimmed: 4,
          estimatedTokensSaved: 120,
          routingTimeMs: 12,
          toolFilter: [{ serverID: 'notes', includedTools: ['create_note'] }],
        },
      ],
      totalToolsLoaded: 1,
      totalToolsTrimmed: 4,
      totalTokensSaved: 120,
      averageRoutingTimeMs: 12,
    };
    vi.spyOn(routerStats, 'getSessionStats').mockReturnValue(mockStats);

    const apiResponse = await POST(
      new Request('http://localhost/api/playground/chat', {
        method: 'POST',
        body: JSON.stringify({ query: 'Create note: Meeting notes' }),
      })
    );

    expect(apiResponse.status).toBe(200);
    const turnData: Turn = await apiResponse.json();

    // Verify warnings array in Turn response
    expect(turnData.warnings).toBeDefined();
    expect(turnData.warnings).toEqual(["Server 'Calculator Server' unavailable"]);

    // Render in TurnDisplay and ChatContainer
    const turnHtml = renderToStaticMarkup(<TurnDisplay turn={turnData} />);
    expect(turnHtml).toContain('Calculator Server');
    expect(turnHtml).toContain('unavailable');
    expect(turnHtml).toContain('bg-yellow-950/40');
    expect(turnHtml).toContain('border-yellow-600/50');
    expect(turnHtml).toContain('text-yellow-300');

    const chatHtml = renderToStaticMarkup(<ChatContainer initialTurns={[turnData]} />);
    expect(chatHtml).toContain('Calculator Server');
    expect(chatHtml).toContain('unavailable');
  });
});
