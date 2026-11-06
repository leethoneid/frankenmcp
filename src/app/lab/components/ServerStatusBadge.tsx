import type { ServerStatus } from '@/lib/router/types';

interface ServerStatusBadgeProps {
  status: ServerStatus;
}

const statusConfig: Record<ServerStatus, { icon: string; label: string; color: string }> = {
  connected: { icon: '🟢', label: 'Connected', color: 'text-green-400' },
  starting: { icon: '🟡', label: 'Starting', color: 'text-yellow-400' },
  error: { icon: '🔴', label: 'Error', color: 'text-red-400' },
  disconnected: { icon: '🔴', label: 'Offline', color: 'text-red-400' },
};

export default function ServerStatusBadge({ status }: ServerStatusBadgeProps) {
  const config = statusConfig[status] || statusConfig.disconnected;
  return (
    <span className={`flex items-center gap-1 text-sm ${config.color}`}>
      <span>{config.icon}</span>
      <span>{config.label}</span>
    </span>
  );
}

export type { ServerStatusBadgeProps };
