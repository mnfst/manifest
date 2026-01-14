/**
 * Skeleton loading component for registry items
 * Displayed while fetching registry data
 */
export function RegistryItemSkeleton() {
  return (
    <div className="animate-pulse p-4 border rounded-lg">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 bg-gray-200 rounded-lg flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <div className="h-4 bg-gray-200 rounded w-1/3" />
            <div className="h-4 bg-gray-200 rounded w-12" />
          </div>
          <div className="h-3 bg-gray-200 rounded w-full" />
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
