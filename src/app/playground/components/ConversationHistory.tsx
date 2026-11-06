'use client';

/**
 * @file ConversationHistory.tsx
 * @description Scrollable container for conversation turns with auto-scroll and welcome state.
 */

import { useEffect, useRef } from 'react';
import type { Turn } from '../types';
import TurnDisplay from './TurnDisplay';
import WelcomeMessage from './WelcomeMessage';

export interface ConversationHistoryProps {
  turns: Turn[];
  onExampleClick?: (query: string) => void;
}

export default function ConversationHistory({ turns, onExampleClick }: ConversationHistoryProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Auto-scroll to bottom when new turn added
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [turns.length]);

  if (turns.length === 0) {
    return <WelcomeMessage onExampleClick={onExampleClick || (() => {})} />;
  }

  return (
    <div className="flex-1 overflow-y-auto p-8 space-y-6">
      {turns.map((turn) => (
        <TurnDisplay key={turn.id} turn={turn} />
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
