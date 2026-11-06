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
}

export default function ChatContainer({
  initialTurns = [],
  apiEndpoint = '/api/playground/chat',
}: ChatContainerProps) {
  const [turns, setTurns] = useState<Turn[]>(initialTurns);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentError, setCurrentError] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState('');

  /**
   * Submits a user query to the server-side chat endpoint.
   */
  async function handleSubmit(query: string): Promise<void> {
    setIsProcessing(true);
    setCurrentError(null);

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
          // Response body was not JSON
        }
        throw new Error(errorMessage);
      }

      const turn: Turn = await response.json();
      setTurns((prev) => [...prev, turn]);
      setInputValue('');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown communication error';

      const errorTurn: Turn = {
        id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `turn-err-${Date.now()}`,
        timestamp: Date.now(),
        userQuery: query,
        error: errorMessage,
      };

      setTurns((prev) => [...prev, errorTurn]);

      if (errorMessage.includes('Router unavailable')) {
        setCurrentError(errorMessage);
      }
    } finally {
      setIsProcessing(false);
    }
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
          className="m-4 p-4 bg-red-950/80 border border-red-500 rounded-lg text-red-200 text-sm flex items-center justify-between"
        >
          <span>⚠️ {currentError}</span>
          <button
            type="button"
            onClick={() => setCurrentError(null)}
            className="text-red-400 hover:text-red-200 text-xs ml-4"
          >
            Dismiss
          </button>
        </div>
      )}

      <ConversationHistory turns={turns} onExampleClick={handleExampleClick} />

      <InputBar
        onSubmit={handleSubmit}
        disabled={isProcessing}
        value={inputValue}
        onChange={setInputValue}
      />
    </div>
  );
}
