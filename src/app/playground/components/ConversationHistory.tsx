'use client';

/**
 * @file ConversationHistory.tsx
 * @description Scrollable container for conversation turns with auto-scroll and welcome state.
 */

import { useEffect, useRef } from 'react';
import type { Turn } from '../types';
import TurnDisplay from './TurnDisplay';
import WelcomeMessage from './WelcomeMessage';
import LoadingIndicator from './LoadingIndicator';

/**
 * Props for the ConversationHistory component.
 */
export interface ConversationHistoryProps {
  /** Array of completed or in-progress conversation turns to render in chronological order. */
  turns: Turn[];
  /** Callback fired when an example query is clicked in the welcome state. */
  onExampleClick?: (query: string) => void;
  /** Whether an active query is being processed, which displays an in-flight loading indicator. */
  isProcessing?: boolean;
  /** Optional custom text message for the loading indicator. */
  loadingMessage?: string;
  /** Current asynchronous loading phase ('routing' or 'executing') to customize the loading message. */
  loadingPhase?: 'routing' | 'executing' | null;
}

/**
 * Scrollable container rendering the conversation stream, managing auto-scroll and welcome state.
 */
export default function ConversationHistory({
  turns,
  onExampleClick,
  isProcessing = false,
  loadingMessage,
  loadingPhase,
}: ConversationHistoryProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Auto-scroll to bottom when new turn added or loading state changes
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [turns.length, isProcessing, loadingPhase]);

  if (turns.length === 0 && !isProcessing) {
    return <WelcomeMessage onExampleClick={onExampleClick || (() => {})} />;
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-8 space-y-6">
      {turns.map((turn) => (
        <TurnDisplay key={turn.id} turn={turn} />
      ))}
      {isProcessing && (
        <div role="status" aria-live="polite" className="pt-2">
          <LoadingIndicator
            message={
              loadingMessage ||
              (loadingPhase === 'executing'
                ? 'Executing tools...'
                : 'Routing your query...')
            }
          />
        </div>
      )}
      <div ref={bottomRef} />
    </div>
  );
}
