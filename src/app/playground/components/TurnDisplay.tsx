/**
 * @file TurnDisplay.tsx
 * @description Component to render an individual conversation turn.
 * Displays user query with timestamp, routing decision card, tool execution results, and errors.
 */

import type { Turn } from '../types';
import RoutingStatsCard from './RoutingStatsCard';
import ToolResultCard from './ToolResultCard';
import ErrorMessage from './ErrorMessage';
import LoadingIndicator from './LoadingIndicator';

export interface TurnDisplayProps {
  turn: Turn;
  isExecutingTools?: boolean;
}

export default function TurnDisplay({ turn, isExecutingTools = false }: TurnDisplayProps) {
  const timestamp = turn.timestamp ? new Date(turn.timestamp).toLocaleTimeString() : '';

  return (
    <div className="border border-purple-900/30 rounded-lg bg-gray-900 p-4 sm:p-6 space-y-4 max-w-full overflow-hidden break-words">
      {/* User Query */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <span className="text-2xl select-none">🙋</span>
          <span className="text-sm text-gray-500 font-mono">{timestamp}</span>
        </div>
        <div className="text-base sm:text-lg text-gray-100 font-medium break-words">{turn.userQuery}</div>
      </div>

      {/* Server Warnings */}
      {turn.warnings && turn.warnings.length > 0 && (
        <div
          role="region"
          aria-label="Server Warnings"
          className="bg-yellow-950/40 border border-yellow-600/50 text-yellow-300 rounded-lg p-3 text-sm space-y-1"
        >
          {turn.warnings.map((warning, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <span className="select-none">⚠️</span>
              <span>{warning}</span>
            </div>
          ))}
        </div>
      )}

      {/* Routing Stats */}
      {turn.routing && <RoutingStatsCard routing={turn.routing} />}

      {/* While executing tools: display loading indicator below routing stats */}
      {isExecutingTools && (
        <div role="status" aria-live="polite" className="pt-1">
          <LoadingIndicator message="Executing tools..." />
        </div>
      )}

      {/* Tool Results */}
      {turn.toolResults && turn.toolResults.length > 0 && (
        <div>
          <h3 className="text-sm font-bold text-purple-400 mb-2">🔧 Tool Results</h3>
          <div className="space-y-2">
            {turn.toolResults.map((result, idx) => (
              <ToolResultCard key={idx} result={result} />
            ))}
          </div>
        </div>
      )}

      {/* Error */}
      {turn.error && <ErrorMessage message={turn.error} />}
    </div>
  );
}
