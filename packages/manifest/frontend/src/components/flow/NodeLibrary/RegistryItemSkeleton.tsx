import { Skeleton } from '@/components/ui/shadcn/skeleton';

/**
 * Skeleton loading component for registry items
 * Displayed while fetching registry data
 */
export function RegistryItemSkeleton() {
  return (
    <div className="p-4 border rounded-lg">
      <div className="flex items-start gap-3">
        <Skeleton className="w-10 h-10 rounded-lg flex-shrink-0" />
        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-4 w-12" />
          </div>
          <Skeleton className="h-3 w-full" />
        </div>
      </div>
    </div>
  );
}

/**
 * Multiple skeleton items for loading state
 */
export function RegistryItemSkeletonList({ count = 4 }: { count?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: count }).map((_, index) => (
        <RegistryItemSkeleton key={index} />
      ))}
    </div>
  );
}
