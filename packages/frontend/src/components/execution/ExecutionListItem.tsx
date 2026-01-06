import type { ExecutionListItem as ExecutionListItemType } from '@chatgpt-app-builder/shared';
import { ExecutionStatusBadge } from './ExecutionStatusBadge';

interface ExecutionListItemProps {
  execution: ExecutionListItemType;
  selected: boolean;
  onClick: () => void;
}

function formatDuration(ms: number | undefined): string {
  if (ms === undefined) return '-';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
}

function formatTime(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();

  if (isToday) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  return date.toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function ExecutionListItem({
  execution,
  selected,
  onClick,
}: ExecutionListItemProps) {
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
            <span className="text-sm font-medium text-gray-900">
              {formatTime(execution.startedAt)}
            </span>
            <span className="text-xs text-gray-500">
              {formatDuration(execution.duration)}
            </span>
          </div>
          {execution.initialParamsPreview && (
            <p className="text-sm text-gray-500 truncate mt-0.5">
              {execution.initialParamsPreview}
            </p>
          )}
        </div>
      </div>
    </button>
  );
}
