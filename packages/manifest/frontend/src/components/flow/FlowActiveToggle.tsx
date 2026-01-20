import { useState } from 'react';

interface FlowActiveToggleProps {
  flowId: string;
  isActive: boolean;
  onToggle: (flowId: string, isActive: boolean) => Promise<void>;
  disabled?: boolean;
}

/**
 * Toggle switch component for flow active status
 * Controls whether a flow is visible on the MCP server
 */
export function FlowActiveToggle({
  flowId,
  isActive,
  onToggle,
  disabled = false,
}: FlowActiveToggleProps) {
  const [isUpdating, setIsUpdating] = useState(false);

  const handleToggle = async () => {
    if (disabled || isUpdating) return;

    setIsUpdating(true);
    try {
      await onToggle(flowId, !isActive);
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        role="switch"
        aria-checked={isActive}
        onClick={handleToggle}
        disabled={disabled || isUpdating}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${
          isActive ? 'bg-primary' : 'bg-gray-300'
        } ${disabled || isUpdating ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
            isActive ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </button>
      <div className="flex flex-col">
        <span className={`text-sm font-medium ${isActive ? 'text-foreground' : 'text-muted-foreground'}`}>
          {isUpdating ? 'Updating...' : isActive ? 'Active' : 'Inactive'}
        </span>
        <span className="text-xs text-muted-foreground">
          {isActive ? 'Visible on MCP server' : 'Hidden from MCP server'}
        </span>
      </div>
    </div>
  );
}
