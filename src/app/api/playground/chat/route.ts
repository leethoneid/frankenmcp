/**
 * @file route.ts
 * @description POST endpoint for Playground Chat.
 * Handles query submission, server initialization, routing, tool invocation, and turn reporting.
 */

import { NextResponse } from 'next/server';
import { ensureServersInitialized } from '@/lib/server/init';
import { MCPServerManager } from '@/lib/mcp/server-manager';
import { routeIntent } from '@/lib/router/adapter';
import { getSessionStats } from '@/lib/router/stats';
import { extractToolArguments } from '@/lib/server/extractToolArguments';
import { hasRecognizedIntent } from '@/lib/router/fallback';
import {
  NoRelevantToolsError,
  RouterUnavailableError,
  RoutingTimeoutError,
} from '@/lib/router/types';
import type { Turn, ToolResult } from '@/app/playground/types';

const DEFAULT_TOOL_TIMEOUT_MS = 10000;

function getToolTimeoutMs(): number {
  if (process.env.PLAYGROUND_TOOL_TIMEOUT_MS) {
    const parsed = parseInt(process.env.PLAYGROUND_TOOL_TIMEOUT_MS, 10);
    if (!isNaN(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return DEFAULT_TOOL_TIMEOUT_MS;
}

export async function POST(request: Request) {
  try {
    let body: any;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON request body' }, { status: 400 });
    }

    const query = body?.query;
    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return NextResponse.json({ error: 'Query required' }, { status: 400 });
    }

    await ensureServersInitialized();

    const manager = MCPServerManager.getInstance();
    const allManifests = manager.getServerManifests();
    const connectedManifests = allManifests.filter((m) => m.status === 'connected');

    if (connectedManifests.length === 0) {
      return NextResponse.json(
        { error: 'All servers offline. Please check server configuration.' },
        { status: 503 }
      );
    }

    const disconnectedServers = allManifests
      .filter((m) => m.status !== 'connected')
      .map((m) => m.name);

    // Route the intent (auto-records turn internally)
    const decision = await routeIntent(query.trim(), connectedManifests);

    // Retrieve the auto-recorded turn statistics
    const sessionStats = getSessionStats();
    const recordedTurn = sessionStats.turns[sessionStats.turns.length - 1];

    // If query has no recognized intent across demo domains and fallback selected all 3 demo servers,
    // do not force-execute tools or produce false error items
    const isAllDemoServersFallback =
      decision.selectedServers.includes('notes') &&
      decision.selectedServers.includes('tasks') &&
      decision.selectedServers.includes('calculator');

    if (!hasRecognizedIntent(query) && isAllDemoServersFallback) {
      const turn: Turn = {
        id: recordedTurn ? recordedTurn.turnID : crypto.randomUUID(),
        timestamp: recordedTurn ? recordedTurn.timestamp : Date.now(),
        userQuery: query,
        routing: {
          selectedServers: decision.selectedServers,
          toolsLoaded: 0,
          toolsTrimmed: recordedTurn ? recordedTurn.toolsTrimmed : 0,
          estimatedTokensSaved: recordedTurn ? recordedTurn.estimatedTokensSaved : 0,
          routingTimeMs: recordedTurn ? recordedTurn.routingTimeMs : 0,
          toolFilter: [],
          reasoning: 'No relevant tools found for this query',
        },
        toolResults: [],
        warnings:
          disconnectedServers.length > 0
            ? disconnectedServers.map((name) => `Server '${name}' unavailable`)
            : undefined,
      };

      return NextResponse.json(turn);
    }

    // Execute tools sequentially
    const toolResults: ToolResult[] = [];
    if (decision.toolFilter && Array.isArray(decision.toolFilter)) {
      for (const filter of decision.toolFilter) {
        for (const toolName of filter.includedTools) {
          const args = extractToolArguments(query, toolName, filter.serverID);

          if (args === null) {
            const errorMsg =
              toolName === 'update_task'
                ? 'Task ID required (e.g. task-1)'
                : `Unable to extract arguments for ${toolName}`;
            toolResults.push({
              serverID: filter.serverID,
              toolName,
              status: 'error',
              error: errorMsg,
            });
            continue;
          }

          let timeoutHandle: NodeJS.Timeout | undefined;
          const timeoutPromise = new Promise<never>((_, reject) => {
            timeoutHandle = setTimeout(
              () => reject(new Error('Tool execution timed out')),
              getToolTimeoutMs()
            );
          });

          try {
            const result = await Promise.race([
              manager.invokeToolCall(filter.serverID, toolName, args),
              timeoutPromise,
            ]);
            clearTimeout(timeoutHandle);
            toolResults.push({
              serverID: filter.serverID,
              toolName,
              status: 'success',
              result,
            });
          } catch (error) {
            clearTimeout(timeoutHandle);
            const errorMsg = error instanceof Error ? error.message : 'Tool execution failed';
            toolResults.push({
              serverID: filter.serverID,
              toolName,
              status: 'error',
              error: errorMsg,
            });
          }
        }
      }
    }

    const turn: Turn = {
      id: recordedTurn ? recordedTurn.turnID : crypto.randomUUID(),
      timestamp: recordedTurn ? recordedTurn.timestamp : Date.now(),
      userQuery: query,
      routing: {
        selectedServers: decision.selectedServers,
        toolsLoaded: recordedTurn ? recordedTurn.toolsLoaded : 0,
        toolsTrimmed: recordedTurn ? recordedTurn.toolsTrimmed : 0,
        estimatedTokensSaved: recordedTurn ? recordedTurn.estimatedTokensSaved : 0,
        routingTimeMs: recordedTurn ? recordedTurn.routingTimeMs : 0,
        toolFilter: decision.toolFilter,
        reasoning: decision.reasoning,
      },
      toolResults,
      warnings:
        disconnectedServers.length > 0
          ? disconnectedServers.map((name) => `Server '${name}' unavailable`)
          : undefined,
    };

    return NextResponse.json(turn);
  } catch (error) {
    console.error('Playground API error:', error);

    if (
      error instanceof RouterUnavailableError ||
      (error instanceof Error &&
        (error.name === 'RouterUnavailableError' ||
          error.message.includes('Router unavailable') ||
          error.message.includes('Router process failed to start')))
    ) {
      return NextResponse.json(
        { error: 'Router unavailable. Please restart the application.' },
        { status: 500 }
      );
    }

    if (
      error instanceof NoRelevantToolsError ||
      (error instanceof Error &&
        (error.name === 'NoRelevantToolsError' ||
          error.message.includes('No relevant tools found')))
    ) {
      return NextResponse.json(
        { error: 'No relevant tools found for this query' },
        { status: 404 }
      );
    }

    if (
      error instanceof RoutingTimeoutError ||
      (error instanceof Error &&
        (error.name === 'RoutingTimeoutError' ||
          error.message.includes('Routing timeout') ||
          error.message.includes('did not respond within')))
    ) {
      return NextResponse.json(
        { error: 'Routing timed out. Please try again.' },
        { status: 504 }
      );
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
