import type { ExecutionStatus } from '@manifest/shared';

interface ExecutionStatusBadgeProps {
  status: ExecutionStatus;
  showLabel?: boolean;
}

const statusConfig: Record<
  ExecutionStatus,
  { color: string; label: string; tooltip: string }
> = {
  pending: {
    color: 'bg-orange-500',
    label: 'Pending',
    tooltip: 'Session in progress',
  },
  fulfilled: {
    color: 'bg-green-500',
    label: 'Fulfilled',
    tooltip: 'Completed successfully',
  },
  error: {
    color: 'bg-red-500',
    label: 'Error',
    tooltip: 'Session failed',
  },
};

export function ExecutionStatusBadge({
  status,
  showLabel = false,
}: ExecutionStatusBadgeProps) {
  const config = statusConfig[status];

  return (
    <div className="relative group inline-flex items-center gap-2">
      <span
        className={`w-3 h-3 rounded-full ${config.color} flex-shrink-0`}
        aria-label={config.tooltip}
      />
      {showLabel && (
        <span className="text-sm text-gray-600">{config.label}</span>
      )}
      {/* Tooltip */}
      <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
        {config.tooltip}
      </div>
    </div>
  );
}
