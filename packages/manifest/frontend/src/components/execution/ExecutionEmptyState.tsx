import { Activity } from 'lucide-react';

export function ExecutionEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-64 text-center px-4">
      <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-4">
        <Activity className="w-6 h-6 text-gray-400" />
      </div>
      <h3 className="text-lg font-medium text-gray-900 mb-1">No executions yet</h3>
      <p className="text-sm text-gray-500 max-w-xs">
        This flow hasn't been executed yet. Execute it via the MCP server to see
        execution history here.
      </p>
    </div>
  );
}
