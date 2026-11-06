'use client';

import { useState } from 'react';
import type { TurnStatistics } from '@/lib/router/types';

export interface TurnCardProps {
  turn: TurnStatistics;
  allServerTools?: Map<string, string[]>;
  initialExpanded?: boolean;
}

export default function TurnCard({
  turn,
  allServerTools,
  initialExpanded = false,
}: TurnCardProps) {
  const [expanded, setExpanded] = useState(initialExpanded);
  const timestamp = turn.timestamp ? new Date(turn.timestamp).toLocaleTimeString() : '';
  const intent = turn.intent || '';
  const intentPreview = intent.length > 50 ? intent.slice(0, 50) + '...' : intent;
  const selectedServers = turn.selectedServers || [];

  return (
    <div className="border border-gray-700 rounded-lg bg-gray-800 p-4">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left"
        type="button"
        aria-expanded={expanded}
      >
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs text-gray-500 font-mono">{timestamp}</span>
              <span className="text-sm text-gray-300">&quot;{intentPreview}&quot;</span>
            </div>
            <div className="flex gap-4 text-xs text-gray-400">
              <span>{selectedServers.join(', ')}</span>
              <span className="text-green-400">{turn.toolsLoaded} loaded</span>
              <span className="text-purple-400">{turn.toolsTrimmed} trimmed</span>
              <span className="text-cyan-400">~{turn.estimatedTokensSaved} tokens saved</span>
              <span className="text-yellow-400">{turn.routingTimeMs}ms</span>
            </div>
          </div>
          <span className="text-gray-500">{expanded ? '▼' : '▶'}</span>
        </div>
      </button>

      {expanded && (
        <div className="mt-4 pt-4 border-t border-gray-700 space-y-3 text-sm">
          <div>
            <div className="text-gray-500 mb-1">Full Intent:</div>
            <div className="text-gray-200">{intent}</div>
          </div>

          {turn.toolFilter && turn.toolFilter.length > 0 && (
            <div>
              <div className="text-gray-500 mb-2">Tools by Server:</div>
              {turn.toolFilter.map((filter) => {
                const serverTools = allServerTools?.get(filter.serverID) || [];
                const trimmedTools = serverTools.filter(
                  (t) => !filter.includedTools.includes(t)
                );

                return (
                  <div key={filter.serverID} className="mb-3">
                    <div className="text-gray-300 font-mono mb-1">{filter.serverID}</div>
                    <div className="ml-4 space-y-1">
                      <div className="text-green-400 text-xs">
                        ✓ Loaded: {filter.includedTools.join(', ') || '(none)'}
                      </div>
                      {trimmedTools.length > 0 && (
                        <div className="text-purple-400 text-xs line-through opacity-60">
                          ✗ Trimmed: {trimmedTools.join(', ')}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {turn.reasoning && (
            <div>
              <div className="text-gray-500 mb-1">Routing Reasoning:</div>
              <div className="text-gray-300 italic">{turn.reasoning}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
