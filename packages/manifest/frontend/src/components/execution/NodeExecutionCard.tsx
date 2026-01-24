import type { NodeExecutionData } from '@manifest/shared';
import { ExecutionDataViewer } from './ExecutionDataViewer';
import { StatusIcon } from './StatusIcon';
import { ErrorBanner } from './ErrorBanner';
import { Duration } from './Duration';
import { extractStatusInfo, extractOutputDataForDisplay } from './executionUtils';
import { Box, Shuffle, Globe, GitBranch, CornerDownLeft, LayoutTemplate, Zap } from 'lucide-react';
import { Badge } from '@/components/ui/shadcn/badge';

interface NodeExecutionCardProps {
  nodeExecution: NodeExecutionData;
  index: number;
}

// Map node types to their icons
const nodeTypeIcons: Record<string, typeof Box> = {
  UserIntent: Zap,
  StatCard: LayoutTemplate,
  Return: CornerDownLeft,
  CallFlow: GitBranch,
  ApiCall: Globe,
  JavaScriptCodeTransform: Shuffle,
};

// Node type category styles
type NodeCategory = 'trigger' | 'interface' | 'action' | 'return' | 'transform' | 'default';

const nodeTypeCategories: Record<string, NodeCategory> = {
  UserIntent: 'trigger',
  StatCard: 'interface',
  Return: 'return',
  CallFlow: 'action',
  ApiCall: 'action',
  JavaScriptCodeTransform: 'transform',
};

const categoryStyles: Record<NodeCategory, { border: string; bg: string; badge: string; icon: string }> = {
  trigger: { border: 'border-blue-200', bg: 'bg-blue-50', badge: 'bg-blue-200 text-blue-700', icon: 'text-blue-500' },
  interface: { border: 'border-gray-200', bg: 'bg-gray-50', badge: 'bg-gray-200 text-gray-700', icon: 'text-gray-500' },
  action: { border: 'border-purple-200', bg: 'bg-purple-50', badge: 'bg-purple-200 text-purple-700', icon: 'text-purple-500' },
  return: { border: 'border-green-200', bg: 'bg-green-50', badge: 'bg-green-200 text-green-700', icon: 'text-green-500' },
  transform: { border: 'border-teal-200', bg: 'bg-teal-50', badge: 'bg-teal-200 text-teal-700', icon: 'text-teal-500' },
  default: { border: 'border-gray-200', bg: 'bg-gray-50', badge: 'bg-gray-200 text-gray-700', icon: 'text-gray-500' },
};

function formatTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function NodeExecutionCard({ nodeExecution, index }: NodeExecutionCardProps) {
  const Icon = nodeTypeIcons[nodeExecution.nodeType] || Box;
  const category = nodeTypeCategories[nodeExecution.nodeType] || 'default';
  const styles = categoryStyles[category];

  // Extract status info using new utilities (backward compatible)
  const statusInfo = extractStatusInfo(nodeExecution);

  // Get clean output data without _execution metadata for display
  const displayOutputData = extractOutputDataForDisplay(nodeExecution.outputData);

  return (
    <div className={`border ${styles.border} rounded-lg overflow-hidden`}>
      {/* Header */}
      <div className={`flex items-center gap-3 px-4 py-3 ${styles.bg} border-b ${styles.border}`}>
        <span className="text-sm text-gray-400 font-mono">#{index + 1}</span>
        <Icon className={`w-4 h-4 ${styles.icon}`} />
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="font-medium text-gray-900">{nodeExecution.nodeName}</span>
            <Badge className={`${styles.badge} hover:${styles.badge}`}>
              {nodeExecution.nodeType}
            </Badge>
          </div>
          <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5">
            <span>{formatTime(nodeExecution.executedAt)}</span>
            <Duration ms={statusInfo.durationMs} showIcon />
          </div>
        </div>
        <StatusIcon status={statusInfo.status} showTooltip />
      </div>

      {/* Content */}
      <div className="p-4 space-y-3">
        {/* Error Banner - Prominently displayed above data */}
        {statusInfo.status === 'error' && statusInfo.error && (
          <ErrorBanner
            error={statusInfo.error}
            httpStatus={statusInfo.httpStatus}
            requestUrl={statusInfo.requestUrl}
          />
        )}

        <ExecutionDataViewer
          data={nodeExecution.inputData}
          title="Input Data"
          defaultExpanded={false}
        />
        <ExecutionDataViewer
          data={displayOutputData}
          title="Output Data"
          defaultExpanded={false}
        />

        {/* Session Info Section - shows _execution metadata separately */}
        {nodeExecution.outputData._execution != null && (
          <ExecutionDataViewer
            data={{ _execution: nodeExecution.outputData._execution } as Record<string, unknown>}
            title="Session Info"
            defaultExpanded={false}
          />
        )}
      </div>
    </div>
  );
}
