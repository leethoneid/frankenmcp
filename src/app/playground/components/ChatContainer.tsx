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

import { useState } from 'react';
import type { Turn } from '../types';
import ConversationHistory from './ConversationHistory';
import InputBar from './InputBar';

export interface ChatContainerProps {
  initialTurns?: Turn[];
  apiEndpoint?: string;
  initialError?: string | null;
}

export interface ChatQueryResult {
  turn?: Turn;
  error?: string;
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
  const [currentError, setCurrentError] = useState<string | null>(initialError);
  const [inputValue, setInputValue] = useState('');

  /**
   * Submits a user query to the server-side chat endpoint.
   */
  async function handleSubmit(query: string): Promise<void> {
    setIsProcessing(true);
    setCurrentError(null);

    const result = await sendChatQuery(apiEndpoint, query);

    if (result.turn) {
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

    setIsProcessing(false);
  }

  /**
   * Populates the query input field with an example query without auto-submitting.
   */
  function handleExampleClick(exampleQuery: string): void {
    setInputValue(exampleQuery);
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

      <ConversationHistory turns={turns} onExampleClick={handleExampleClick} />

      <InputBar
        onSubmit={handleSubmit}
        disabled={isProcessing || Boolean(currentError)}
        value={inputValue}
        onChange={setInputValue}
      />
    </div>
  );
}
