import { Activity } from 'lucide-react';
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from '@/components/ui/shadcn/empty';

export function ExecutionEmptyState() {
  return (
    <Empty className="h-64 border-0">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Activity />
        </EmptyMedia>
        <EmptyTitle>No sessions yet</EmptyTitle>
        <EmptyDescription>
          This flow hasn't been run yet. Run it via the MCP server to see
          session history here.
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}
