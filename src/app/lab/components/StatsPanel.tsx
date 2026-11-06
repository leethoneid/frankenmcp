'use client';

import { useState, useEffect } from 'react';
import type { SessionStatistics } from '@/lib/router/types';
import MetricCard from './MetricCard';

export interface StatsPanelProps {
  initialStats: SessionStatistics;
  initialError?: string | null;
}

export default function StatsPanel({ initialStats, initialError = null }: StatsPanelProps) {
  const [stats, setStats] = useState(initialStats);
  const [pollError, setPollError] = useState<string | null>(initialError);

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const response = await fetch('/api/lab/session-stats');
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        if (data && data.stats) {
          setStats(data.stats);
          setPollError(null);
        }
      } catch (error) {
        console.error('Session stats poll failed:', error);
        setPollError('Unable to refresh statistics');
      }
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  return (
    <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {pollError && (
        <div className="col-span-full p-3 bg-yellow-900/20 border border-yellow-500 rounded text-yellow-300 text-sm">
          {pollError}
        </div>
      )}
      <MetricCard
        label="Tools Loaded"
        value={stats.totalToolsLoaded}
        unit="tools"
        description="Total tools loaded into context"
        color="green"
      />
      <MetricCard
        label="Tools Trimmed"
        value={stats.totalToolsTrimmed}
        unit="tools"
        description="Total tools excluded from selected servers"
        color="purple"
      />
      <MetricCard
        label="Tokens Saved"
        value={stats.totalTokensSaved}
        unit="tokens"
        description="Estimated context tokens saved"
        color="cyan"
        prefix="~"
      />
      <MetricCard
        label="Avg Routing Time"
        value={stats.averageRoutingTimeMs}
        unit="ms"
        description="Average decision latency"
        color="yellow"
      />
    </section>
  );
}
