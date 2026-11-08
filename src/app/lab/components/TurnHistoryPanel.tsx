'use client';

/**
 * @file TurnHistoryPanel.tsx
 * @description Chronological turn history panel displaying recent routing decisions.
 * Polls `/api/lab/session-stats` every 5 seconds to update turns list,
 * displaying the latest 20 turns in reverse chronological order with expandable details.
 */

import { useState, useEffect } from 'react';
import type { TurnStatistics } from '@/lib/router/types';
import { readSessionStorageTurns, mergeTurnsByTurnId } from '@/lib/router/stats';
import TurnCard from './TurnCard';

/**
 * Props for the TurnHistoryPanel component.
 */
export interface TurnHistoryPanelProps {
  /** Initial array of routing turn statistics from SSR. */
  initialTurns: TurnStatistics[];
  /** Optional lookup mapping serverID to its complete list of tool names (for deducing trimmed tools). */
  allServerTools?: Map<string, string[]>;
}

/**
 * Client component displaying turn history cards with scrollable feed and real-time polling.
 *
 * @param props Component properties containing initial turn statistics and optional tool mappings
 * @returns JSX element containing the turn history feed or empty state message
 */
export default function TurnHistoryPanel({ initialTurns, allServerTools }: TurnHistoryPanelProps) {
  const [turns, setTurns] = useState<TurnStatistics[]>(initialTurns || []);

  useEffect(() => {
    const localTurns = readSessionStorageTurns();
    if (localTurns.length > 0) {
      setTurns((prev) => mergeTurnsByTurnId(prev, localTurns));
    }

    const interval = setInterval(async () => {
      try {
        const response = await fetch('/api/lab/session-stats');
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        if (data && data.stats && Array.isArray(data.stats.turns)) {
          const currentLocalTurns = readSessionStorageTurns();
          setTurns(mergeTurnsByTurnId(data.stats.turns, currentLocalTurns));
        }
      } catch (error) {
        console.error('Turn history poll failed:', error);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const safeTurns = turns || [];
  const recentTurns = safeTurns.slice(-20).reverse();

  if (recentTurns.length === 0) {
    return (
      <section className="border border-green-900/30 rounded-lg p-6 bg-gray-900">
        <h2 className="text-2xl font-bold text-green-400 mb-4">
          Turn History
        </h2>
        <p className="text-gray-400">
          No routing decisions yet. Submit a query in the Playground to see statistics.
        </p>
      </section>
    );
  }

  return (
    <section className="border border-green-900/30 rounded-lg p-6 bg-gray-900">
      <h2 className="text-2xl font-bold text-green-400 mb-4">
        Turn History ({safeTurns.length} {safeTurns.length === 1 ? 'turn' : 'turns'})
      </h2>
      <div className="space-y-3 max-h-[600px] overflow-y-auto">
        {recentTurns.map((turn) => (
          <TurnCard key={turn.turnID} turn={turn} allServerTools={allServerTools} />
        ))}
      </div>
    </section>
  );
}
