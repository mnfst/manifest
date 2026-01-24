import type { Flow, UserIntentNodeParameters } from '@manifest/shared';
import { Button } from '@/components/ui/shadcn/button';
import { Zap, AlertTriangle, ChevronRight, Trash2 } from 'lucide-react';

interface FlowCardProps {
  flow: Flow;
  onClick: () => void;
  onDelete?: () => void;
}

/**
 * Individual flow item card for display in FlowList
 * Shows flow name, description, trigger count, and actions
 */
export function FlowCard({
  flow,
  onClick,
  onDelete,
}: FlowCardProps) {
  // Count active triggers (UserIntent nodes with isActive !== false)
  const triggerNodes = (flow.nodes ?? []).filter(n => n.type === 'UserIntent');
  const activeTriggerCount = triggerNodes.filter(n => {
    const params = n.parameters as unknown as UserIntentNodeParameters | undefined;
    return params?.isActive !== false;
  }).length;
  const hasTriggers = triggerNodes.length > 0;

  return (
    <div className="bg-white rounded-lg border border-gray-200 hover:border-blue-300 hover:shadow-md transition-colors transition-shadow">
      <button
        onClick={onClick}
        className="w-full p-4 text-left"
      >
        <div className="flex items-start gap-4">
          {/* Flow info */}
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-gray-900 truncate">
              {flow.name}
            </h3>
            {flow.description && (
              <p className="text-sm text-gray-500 mt-0.5 line-clamp-2">
                {flow.description}
              </p>
            )}
            <div className="flex items-center gap-3 mt-2">
              {hasTriggers ? (
                <span className="inline-flex items-center gap-1 text-xs text-gray-500">
                  <Zap className="w-4 h-4" />
                  {activeTriggerCount} trigger{activeTriggerCount !== 1 ? 's' : ''}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-xs text-amber-600" title="No triggers configured - this flow won't be exposed as MCP tools">
                  <AlertTriangle className="w-4 h-4" />
                  No triggers
                </span>
              )}
            </div>
          </div>

          {/* Arrow icon */}
          <div className="flex-shrink-0 mt-1">
            <ChevronRight className="w-5 h-5 text-gray-400" />
          </div>
        </div>
      </button>

      {/* Actions bar */}
      {onDelete && (
        <div className="px-4 py-2 border-t bg-gray-50 flex justify-end">
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="text-gray-500 hover:text-red-600"
          >
            <Trash2 className="w-4 h-4" />
            Delete
          </Button>
        </div>
      )}
    </div>
  );
}
