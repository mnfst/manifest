import type { Flow } from '@chatgpt-app-builder/shared';
import { FlowCard } from './FlowCard';

interface FlowListProps {
  flows: Flow[];
  onFlowClick: (flow: Flow) => void;
  onFlowDelete?: (flow: Flow) => void;
  onCreateFlow?: () => void;
}

/**
 * List of flows for an app with navigation and delete actions
 */
export function FlowList({
  flows,
  onFlowClick,
  onFlowDelete,
  onCreateFlow,
}: FlowListProps) {
  if (flows.length === 0) {
    return (
      <div className="text-center py-12 border-2 border-dashed rounded-lg bg-muted/30">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4">
          <path fillRule="evenodd" d="M3 6a3 3 0 013-3h12a3 3 0 013 3v12a3 3 0 01-3 3H6a3 3 0 01-3-3V6zm4.5 7.5a.75.75 0 01.75.75v2.25a.75.75 0 01-1.5 0v-2.25a.75.75 0 01.75-.75zm3.75-1.5a.75.75 0 00-1.5 0v4.5a.75.75 0 001.5 0V12zm2.25-3a.75.75 0 01.75.75v6.75a.75.75 0 01-1.5 0V9.75A.75.75 0 0113.5 9zm3.75-1.5a.75.75 0 00-1.5 0v9a.75.75 0 001.5 0v-9z" clipRule="evenodd" />
        </svg>
        <h3 className="text-lg font-medium text-foreground mb-1">No flows yet</h3>
        <p className="text-muted-foreground mb-4">Create your first flow by describing what you want to build.</p>
        {onCreateFlow && (
          <button
            onClick={onCreateFlow}
            className="px-6 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:opacity-90 transition-opacity"
          >
            Create New Flow
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {flows.map((flow) => (
        <FlowCard
          key={flow.id}
          flow={flow}
          onClick={() => onFlowClick(flow)}
          onDelete={onFlowDelete ? () => onFlowDelete(flow) : undefined}
        />
      ))}
    </div>
  );
}
