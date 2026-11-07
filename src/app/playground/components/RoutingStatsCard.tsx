/**
 * @file RoutingStatsCard.tsx
 * @description Component to display the dynamic routing decision summary and efficiency metrics.
 * Highlights selected MCP servers, tools loaded vs trimmed, estimated context token savings,
 * and router reasoning with responsive vertical-to-horizontal flex layout.
 */

import type { RoutingSummary } from '../types';

/**
 * Props for the RoutingStatsCard component.
 */
export interface RoutingStatsCardProps {
  /** The routing summary data containing selected servers, tool counts, savings, and optional reasoning. */
  routing: RoutingSummary | {
    /** List of MCP server IDs selected by the router. */
    selectedServers: string[];
    /** Number of tools loaded into active context. */
    toolsLoaded: number;
    /** Number of tools trimmed/pruned from context. */
    toolsTrimmed: number;
    /** Estimated number of tokens saved by pruning. */
    estimatedTokensSaved: number;
    /** Execution latency of the router in milliseconds. */
    routingTimeMs?: number;
    /** Explanation or rationale behind the routing decision. */
    reasoning?: string;
  };
}

/**
 * Renders an efficiency metrics card showing servers picked and tools loaded/trimmed.
 */
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
