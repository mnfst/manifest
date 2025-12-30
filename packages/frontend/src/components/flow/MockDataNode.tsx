import { Handle, Position } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import type { MockData, LayoutTemplate } from '@chatgpt-app-builder/shared';
import { Database } from 'lucide-react';

export interface MockDataNodeData extends Record<string, unknown> {
  mockData?: MockData | null;
  layoutTemplate: LayoutTemplate;
  onEdit: () => void;
}

/**
 * Custom React Flow node for displaying mock data
 * Shows a compact data icon with preview info
 * Clicking opens the MockDataModal
 */
export function MockDataNode({ data }: NodeProps) {
  const { mockData, onEdit } = data as MockDataNodeData;

  // Get preview info based on mock data type
  const getPreviewText = () => {
    if (!mockData) return 'No data';

    if (mockData.type === 'table') {
      const rowCount = mockData.rows?.length || 0;
      const colCount = mockData.columns?.length || 0;
      return `${rowCount} rows, ${colCount} cols`;
    } else if (mockData.type === 'post-list') {
      const postCount = mockData.posts?.length || 0;
      return `${postCount} posts`;
    }
    return 'Data available';
  };

  return (
    <div
      className="bg-amber-50 rounded-lg border border-amber-200 shadow-sm hover:border-amber-400 hover:shadow-md transition-all w-[180px] cursor-pointer nopan"
      onClick={onEdit}
    >
      {/* Top handle for incoming connections */}
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-amber-400 !w-2 !h-2 !border-0"
      />

      <div className="p-3">
        <div className="flex items-center gap-2">
          {/* Data icon */}
          <div className="w-8 h-8 rounded-md bg-amber-100 flex items-center justify-center flex-shrink-0">
            <Database className="w-4 h-4 text-amber-600" />
          </div>

          {/* Mock data info */}
          <div className="flex-1 min-w-0">
            <h3 className="font-medium text-amber-900 text-sm">
              Mock Data
            </h3>
            <p className="text-xs text-amber-600">{getPreviewText()}</p>
          </div>
        </div>
      </div>

      {/* Bottom handle for outgoing connections to ViewNode */}
      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-amber-400 !w-2 !h-2 !border-0"
      />
    </div>
  );
}
