/**
 * StatusIcon - Displays a colored status indicator with icon.
 *
 * Status colors:
 * - success: Green (CheckCircle)
 * - error: Red (XCircle)
 * - pending: Orange (Clock)
 */

import { CheckCircle, XCircle, Clock } from 'lucide-react';
import type { NodeStatus } from './executionUtils';

interface StatusIconProps {
  status: NodeStatus;
  size?: 'sm' | 'md' | 'lg';
  showTooltip?: boolean;
}

const sizeClasses = {
  sm: 'w-3 h-3',
  md: 'w-4 h-4',
  lg: 'w-5 h-5',
};

const statusConfig = {
  success: {
    icon: CheckCircle,
    color: 'text-green-500',
    tooltip: 'Completed successfully',
  },
  error: {
    icon: XCircle,
    color: 'text-red-500',
    tooltip: 'Execution failed',
  },
  pending: {
    icon: Clock,
    color: 'text-orange-500',
    tooltip: 'Execution in progress',
  },
};

export function StatusIcon({ status, size = 'md', showTooltip = false }: StatusIconProps) {
  const config = statusConfig[status];
  const Icon = config.icon;
  const sizeClass = sizeClasses[size];

  return (
    <div className="relative group inline-flex">
      <Icon className={`${sizeClass} ${config.color}`} />
      {showTooltip && (
        <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
          {config.tooltip}
        </div>
      )}
    </div>
  );
}
