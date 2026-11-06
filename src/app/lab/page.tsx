/**
 * @file page.tsx
 * @description Monster Lab Dashboard Server Component (`/lab`).
 * Performs server-side data fetching for initial session statistics and MCP server manifests,
 * constructs tool mapping lookups for turn inspection, and renders dashboard panels.
 */

import { getSessionStats } from '@/lib/router/stats';
import { MCPServerManager } from '@/lib/mcp/server-manager';
import type { SessionStatistics, ServerManifest } from '@/lib/router/types';
import StatsPanel from '@/app/lab/components/StatsPanel';
import ServerHealthPanel from '@/app/lab/components/ServerHealthPanel';
import TurnHistoryPanel from '@/app/lab/components/TurnHistoryPanel';
import ErrorFallback from './components/ErrorFallback';

/**
 * Server component page for `/lab`.
 *
 * Fetches server-side initial stats and manifests inside a try/catch,
 * rendering ErrorFallback on statistics failures or the full suite of
 * StatsPanel, TurnHistoryPanel, and ServerHealthPanel on success.
 */
export default async function LabPage() {
  let sessionStats: SessionStatistics | undefined;
  let serverManifests: ServerManifest[] = [];
  let statsError: Error | null = null;

  try {
    sessionStats = getSessionStats();
    const manager = MCPServerManager.getInstance();
    serverManifests = manager.getServerManifests();
  } catch (error) {
    statsError = error instanceof Error ? error : new Error(String(error));
    try {
      const manager = MCPServerManager.getInstance();
      serverManifests = manager.getServerManifests();
    } catch {
      serverManifests = [];
    }
  }

  const allServerTools = new Map<string, string[]>();
  for (const manifest of serverManifests) {
    allServerTools.set(
      manifest.id,
      manifest.tools.map((t) => t.name)
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <header className="border-b border-green-900/30 px-8 py-6">
        <h1 className="text-4xl font-bold text-green-400">
          🧪 Monster Lab Dashboard
        </h1>
        <p className="text-gray-400 mt-2">
          Real-time routing transparency &amp; context efficiency metrics
        </p>
      </header>

      <main className="px-8 py-6 space-y-8">
        {statsError || !sessionStats ? (
          <ErrorFallback error={statsError ?? undefined} />
        ) : (
          <>
            <StatsPanel initialStats={sessionStats} />
            <TurnHistoryPanel
              initialTurns={sessionStats.turns}
              allServerTools={allServerTools}
            />
          </>
        )}

        <ServerHealthPanel initialManifests={serverManifests} />
      </main>
    </div>
  );
}
