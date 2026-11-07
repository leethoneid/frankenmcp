/**
 * @file RoutingStatsCard.tsx
 * @description Component to display the dynamic routing decision summary and efficiency metrics.
 */

import type { RoutingSummary } from '../types';

export interface RoutingStatsCardProps {
  routing: RoutingSummary | {
    selectedServers: string[];
    toolsLoaded: number;
    toolsTrimmed: number;
    estimatedTokensSaved: number;
    routingTimeMs?: number;
    reasoning?: string;
  };
}

export default function RoutingStatsCard({ routing }: RoutingStatsCardProps) {
  return (
    <div className="bg-gray-800 border border-purple-700/50 rounded p-4 space-y-2">
      <h3 className="text-sm font-bold text-purple-400">📊 Routing Decision</h3>

      <div className="flex items-center gap-2 text-sm">
        <span className="text-gray-400">Servers:</span>
        <span className="font-mono text-purple-300">
          {routing.selectedServers.join(', ')}
        </span>
      </div>

      <div className="flex flex-col sm:flex-row gap-2 sm:gap-6 text-sm flex-wrap">
        <div>
          <span className="text-gray-400">Loaded:</span>
          <span className="ml-2 text-green-400 font-bold">{routing.toolsLoaded} tools</span>
        </div>
        <div>
          <span className="text-gray-400">Trimmed:</span>
          <span className="ml-2 text-purple-400 font-bold">{routing.toolsTrimmed} tools</span>
        </div>
        <div>
          <span className="text-gray-400">Saved:</span>
          <span className="ml-2 text-cyan-400 font-bold">~{routing.estimatedTokensSaved} tokens</span>
        </div>
      </div>

      {routing.reasoning && (
        <div className="text-xs text-gray-400 italic mt-2">
          {routing.reasoning}
        </div>
      )}
    </div>
  );
}
