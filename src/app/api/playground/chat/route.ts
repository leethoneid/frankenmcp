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
import type { Turn, ToolResult } from '@/app/playground/types';

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

    // Execute tools sequentially
    const toolResults: ToolResult[] = [];
    if (decision.toolFilter && Array.isArray(decision.toolFilter)) {
      for (const filter of decision.toolFilter) {
        for (const toolName of filter.includedTools) {
          const args = extractToolArguments(query, toolName, filter.serverID);

          if (args === null) {
            toolResults.push({
              serverID: filter.serverID,
              toolName,
              status: 'error',
              error: `Unable to extract arguments for ${toolName}`,
            });
            continue;
          }

          try {
            const result = await manager.invokeToolCall(filter.serverID, toolName, args);
            toolResults.push({
              serverID: filter.serverID,
              toolName,
              status: 'success',
              result,
            });
          } catch (error) {
            toolResults.push({
              serverID: filter.serverID,
              toolName,
              status: 'error',
              error: error instanceof Error ? error.message : 'Tool execution failed',
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
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
