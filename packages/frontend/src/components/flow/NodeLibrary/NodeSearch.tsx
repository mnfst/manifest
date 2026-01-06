import { Search, X } from 'lucide-react';

interface NodeSearchProps {
  value: string;
  onChange: (value: string) => void;
  onClear: () => void;
}

/**
 * NodeSearch component - search input for filtering nodes
 */
export function NodeSearch({ value, onChange, onClear }: NodeSearchProps) {
  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search nodes..."
        className="
          w-full pl-10 pr-10 py-2
          border rounded-lg
          bg-background text-foreground
          placeholder:text-muted-foreground
          focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent
          transition-all
        "
      />
      {value && (
        <button
          onClick={onClear}
          className="
            absolute right-3 top-1/2 -translate-y-1/2
            p-1 rounded-full
            text-muted-foreground hover:text-foreground hover:bg-muted
            transition-colors
          "
          aria-label="Clear search"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
