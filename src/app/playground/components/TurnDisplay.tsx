/**
 * @file TurnDisplay.tsx
 * @description Component to render an individual conversation turn.
 * Displays user query with timestamp, routing decision card, tool execution results, and errors.
 */

import type { Turn } from '../types';
import RoutingStatsCard from './RoutingStatsCard';
import ToolResultCard from './ToolResultCard';
import ErrorMessage from './ErrorMessage';

export interface TurnDisplayProps {
  turn: Turn;
}

export default function TurnDisplay({ turn }: TurnDisplayProps) {
  const timestamp = turn.timestamp ? new Date(turn.timestamp).toLocaleTimeString() : '';

  return (
    <div className="border border-purple-900/30 rounded-lg bg-gray-900 p-6 space-y-4">
      {/* User Query */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <span className="text-2xl select-none">🙋</span>
          <span className="text-sm text-gray-500 font-mono">{timestamp}</span>
        </div>
        <div className="text-lg text-gray-100 font-medium">{turn.userQuery}</div>
      </div>

      {/* Routing Stats */}
      {turn.routing && <RoutingStatsCard routing={turn.routing} />}

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
