import type { Flow } from '@manifest/shared';
import { FlowCard } from './FlowCard';
import { Button } from '@/components/ui/shadcn/button';
import { BarChart3 } from 'lucide-react';
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
} from '@/components/ui/shadcn/empty';

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
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <BarChart3 />
          </EmptyMedia>
          <EmptyTitle>No flows yet</EmptyTitle>
          <EmptyDescription>
            Create your first flow by describing what you want to build.
          </EmptyDescription>
        </EmptyHeader>
        {onCreateFlow && (
          <EmptyContent>
            <Button onClick={onCreateFlow}>
              Create New Flow
            </Button>
          </EmptyContent>
        )}
      </Empty>
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
