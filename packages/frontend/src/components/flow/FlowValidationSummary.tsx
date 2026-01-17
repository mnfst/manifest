import { useEffect, useState, useCallback } from 'react';
import {
  CheckCircle,
  AlertTriangle,
  AlertCircle,
  HelpCircle,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Loader2,
} from 'lucide-react';
import type {
  FlowValidationResponse,
  ConnectionValidationResult,
  CompatibilityStatus,
} from '@chatgpt-app-builder/shared';
import { Button } from '@/components/ui/shadcn/button';
import { Badge } from '@/components/ui/shadcn/badge';
import { api } from '../../lib/api';

interface FlowValidationSummaryProps {
  flowId: string;
  nodeNames?: Map<string, string>;
  onConnectionClick?: (connectionId: string, sourceNodeId: string, targetNodeId: string) => void;
}

/**
 * Get the icon for a status.
 */
function getStatusIcon(status: CompatibilityStatus | 'valid' | 'warnings' | 'errors', size = 4) {
  const sizeClass = `w-${size} h-${size}`;
  switch (status) {
    case 'compatible':
    case 'valid':
      return <CheckCircle className={`${sizeClass} text-green-500`} />;
    case 'warning':
    case 'warnings':
      return <AlertTriangle className={`${sizeClass} text-yellow-500`} />;
    case 'error':
    case 'errors':
      return <AlertCircle className={`${sizeClass} text-red-500`} />;
    case 'unknown':
    default:
      return <HelpCircle className={`${sizeClass} text-gray-400`} />;
  }
}

/**
 * Get the background color for a status badge.
 */
function getStatusBgClass(status: CompatibilityStatus | 'valid' | 'warnings' | 'errors'): string {
  switch (status) {
    case 'compatible':
    case 'valid':
      return 'bg-green-100 text-green-800';
    case 'warning':
    case 'warnings':
      return 'bg-yellow-100 text-yellow-800';
    case 'error':
    case 'errors':
      return 'bg-red-100 text-red-800';
    case 'unknown':
    default:
      return 'bg-gray-100 text-gray-600';
  }
}

/**
 * Get the status label.
 */
function getStatusLabel(status: 'valid' | 'warnings' | 'errors'): string {
  switch (status) {
    case 'valid':
      return 'All Valid';
    case 'warnings':
      return 'Has Warnings';
    case 'errors':
      return 'Has Errors';
    default:
      return 'Unknown';
  }
}

interface ConnectionItemProps {
  result: ConnectionValidationResult;
  nodeNames?: Map<string, string>;
  onClick?: () => void;
}

function ConnectionItem({ result, nodeNames, onClick }: ConnectionItemProps) {
  const sourceName = nodeNames?.get(result.sourceNodeId) || result.sourceNodeId.slice(0, 8);
  const targetName = nodeNames?.get(result.targetNodeId) || result.targetNodeId.slice(0, 8);

  return (
    <Button
      variant="ghost"
      onClick={onClick}
      className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-gray-50 rounded transition-colors h-auto justify-start"
    >
      {getStatusIcon(result.status)}
      <div className="flex-1 min-w-0">
        <div className="text-sm text-gray-700 truncate">
          {sourceName} → {targetName}
        </div>
        {result.issues.length > 0 && (
          <div className="text-xs text-gray-500">
            {result.issues.length} issue{result.issues.length !== 1 ? 's' : ''}
          </div>
        )}
      </div>
      <ChevronRight className="w-4 h-4 text-gray-400" />
    </Button>
  );
}

export function FlowValidationSummary({
  flowId,
  nodeNames,
  onConnectionClick,
}: FlowValidationSummaryProps) {
  const [validation, setValidation] = useState<FlowValidationResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  const fetchValidation = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await api.validateFlowConnections(flowId);
      setValidation(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to validate flow');
    } finally {
      setLoading(false);
    }
  }, [flowId]);

  useEffect(() => {
    fetchValidation();
  }, [fetchValidation]);

  const handleRefresh = useCallback(() => {
    fetchValidation();
  }, [fetchValidation]);

  if (loading && !validation) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 text-sm text-gray-500">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span>Validating...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 text-sm text-red-600">
        <AlertCircle className="w-4 h-4" />
        <span>{error}</span>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleRefresh}
          className="ml-auto h-6 w-6 hover:bg-red-100"
        >
          <RefreshCw className="w-3 h-3" />
        </Button>
      </div>
    );
  }

  if (!validation) {
    return null;
  }

  const { status, summary, connections } = validation;
  const hasIssues = summary.errors > 0 || summary.warnings > 0;

  // Filter connections with issues for the expandable list
  const issueConnections = connections.filter(
    (c) => c.status === 'error' || c.status === 'warning'
  );

  return (
    <div className="border rounded-lg bg-white overflow-hidden">
      {/* Header */}
      <div
        className={`flex items-center gap-3 px-4 py-3 cursor-pointer ${
          hasIssues ? 'hover:bg-gray-50' : ''
        }`}
        onClick={() => hasIssues && setIsExpanded(!isExpanded)}
      >
        {getStatusIcon(status, 5)}

        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-800">
              Schema Validation
            </span>
            <Badge className={getStatusBgClass(status)}>
              {getStatusLabel(status)}
            </Badge>
          </div>

          {/* Summary counts */}
          <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
            <span className="flex items-center gap-1">
              <CheckCircle className="w-3 h-3 text-green-500" />
              {summary.compatible}
            </span>
            {summary.warnings > 0 && (
              <span className="flex items-center gap-1">
                <AlertTriangle className="w-3 h-3 text-yellow-500" />
                {summary.warnings}
              </span>
            )}
            {summary.errors > 0 && (
              <span className="flex items-center gap-1">
                <AlertCircle className="w-3 h-3 text-red-500" />
                {summary.errors}
              </span>
            )}
            {summary.unknown > 0 && (
              <span className="flex items-center gap-1">
                <HelpCircle className="w-3 h-3 text-gray-400" />
                {summary.unknown}
              </span>
            )}
            <span className="text-gray-400">|</span>
            <span>{summary.total} total</span>
          </div>
        </div>

        {/* Refresh button */}
        <Button
          variant="ghost"
          size="icon"
          onClick={(e) => {
            e.stopPropagation();
            handleRefresh();
          }}
          disabled={loading}
          title="Refresh validation"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>

        {/* Expand indicator */}
        {hasIssues && (
          <div className="text-gray-400">
            {isExpanded ? (
              <ChevronDown className="w-5 h-5" />
            ) : (
              <ChevronRight className="w-5 h-5" />
            )}
          </div>
        )}
      </div>

      {/* Expandable list of issues */}
      {hasIssues && isExpanded && (
        <div className="border-t divide-y">
          {issueConnections.length === 0 ? (
            <div className="px-4 py-3 text-sm text-gray-500 italic">
              No issues found
            </div>
          ) : (
            issueConnections.map((result) => (
              <ConnectionItem
                key={result.connectionId}
                result={result}
                nodeNames={nodeNames}
                onClick={() =>
                  onConnectionClick?.(
                    result.connectionId,
                    result.sourceNodeId,
                    result.targetNodeId
                  )
                }
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}
