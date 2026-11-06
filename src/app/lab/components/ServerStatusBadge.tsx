/**
 * @file ServerStatusBadge.tsx
 * @description Reusable status badge component that visually indicates MCP server health
 * and connection state using semantic icons and colors.
 */

import type { ServerStatus } from '@/lib/router/types';

/**
 * Properties for the ServerStatusBadge component.
 */
export interface ServerStatusBadgeProps {
  /** Operational status of the MCP server ('connected' | 'starting' | 'error' | 'disconnected') */
  status: ServerStatus;
}

const statusConfig: Record<ServerStatus, { icon: string; label: string; color: string }> = {
  connected: { icon: '🟢', label: 'Connected', color: 'text-green-400' },
  starting: { icon: '🟡', label: 'Starting', color: 'text-yellow-400' },
  error: { icon: '🔴', label: 'Error', color: 'text-red-400' },
  disconnected: { icon: '🔴', label: 'Offline', color: 'text-red-400' },
};

/**
 * ServerStatusBadge component renders an icon and status text label with semantic Tailwind colors.
 */
export default function ServerStatusBadge({ status }: ServerStatusBadgeProps) {
  const config = statusConfig[status] || statusConfig.disconnected;
  return (
    <span className={`flex items-center gap-1 text-sm ${config.color}`}>
      <span>{config.icon}</span>
      <span>{config.label}</span>
    </span>
  );
}
