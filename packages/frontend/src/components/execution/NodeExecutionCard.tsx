import type { NodeExecutionData } from '@chatgpt-app-builder/shared';
import { ExecutionDataViewer } from './ExecutionDataViewer';
import { CheckCircle, XCircle, Clock, Box } from 'lucide-react';

interface NodeExecutionCardProps {
  nodeExecution: NodeExecutionData;
  index: number;
}

// Category configuration with colors matching the flow diagram
const nodeCategoryConfig: Record<string, {
  category: string;
  bgColor: string;
  textColor: string;
}> = {
  UserIntent: {
    category: 'Trigger',
    bgColor: 'bg-blue-100',
    textColor: 'text-blue-700',
  },
  ApiCall: {
    category: 'Action',
    bgColor: 'bg-orange-100',
    textColor: 'text-orange-700',
  },
  Return: {
    category: 'Output',
    bgColor: 'bg-green-100',
    textColor: 'text-green-700',
  },
  CallFlow: {
    category: 'Call Flow',
    bgColor: 'bg-purple-100',
    textColor: 'text-purple-700',
  },
  Interface: {
    category: 'Interface',
    bgColor: 'bg-blue-100',
    textColor: 'text-blue-700',
  },
};

const defaultCategoryConfig = {
  category: 'Node',
  bgColor: 'bg-gray-100',
  textColor: 'text-gray-700',
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
  const config = nodeCategoryConfig[nodeExecution.nodeType] || defaultCategoryConfig;

  const statusIcon =
    nodeExecution.status === 'completed' ? (
      <CheckCircle className="w-4 h-4 text-green-500" />
    ) : nodeExecution.status === 'error' ? (
      <XCircle className="w-4 h-4 text-red-500" />
    ) : (
      <Clock className="w-4 h-4 text-orange-500" />
    );

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 border-b border-gray-200">
        <span className="text-sm text-gray-400 font-mono">#{index + 1}</span>
        <Box className="w-4 h-4 text-gray-500" />
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="font-medium text-gray-900">{nodeExecution.nodeName}</span>
            <span className={`text-xs px-2 py-0.5 rounded font-medium ${config.bgColor} ${config.textColor}`}>
              {config.category}
            </span>
          </div>
          <div className="text-xs text-gray-500 mt-0.5">
            {formatTime(nodeExecution.executedAt)}
          </div>
        </div>
        {statusIcon}
      </div>

      {/* Content */}
      <div className="p-4 space-y-3">
        <ExecutionDataViewer
          data={nodeExecution.inputData}
          title="Input Data"
          defaultExpanded={false}
        />
        <ExecutionDataViewer
          data={nodeExecution.outputData}
          title="Output Data"
          defaultExpanded={false}
        />
        {nodeExecution.error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-700 font-medium">Error</p>
            <p className="text-sm text-red-600 mt-1">{nodeExecution.error}</p>
          </div>
        )}
      </div>
    </div>
  );
}
