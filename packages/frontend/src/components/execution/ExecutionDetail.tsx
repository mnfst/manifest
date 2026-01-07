import { useState, useEffect } from 'react';
import type { FlowExecution } from '@chatgpt-app-builder/shared';
import { api } from '../../lib/api';
import { ExecutionStatusBadge } from './ExecutionStatusBadge';
import { ExecutionDataViewer } from './ExecutionDataViewer';
import { NodeExecutionCard } from './NodeExecutionCard';
import { Loader2, Clock, AlertTriangle, Copy, Check } from 'lucide-react';

interface ExecutionDetailProps {
  flowId: string;
  executionId: string;
}

function formatDateTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function formatDuration(startedAt: string, endedAt?: string): string {
  if (!endedAt) return 'In progress...';
  const ms = new Date(endedAt).getTime() - new Date(startedAt).getTime();
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
}

export function ExecutionDetail({ flowId, executionId }: ExecutionDetailProps) {
  const [execution, setExecution] = useState<FlowExecution | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleCopyJson = async () => {
    if (!execution) return;
    try {
      await navigator.clipboard.writeText(JSON.stringify(execution, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  useEffect(() => {
    async function fetchExecution() {
      try {
        setIsLoading(true);
        setError(null);
        const data = await api.getExecution(flowId, executionId);
        setExecution(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load execution');
      } finally {
        setIsLoading(false);
      }
    }

    fetchExecution();
  }, [flowId, executionId]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center px-4">
        <p className="text-red-500 mb-2">Error loading execution</p>
        <p className="text-sm text-gray-500">{error}</p>
      </div>
    );
  }

  if (!execution) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">Execution not found</p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <ExecutionStatusBadge status={execution.status} showLabel />
            <span className="text-sm text-gray-500">
              {execution.flowName} ({execution.flowToolName})
            </span>
          </div>
          <button
            onClick={handleCopyJson}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
            title="Copy execution log as JSON"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 text-green-600" />
                <span className="text-green-600">Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                <span>Copy JSON</span>
              </>
            )}
          </button>
        </div>

        {/* Timestamps */}
        <div className="grid grid-cols-2 gap-4 mt-4 p-4 bg-gray-50 rounded-lg">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-gray-400" />
            <div>
              <p className="text-xs text-gray-500">Started</p>
              <p className="text-sm font-medium">{formatDateTime(execution.startedAt)}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-gray-400" />
            <div>
              <p className="text-xs text-gray-500">Duration</p>
              <p className="text-sm font-medium">
                {formatDuration(execution.startedAt, execution.endedAt)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Error Info */}
      {execution.errorInfo && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-5 h-5 text-red-500" />
            <h3 className="font-medium text-red-700">Execution Failed</h3>
          </div>
          <p className="text-sm text-red-600">{execution.errorInfo.message}</p>
          {execution.errorInfo.nodeName && (
            <p className="text-sm text-red-500 mt-1">
              Failed at node: {execution.errorInfo.nodeName}
            </p>
          )}
        </div>
      )}

      {/* Initial Parameters */}
      <div className="mb-6">
        <h3 className="text-sm font-medium text-gray-700 mb-2">Initial Parameters</h3>
        <ExecutionDataViewer data={execution.initialParams} defaultExpanded />
      </div>

      {/* Node Executions */}
      <div>
        <h3 className="text-sm font-medium text-gray-700 mb-3">
          Node Executions ({execution.nodeExecutions.length})
        </h3>
        {execution.nodeExecutions.length === 0 ? (
          <p className="text-sm text-gray-500 italic">No nodes executed yet</p>
        ) : (
          <div className="space-y-4">
            {execution.nodeExecutions.map((nodeExec, index) => (
              <NodeExecutionCard
                key={`${nodeExec.nodeId}-${index}`}
                nodeExecution={nodeExec}
                index={index}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
