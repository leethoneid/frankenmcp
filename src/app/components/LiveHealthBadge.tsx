'use client';

/**
 * @file LiveHealthBadge.tsx
 * @description Real-time health status badge for the FrankenMCP landing page.
 * Probes /api/health upon client mount and renders live operational status.
 */

import { useState, useEffect } from 'react';

interface ServerInfo {
  id: string;
  name: string;
  status: string;
  transport: string;
  toolCount: number;
}

interface HealthResponse {
  status: 'healthy' | 'degraded' | 'error';
  environment: 'vercel' | 'local';
  servers: ServerInfo[];
  timestamp: string;
}

export default function LiveHealthBadge() {
  const [data, setData] = useState<HealthResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;

    async function checkHealth() {
      try {
        const res = await fetch('/api/health');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json: HealthResponse = await res.json();
        if (active) {
          setData(json);
          setLoading(false);
        }
      } catch {
        if (active) {
          setError(true);
          setLoading(false);
        }
      }
    }

    checkHealth();

    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-mono bg-gray-900 border border-gray-800 text-gray-400">
        <span className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
        <span>Probing /api/health status...</span>
      </div>
    );
  }

  if (error || !data || data.status !== 'healthy') {
    return (
      <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-mono bg-red-950/40 border border-red-800/40 text-red-300">
        <span className="w-2 h-2 rounded-full bg-red-500" />
        <span>Demo Servers Offline / Degraded</span>
      </div>
    );
  }

  const onlineCount = data.servers.filter((s) => s.status === 'connected').length;
  const transport = data.environment === 'vercel' ? 'in-process' : 'stdio';

  return (
    <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-mono bg-emerald-950/40 border border-emerald-800/50 text-emerald-300">
      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
      <span>
        {onlineCount} Demo Servers Online ({transport} • {data.environment})
      </span>
    </div>
  );
}
