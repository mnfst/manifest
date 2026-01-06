import { MousePointer2 } from 'lucide-react';

export function ExecutionDetailPlaceholder() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-4">
      <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-4">
        <MousePointer2 className="w-6 h-6 text-gray-400" />
      </div>
      <h3 className="text-lg font-medium text-gray-900 mb-1">Select an execution</h3>
      <p className="text-sm text-gray-500 max-w-xs">
        Click on an execution in the list to view its details, including initial
        parameters and node-by-node data.
      </p>
    </div>
  );
}
