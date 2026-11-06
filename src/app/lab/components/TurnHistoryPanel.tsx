'use client';

import { useState, useEffect } from 'react';
import type { TurnStatistics } from '@/lib/router/types';
import TurnCard from './TurnCard';

export interface TurnHistoryPanelProps {
  initialTurns: TurnStatistics[];
  allServerTools?: Map<string, string[]>;
}

export default function TurnHistoryPanel({ initialTurns, allServerTools }: TurnHistoryPanelProps) {
  const [turns, setTurns] = useState<TurnStatistics[]>(initialTurns || []);

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const response = await fetch('/api/lab/session-stats');
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        if (data && data.stats && Array.isArray(data.stats.turns)) {
          setTurns(data.stats.turns);
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
