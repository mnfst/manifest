import type { Flow, UserIntentNodeParameters } from '@chatgpt-app-builder/shared';

interface FlowCardProps {
  flow: Flow;
  onClick: () => void;
  onDelete?: () => void;
  isDeleting?: boolean;
}

/**
 * Individual flow item card for display in FlowList
 * Shows flow name, description, trigger count, and actions
 */
export function FlowCard({
  flow,
  onClick,
  onDelete,
  isDeleting,
}: FlowCardProps) {
  // Count active triggers (UserIntent nodes with isActive !== false)
  const triggerNodes = (flow.nodes ?? []).filter(n => n.type === 'UserIntent');
  const activeTriggerCount = triggerNodes.filter(n => {
    const params = n.parameters as unknown as UserIntentNodeParameters | undefined;
    return params?.isActive !== false;
  }).length;
  const hasTriggers = triggerNodes.length > 0;

  return (
    <div className="bg-white rounded-lg border border-gray-200 hover:border-blue-300 hover:shadow-md transition-all">
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
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                    <path d="M11.983 1.907a.75.75 0 00-1.292-.657l-8.5 9.5A.75.75 0 002.75 12h6.572l-1.305 6.093a.75.75 0 001.292.657l8.5-9.5A.75.75 0 0017.25 8h-6.572l1.305-6.093z" />
                  </svg>
                  {activeTriggerCount} trigger{activeTriggerCount !== 1 ? 's' : ''}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-xs text-amber-600" title="No triggers configured - this flow won't be exposed as MCP tools">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                    <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                  </svg>
                  No triggers
                </span>
              )}
            </div>
          </div>

          {/* Arrow icon */}
          <div className="flex-shrink-0 mt-1">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 text-gray-400">
              <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
            </svg>
          </div>
        </div>
      </button>

      {/* Actions bar */}
      {onDelete && (
        <div className="px-4 py-2 border-t bg-gray-50 flex justify-end">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            disabled={isDeleting}
            className="text-sm text-gray-500 hover:text-red-600 transition-colors disabled:opacity-50 flex items-center gap-1"
          >
            {isDeleting ? (
              <>
                <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                Deleting...
              </>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                  <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.519.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clipRule="evenodd" />
                </svg>
                Delete
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
