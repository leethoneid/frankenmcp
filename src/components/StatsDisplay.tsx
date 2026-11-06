'use client';

import React from 'react';
import { SessionStatistics, TurnStatistics } from '@/lib/router/types';
import { formatTokenSavings } from '@/lib/router/stats';

export interface StatsDisplayProps {
  stats?: SessionStatistics | TurnStatistics | null;
  error?: Error | null;
  className?: string;
}

/**
 * Monster Lab statistics display component with default fail-loud error handling.
 * Complies with Task 4.2 acceptance criteria:
 * - If getSessionStats() or calculation fails, renders "Stats unavailable" (no placeholders or 0s).
 * - If token estimation returns null, renders "Token savings unavailable".
 * - Checks for null/undefined before rendering numeric metrics.
 */
export function StatsDisplay({ stats, error, className = '' }: StatsDisplayProps) {
  if (error || !stats) {
    if (error) {
      console.error('[StatsDisplay] Calculation error encountered:', error);
    }
    return (
      <div
        data-testid="stats-error"
        role="alert"
        className={`rounded-md bg-red-950/40 border border-red-800/50 p-4 text-red-300 text-sm flex items-center gap-2 ${className}`}
      >
        <span className="font-semibold">Stats unavailable</span>
      </div>
    );
  }

  const isSession = 'totalToolsLoaded' in stats;
  const toolsLoaded = isSession ? stats.totalToolsLoaded : stats.toolsLoaded;
  const toolsTrimmed = isSession ? stats.totalToolsTrimmed : stats.toolsTrimmed;
  const tokensSaved = isSession ? stats.totalTokensSaved : stats.estimatedTokensSaved;
  const timeMs = isSession ? stats.averageRoutingTimeMs : stats.routingTimeMs;

  const hasInvalidNumbers =
    toolsLoaded === null ||
    toolsLoaded === undefined ||
    isNaN(toolsLoaded) ||
    toolsTrimmed === null ||
    toolsTrimmed === undefined ||
    isNaN(toolsTrimmed);

  if (hasInvalidNumbers) {
    console.error('[StatsDisplay] Non-numeric statistics detected:', { toolsLoaded, toolsTrimmed });
    return (
      <div
        data-testid="stats-error"
        role="alert"
        className={`rounded-md bg-red-950/40 border border-red-800/50 p-4 text-red-300 text-sm flex items-center gap-2 ${className}`}
      >
        <span className="font-semibold">Stats unavailable</span>
      </div>
    );
  }

  const isTokenSavingsUnavailable =
    tokensSaved === null || tokensSaved === undefined || isNaN(tokensSaved);

  return (
    <div
      data-testid="stats-container"
      className={`grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-lg bg-slate-900 border border-slate-800 text-slate-100 ${className}`}
    >
      <div className="flex flex-col">
        <span className="text-xs text-slate-400">Tools Loaded</span>
        <span data-testid="tools-loaded" className="text-lg font-bold text-emerald-400">
          {toolsLoaded}
        </span>
      </div>

      <div className="flex flex-col">
        <span className="text-xs text-slate-400">Tools Trimmed</span>
        <span data-testid="tools-trimmed" className="text-lg font-bold text-indigo-400">
          {toolsTrimmed}
        </span>
      </div>

      <div className="flex flex-col">
        <span className="text-xs text-slate-400">Token Savings</span>
        {isTokenSavingsUnavailable ? (
          <span data-testid="token-savings-error" className="text-sm font-medium text-amber-400">
            {formatTokenSavings(null)}
          </span>
        ) : (
          <span data-testid="tokens-saved" className="text-lg font-bold text-amber-400">
            {tokensSaved}
          </span>
        )}
      </div>

      <div className="flex flex-col">
        <span className="text-xs text-slate-400">{isSession ? 'Avg Routing Time' : 'Routing Time'}</span>
        <span data-testid="routing-time" className="text-lg font-bold text-slate-300">
          {timeMs}ms
        </span>
      </div>
    </div>
  );
}

export default StatsDisplay;
