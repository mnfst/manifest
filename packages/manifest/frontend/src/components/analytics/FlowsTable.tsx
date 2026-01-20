import { useNavigate } from 'react-router-dom';
import type { FlowAnalytics } from '@manifest/shared';
import { ChevronRight } from 'lucide-react';

interface FlowsTableProps {
  appId: string;
  flows: FlowAnalytics[];
  isLoading?: boolean;
}

/**
 * Table component displaying per-flow analytics metrics.
 * Clicking a flow name navigates to the flow detail page at the Analytics tab.
 */
export function FlowsTable({ appId, flows, isLoading }: FlowsTableProps) {
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <div className="bg-card border rounded-xl overflow-hidden">
        <div className="p-4 border-b">
          <div className="h-5 bg-muted rounded w-24 animate-pulse" />
        </div>
        <div className="divide-y">
          {[1, 2, 3].map((i) => (
            <div key={i} className="p-4 animate-pulse">
              <div className="flex items-center justify-between">
                <div className="h-4 bg-muted rounded w-32" />
                <div className="flex gap-8">
                  <div className="h-4 bg-muted rounded w-16" />
                  <div className="h-4 bg-muted rounded w-16" />
                  <div className="h-4 bg-muted rounded w-16" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (flows.length === 0) {
    return (
      <div className="bg-card border rounded-xl p-6 text-center">
        <p className="text-muted-foreground">No flows in this app yet</p>
      </div>
    );
  }

  const handleFlowClick = (flowId: string) => {
    navigate(`/app/${appId}/flow/${flowId}?tab=analytics`);
  };

  return (
    <div className="bg-card border rounded-xl overflow-hidden">
      {/* Header */}
      <div className="grid grid-cols-[1fr,100px,100px,100px,32px] gap-4 px-4 py-3 border-b bg-muted/30 text-sm font-medium text-muted-foreground">
        <div>Flow Name</div>
        <div className="text-right">Executions</div>
        <div className="text-right">Completion</div>
        <div className="text-right">Avg. Duration</div>
        <div />
      </div>

      {/* Rows */}
      <div className="divide-y">
        {flows.map((flow) => (
          <button
            key={flow.id}
            onClick={() => handleFlowClick(flow.id)}
            className="w-full grid grid-cols-[1fr,100px,100px,100px,32px] gap-4 px-4 py-3 text-left hover:bg-muted/50 transition-colors group"
          >
            <div className="font-medium truncate">{flow.name}</div>
            <div className="text-right tabular-nums">
              {flow.displayValues.executions}
            </div>
            <div className="text-right tabular-nums">
              {flow.displayValues.completionRate}
            </div>
            <div className="text-right tabular-nums">
              {flow.displayValues.avgDuration}
            </div>
            <div className="flex items-center justify-center text-muted-foreground group-hover:text-foreground transition-colors">
              <ChevronRight className="h-4 w-4" />
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
