'use client';

/**
 * @file ConversationHistory.tsx
 * @description Scrollable container for conversation turns with auto-scroll and welcome state.
 */

import { useEffect, useRef } from 'react';
import type { Turn } from '../types';

export interface ConversationHistoryProps {
  turns: Turn[];
  onExampleClick?: (query: string) => void;
}

export default function ConversationHistory({ turns, onExampleClick }: ConversationHistoryProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [turns.length]);

  if (turns.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 text-center text-gray-400">
        <div className="max-w-md space-y-4">
          <div className="text-5xl">🎮</div>
          <h2 className="text-2xl font-bold text-purple-400">Welcome to FrankenMCP Playground</h2>
          <p className="text-sm text-gray-300">
            Ask questions and watch the router select relevant tools in real-time,
            trimming unnecessary context to save tokens.
          </p>
          {onExampleClick && (
            <div className="pt-2">
              <div className="text-xs text-gray-500 mb-2 font-semibold">TRY AN EXAMPLE:</div>
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => onExampleClick('Add a note about the meeting')}
                  className="px-3 py-1.5 bg-gray-800 text-purple-300 rounded hover:bg-gray-700 text-xs text-left"
                >
                  &quot;Add a note about the meeting&quot; (Notes)
                </button>
                <button
                  type="button"
                  onClick={() => onExampleClick('What is 42 + 58?')}
                  className="px-3 py-1.5 bg-gray-800 text-purple-300 rounded hover:bg-gray-700 text-xs text-left"
                >
                  &quot;What is 42 + 58?&quot; (Calculator)
                </button>
                <button
                  type="button"
                  onClick={() => onExampleClick('Add a task write release notes')}
                  className="px-3 py-1.5 bg-gray-800 text-purple-300 rounded hover:bg-gray-700 text-xs text-left"
                >
                  &quot;Add a task write release notes&quot; (Tasks)
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-4">
      {turns.map((turn) => (
        <div key={turn.id} className="border border-purple-900/30 rounded-lg bg-gray-900 p-5 space-y-3">
          <div className="flex items-start justify-between">
            <div className="text-base text-gray-100 font-medium">🙋 {turn.userQuery}</div>
            <span className="text-xs text-gray-500 font-mono">
              {turn.timestamp ? new Date(turn.timestamp).toLocaleTimeString() : ''}
            </span>
          </div>

          {turn.routing && (
            <div className="bg-gray-800/80 border border-purple-800/40 rounded p-3 text-xs space-y-1">
              <div className="flex gap-4">
                <span className="text-purple-300 font-mono">
                  Servers: {turn.routing.selectedServers.join(', ')}
                </span>
                <span className="text-green-400 font-semibold">{turn.routing.toolsLoaded} loaded</span>
                <span className="text-purple-400 font-semibold">{turn.routing.toolsTrimmed} trimmed</span>
                <span className="text-cyan-400 font-semibold">~{turn.routing.estimatedTokensSaved} tokens saved</span>
                <span className="text-yellow-400">{turn.routing.routingTimeMs}ms</span>
              </div>
              {turn.routing.reasoning && (
                <div className="text-gray-400 italic pt-1">{turn.routing.reasoning}</div>
              )}
            </div>
          )}

          {turn.toolResults && turn.toolResults.length > 0 && (
            <div className="space-y-1 pt-1">
              {turn.toolResults.map((res, idx) => (
                <div
                  key={idx}
                  className={`text-xs p-2 rounded border ${
                    res.status === 'success'
                      ? 'border-green-800/40 bg-green-950/20 text-green-300'
                      : 'border-red-800/40 bg-red-950/20 text-red-300'
                  }`}
                >
                  <span className="font-mono font-semibold">{res.serverID}.{res.toolName}</span>: {res.status === 'success' ? (
                    typeof res.result === 'object' ? JSON.stringify(res.result) : String(res.result)
                  ) : (
                    res.error || 'Execution failed'
                  )}
                </div>
              ))}
            </div>
          )}

          {turn.error && (
            <div className="text-xs p-2 bg-red-950/40 border border-red-700/50 rounded text-red-300">
              ⚠️ {turn.error}
            </div>
          )}
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
