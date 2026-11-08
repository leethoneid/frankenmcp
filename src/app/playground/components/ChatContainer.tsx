'use client';

/**
 * @file ChatContainer.tsx
 * @description Main client-side chat orchestration component for the FrankenMCP Playground.
 * Manages conversational turns state, sends user queries to POST /api/playground/chat,
 * handles loading and error states, and renders ConversationHistory and InputBar.
 *
 * NOTE: Strictly client-side — does not directly import or invoke routeIntent,
 * MCPServerManager, or recordTurn.
 */

import { useState, useRef } from 'react';
import type { Turn } from '../types';
import ConversationHistory from './ConversationHistory';
import InputBar from './InputBar';

/**
 * Browser sessionStorage key for persisting real routing turns across pages.
 */
export const SESSION_TURNS_STORAGE_KEY = 'frankenmcp_session_turns';

/**
 * Appends a completed Playground turn's real routing decision to browser sessionStorage,
 * deduplicating by turn ID so Monster Lab (/lab) can merge client and server session turns.
 */
export function appendTurnToSessionStorage(turn: Turn): void {
  if (!turn || !turn.routing || typeof window === 'undefined' || !window.sessionStorage) {
    return;
  }
  try {
    const raw = window.sessionStorage.getItem(SESSION_TURNS_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    const existing = Array.isArray(parsed) ? parsed : [];

    const fallbackFilterMap = new Map<string, string[]>();
    if (Array.isArray(turn.toolResults)) {
      for (const tr of turn.toolResults) {
        if (tr.serverID && tr.toolName) {
          const list = fallbackFilterMap.get(tr.serverID) || [];
          if (!list.includes(tr.toolName)) {
            list.push(tr.toolName);
          }
          fallbackFilterMap.set(tr.serverID, list);
        }
      }
    }
    const derivedFilter = Array.from(fallbackFilterMap.entries()).map(
      ([serverID, includedTools]) => ({
        serverID,
        includedTools,
      })
    );

    const turnRecord = {
      turnID: turn.id,
      timestamp: turn.timestamp,
      intent: turn.userQuery,
      selectedServers: Array.isArray(turn.routing.selectedServers)
        ? turn.routing.selectedServers
        : [],
      toolsLoaded: Number(turn.routing.toolsLoaded) || 0,
      toolsTrimmed: Number(turn.routing.toolsTrimmed) || 0,
      estimatedTokensSaved: Number(turn.routing.estimatedTokensSaved) || 0,
      routingTimeMs: Number(turn.routing.routingTimeMs) || 0,
      toolFilter: Array.isArray(turn.routing.toolFilter)
        ? turn.routing.toolFilter
        : derivedFilter,
      ...(turn.routing.reasoning !== undefined ? { reasoning: turn.routing.reasoning } : {}),
    };

    const deduplicated = existing.filter((item) => item && item.turnID !== turnRecord.turnID);
    deduplicated.push(turnRecord);
    window.sessionStorage.setItem(SESSION_TURNS_STORAGE_KEY, JSON.stringify(deduplicated));
  } catch {
    // Ignore sessionStorage errors in restricted or SSR environments
  }
}

/**
 * Props for the ChatContainer component.
 */
export interface ChatContainerProps {
  /** Optional initial conversation turns for pre-populating or testing. */
  initialTurns?: Turn[];
  /** API endpoint to post chat queries to (default: '/api/playground/chat'). */
  apiEndpoint?: string;
  /** Optional initial error message to display in the chat container. */
  initialError?: string | null;
}

/**
 * Result structure returned by `sendChatQuery`.
 */
export interface ChatQueryResult {
  /** The completed conversation turn if the request succeeded. */
  turn?: Turn;
  /** Error message string if the request failed. */
  error?: string;
  /** Flag indicating whether the failure was caused by router unavailability. */
  isRouterUnavailable?: boolean;
}

/**
 * Sends a natural language query to the chat API endpoint.
 * Encapsulates network communication, JSON parsing, and error normalization.
 */
export async function sendChatQuery(
  apiEndpoint: string,
  query: string
): Promise<ChatQueryResult> {
  try {
    const response = await fetch(apiEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    });

    if (!response.ok) {
      let errorMessage = `API request failed with status ${response.status}`;
      try {
        const errorData = await response.json();
        if (errorData?.error) {
          errorMessage = errorData.error;
        }
      } catch {
        // Non-JSON response
      }
      throw new Error(errorMessage);
    }

    const turn: Turn = await response.json();
    appendTurnToSessionStorage(turn);
    return { turn };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown communication error';
    const isRouterUnavailable =
      errorMessage.includes('Router unavailable') ||
      errorMessage.includes('Router process failed to start');
    return {
      error: errorMessage,
      isRouterUnavailable,
    };
  }
}

export default function ChatContainer({
  initialTurns = [],
  apiEndpoint = '/api/playground/chat',
  initialError = null,
}: ChatContainerProps) {
  const [turns, setTurns] = useState<Turn[]>(initialTurns);
  const [isProcessing, setIsProcessing] = useState(false);
  const [loadingPhase, setLoadingPhase] = useState<'routing' | 'executing' | null>(null);
  const [currentError, setCurrentError] = useState<string | null>(initialError);
  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  /**
   * Submits a user query to the server-side chat endpoint.
   */
  async function handleSubmit(query: string): Promise<void> {
    setIsProcessing(true);
    setCurrentError(null);
    setLoadingPhase('routing');

    try {
      const result = await sendChatQuery(apiEndpoint, query);

      if (result.turn) {
        appendTurnToSessionStorage(result.turn);
        setTurns((prev) => [...prev, result.turn!]);
        setInputValue('');
      } else if (result.error) {
        const errorTurn: Turn = {
          id:
            typeof crypto !== 'undefined' && crypto.randomUUID
              ? crypto.randomUUID()
              : `turn-err-${Date.now()}`,
          timestamp: Date.now(),
          userQuery: query,
          error: result.error,
        };

        setTurns((prev) => [...prev, errorTurn]);

        if (result.isRouterUnavailable) {
          setCurrentError('Router unavailable. Please restart the application.');
        }
      }
    } finally {
      setIsProcessing(false);
      setLoadingPhase(null);
      // Auto-focus input after query completes (success or failure)
      inputRef.current?.focus();
    }
  }

  /**
   * Populates the query input field with an example query without auto-submitting.
   */
  function handleExampleClick(exampleQuery: string): void {
    setInputValue(exampleQuery);
    inputRef.current?.focus();
  }

  return (
    <div className="flex flex-col h-full min-h-[500px]">
      {currentError && (
        <div
          role="alert"
          className="m-4 p-4 bg-red-950/80 border border-red-500 rounded-lg text-red-200 text-sm font-semibold flex items-center gap-2"
        >
          <span className="select-none">⚠️</span>
          <span>{currentError}</span>
        </div>
      )}

      <ConversationHistory
        turns={turns}
        onExampleClick={handleExampleClick}
        isProcessing={isProcessing}
        loadingPhase={loadingPhase}
      />

      <InputBar
        inputRef={inputRef}
        onSubmit={handleSubmit}
        disabled={isProcessing || Boolean(currentError)}
        value={inputValue}
        onChange={setInputValue}
      />
    </div>
  );
}
