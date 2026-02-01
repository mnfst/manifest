import type { ExecutionListItem as ExecutionListItemType } from '@manifest/shared';
import { ExecutionStatusBadge } from './ExecutionStatusBadge';
import { AlertTriangle } from 'lucide-react';
import { formatDuration, formatTime } from '@/lib/formatting';

interface ExecutionListItemProps {
  execution: ExecutionListItemType;
  selected: boolean;
  onClick: () => void;
  /** Optional: Name of the failed node (for error executions) */
  failedNodeName?: string;
}

export function ExecutionListItem({
  execution,
  selected,
  onClick,
  failedNodeName,
}: ExecutionListItemProps) {
  const isError = execution.status === 'error';

  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-4 py-3 border-b border-gray-200 hover:bg-gray-50 transition-colors ${
        selected ? 'bg-blue-50 border-l-2 border-l-blue-500' : ''
      }`}
    >
      <div className="flex items-center gap-3">
        <ExecutionStatusBadge status={execution.status} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-900">
                {formatTime(execution.startedAt)}
              </span>
              {execution.isPreview && (
                <span className="text-xs px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded">
                  Preview
                </span>
              )}
            </div>
            <span className="text-xs text-gray-500">
              {formatDuration(execution.duration)}
            </span>
          </div>
          {execution.initialParamsPreview && (
            <p className="text-sm text-gray-500 truncate mt-0.5">
              {execution.initialParamsPreview}
            </p>
          )}
          {/* Show failed node indicator for error executions */}
          {isError && failedNodeName && (
            <div className="flex items-center gap-1 mt-1 text-xs text-red-600">
              <AlertTriangle className="w-3 h-3" />
              <span className="truncate">Failed at: {failedNodeName}</span>
            </div>
          )}
        </div>
      </div>
    </button>
  );
}
