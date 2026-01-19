import { useState, useEffect, useCallback } from 'react';
import type { ExecutionListResponse } from '@manifest/shared';
import { api } from '../../lib/api';
import { ExecutionListItem } from './ExecutionListItem';
import { ExecutionEmptyState } from './ExecutionEmptyState';
import { Pagination } from '../common/Pagination';
import { useExecutionPolling } from '../../hooks/useExecutionPolling';
import { Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/shadcn/button';

interface ExecutionListProps {
  flowId: string;
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function ExecutionList({ flowId, selectedId, onSelect }: ExecutionListProps) {
  const [data, setData] = useState<ExecutionListResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [includePreview, setIncludePreview] = useState(true);

  // Initial fetch with loading state
  const fetchExecutions = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      // When includePreview is false, filter out preview executions
      const response = await api.getExecutions(flowId, {
        page,
        limit: 20,
        isPreview: includePreview ? undefined : false,
      });
      setData(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load executions');
    } finally {
      setIsLoading(false);
    }
  }, [flowId, page, includePreview]);

  // Background refresh without loading state (for polling)
  const refreshExecutions = useCallback(async () => {
    try {
      const response = await api.getExecutions(flowId, {
        page,
        limit: 20,
        isPreview: includePreview ? undefined : false,
      });
      setData(response);
      setError(null);
    } catch (err) {
      // Don't set error on background refresh failure
      console.error('Background refresh failed:', err);
    }
  }, [flowId, page, includePreview]);

  // Initial fetch
  useEffect(() => {
    fetchExecutions();
  }, [fetchExecutions]);

  // Polling for real-time updates
  useExecutionPolling({
    enabled: true, // Could be disabled when tab is not active
    hasPendingExecutions: data?.hasPendingExecutions ?? false,
    interval: 3000,
    onRefresh: refreshExecutions,
  });

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
  };

  if (isLoading && !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center px-4">
        <p className="text-red-500 mb-2">Error loading executions</p>
        <p className="text-sm text-gray-500">{error}</p>
        <Button
          variant="ghost"
          onClick={fetchExecutions}
          className="mt-4"
        >
          Retry
        </Button>
      </div>
    );
  }

  // Filter controls component (always visible)
  const filterControls = (
    <div className="px-4 py-2 border-b flex items-center gap-3">
      <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
        <input
          type="checkbox"
          checked={includePreview}
          onChange={(e) => {
            setIncludePreview(e.target.checked);
            setPage(1); // Reset to first page when filter changes
          }}
          className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
        />
        Include preview calls
      </label>
    </div>
  );

  if (!data || data.items.length === 0) {
    return (
      <div className="flex flex-col h-full">
        {filterControls}
        <ExecutionEmptyState />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {filterControls}
      {/* Header with polling indicator */}
      {data.hasPendingExecutions && (
        <div className="px-4 py-2 bg-orange-50 border-b border-orange-200 flex items-center gap-2 text-sm text-orange-700">
          <RefreshCw className="w-4 h-4 animate-spin" />
          <span>Updating automatically...</span>
        </div>
      )}
      <div className="flex-1 overflow-y-auto">
        {data.items.map((execution) => (
          <ExecutionListItem
            key={execution.id}
            execution={execution}
            selected={execution.id === selectedId}
            onClick={() => onSelect(execution.id)}
          />
        ))}
      </div>
      <Pagination
        page={data.page}
        totalPages={data.totalPages}
        onPageChange={handlePageChange}
      />
    </div>
  );
}
