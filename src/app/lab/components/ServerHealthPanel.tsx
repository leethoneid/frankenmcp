'use client';

/**
 * @file ServerHealthPanel.tsx
 * @description Real-time MCP Server health and connectivity monitor panel.
 * Displays connection state for all registered MCP servers, tool counts,
 * error details, and offline duration, polling `/api/lab/server-status` every 5 seconds.
 */

import { useState, useEffect } from 'react';
import type { ServerManifest } from '@/lib/router/types';
import ServerStatusBadge from './ServerStatusBadge';

/**
 * Props for the ServerHealthPanel component.
 */
export interface ServerHealthPanelProps {
  /** Initial server manifests passed from SSR. */
  initialManifests: ServerManifest[];
  /** Optional initial error message if initial fetch failed. */
  initialError?: string | null;
}

/**
 * Formats duration since a timestamp into a human-readable duration string (e.g., "2m 15s" or "45s").
 *
 * @param lastChangeAt Timestamp in ms of the last status change
 * @param now Current timestamp in ms (defaults to Date.now())
 * @returns Human-readable duration string
 */
export function formatOfflineDuration(lastChangeAt?: number, now = Date.now()): string {
  if (!lastChangeAt) return '';
  const seconds = Math.max(0, Math.floor((now - lastChangeAt) / 1000));
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
}

/**
 * Client component rendering status and diagnostic cards for each configured MCP server.
 *
 * @param props Component properties containing initial server manifests and optional error state
 * @returns JSX element containing the server health list
 */
export default function ServerHealthPanel({
  initialManifests,
  initialError = null,
}: ServerHealthPanelProps) {
  const [manifests, setManifests] = useState<ServerManifest[]>(initialManifests || []);
  const [pollError, setPollError] = useState<string | null>(initialError);

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const response = await fetch('/api/lab/server-status');
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        if (data && Array.isArray(data.manifests)) {
          setManifests(data.manifests);
          setPollError(null);
        }
      } catch (error) {
        console.error('Server status poll failed:', error);
        setPollError('Unable to refresh server status');
      }
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const safeManifests = manifests || [];
  const allOffline = safeManifests.length === 0 || safeManifests.every((m) => m.status !== 'connected');

  return (
    <section className="border border-green-900/30 rounded-lg p-6 bg-gray-900">
      <h2 className="text-2xl font-bold text-green-400 mb-4">
        MCP Server Health
      </h2>

      {allOffline && (
        <div className="mb-4 p-4 bg-red-900/20 border border-red-500 rounded text-red-300">
          ⚠️ All servers offline — cannot route requests
        </div>
      )}

      {pollError && (
        <div className="mb-4 p-3 bg-yellow-900/20 border border-yellow-500 rounded text-yellow-300 text-sm">
          {pollError}
        </div>
      )}

      <div className="space-y-3">
        {safeManifests.map((manifest) => (
          <div
            key={manifest.id}
            className="flex items-center justify-between p-3 bg-gray-800 rounded"
          >
            <div className="flex items-center gap-3">
              <ServerStatusBadge status={manifest.status} />
              <span className="font-mono text-lg">{manifest.name}</span>
            </div>
            <div className="text-gray-400 text-sm text-right">
              {manifest.status === 'connected' ? (
                `${manifest.tools.length} tools`
              ) : manifest.status === 'error' || manifest.status === 'disconnected' ? (
                <>
                  <div>{manifest.lastError || 'Connection failed'}</div>
                  {manifest.lastStatusChangeAt && (
                    <div className="text-xs text-gray-500 mt-1">
                      Offline for {formatOfflineDuration(manifest.lastStatusChangeAt)}
                    </div>
                  )}
                </>
              ) : (
                'Starting...'
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
