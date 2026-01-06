import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export function Pagination({ page, totalPages, onPageChange }: PaginationProps) {
  if (totalPages <= 1) return null;

  const hasPrev = page > 1;
  const hasNext = page < totalPages;

  // Generate page numbers to show
  const getPageNumbers = (): (number | 'ellipsis')[] => {
    const pages: (number | 'ellipsis')[] = [];
    const showPages = 5;

    if (totalPages <= showPages) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Always show first page
      pages.push(1);

      // Calculate range around current page
      let start = Math.max(2, page - 1);
      let end = Math.min(totalPages - 1, page + 1);

      // Adjust to show at least 3 pages in the middle
      if (page <= 3) {
        end = 4;
      } else if (page >= totalPages - 2) {
        start = totalPages - 3;
      }

      // Add ellipsis or pages
      if (start > 2) {
        pages.push('ellipsis');
      }

      for (let i = start; i <= end; i++) {
        pages.push(i);
      }

      if (end < totalPages - 1) {
        pages.push('ellipsis');
      }

      // Always show last page
      pages.push(totalPages);
    }

    return pages;
  };

  const pageNumbers = getPageNumbers();

  return (
    <div className="flex items-center justify-center gap-1 py-3 px-4 border-t border-gray-200">
      <button
        onClick={() => onPageChange(page - 1)}
        disabled={!hasPrev}
        className="p-1 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
        aria-label="Previous page"
      >
        <ChevronLeft className="w-5 h-5" />
      </button>

      {pageNumbers.map((p, index) =>
        p === 'ellipsis' ? (
          <span key={`ellipsis-${index}`} className="px-2 text-gray-400">
            ...
          </span>
        ) : (
          <button
            key={p}
            onClick={() => onPageChange(p)}
            className={`min-w-[32px] h-8 px-2 rounded text-sm font-medium transition-colors ${
              p === page
                ? 'bg-blue-500 text-white'
                : 'hover:bg-gray-100 text-gray-700'
            }`}
          >
            {p}
          </button>
        )
      )}

      <button
        onClick={() => onPageChange(page + 1)}
        disabled={!hasNext}
        className="p-1 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
        aria-label="Next page"
      >
        <ChevronRight className="w-5 h-5" />
      </button>
    </div>
  );
}
