import { MousePointer2 } from 'lucide-react';
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from '@/components/ui/shadcn/empty';

export function ExecutionDetailPlaceholder() {
  return (
    <Empty className="h-full border-0">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <MousePointer2 />
        </EmptyMedia>
        <EmptyTitle>Select a session</EmptyTitle>
        <EmptyDescription>
          Click on a session in the list to view its details, including initial
          parameters and node-by-node data.
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}
