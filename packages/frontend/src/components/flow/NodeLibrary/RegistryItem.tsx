import { useState, useCallback, useRef } from 'react';
import { LayoutTemplate, GripVertical, Loader2 } from 'lucide-react';
import type { RegistryItem as RegistryItemType } from '@chatgpt-app-builder/shared';

interface RegistryItemProps {
  item: RegistryItemType;
  onSelect: (item: RegistryItemType) => Promise<void>;
  onHover?: (item: RegistryItemType | null, rect: DOMRect | null) => void;
}

/**
 * Single registry item component
 * Displays component info and handles selection with loading/error states
 * Supports drag-and-drop to canvas
 */
export function RegistryItem({ item, onSelect, onHover }: RegistryItemProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const itemRef = useRef<HTMLDivElement>(null);

  const handleClick = async () => {
    if (loading) return;

    setLoading(true);
    setError(null);

    try {
      await onSelect(item);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add component');
    } finally {
      setLoading(false);
    }
  };

  const handleDragStart = useCallback((e: React.DragEvent) => {
    if (loading) {
      e.preventDefault();
      return;
    }
    // Set registry item name as drag data
    e.dataTransfer.setData('application/x-registry-item', item.name);
    e.dataTransfer.effectAllowed = 'copy';
  }, [loading, item.name]);

  const handleMouseEnter = useCallback(() => {
    if (onHover && item.meta?.preview && itemRef.current) {
      onHover(item, itemRef.current.getBoundingClientRect());
    }
  }, [item, onHover]);

  const handleMouseLeave = useCallback(() => {
    if (onHover) {
      onHover(null, null);
    }
  }, [onHover]);

  // Use title or fallback to name
  const displayTitle = item.title || item.name;
  // Use description or fallback
  const displayDescription = item.description || 'No description';
  // Preview image URL
  const previewUrl = item.meta?.preview;

  return (
    <div
      ref={itemRef}
      draggable={!loading}
      onDragStart={handleDragStart}
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={`
        w-full p-4 border rounded-lg text-left transition-all group
        ${loading
          ? 'opacity-70 cursor-wait'
          : 'hover:border-primary hover:bg-primary/5 cursor-grab active:cursor-grabbing'
        }
        ${error ? 'border-red-300' : ''}
      `}
    >
      <div className="flex items-start gap-3">
        {/* Drag handle indicator */}
        <div className="flex-shrink-0 text-gray-400">
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <GripVertical className="w-4 h-4" />
          )}
        </div>

        {/* Icon or Preview thumbnail */}
        <div className="
          flex items-center justify-center flex-shrink-0
          w-10 h-10 rounded-lg transition-colors overflow-hidden
          bg-gray-50 group-hover:bg-gray-100
        ">
          {previewUrl ? (
            <img
              src={previewUrl}
              alt={displayTitle}
              className="w-full h-full object-cover"
            />
          ) : (
            <LayoutTemplate className="w-5 h-5 text-gray-600" />
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-2">
            <h3 className="font-medium text-foreground leading-tight" title={displayTitle}>
              {displayTitle}
            </h3>
            {/* Version badge */}
            <span className="
              text-[10px] font-medium px-1.5 py-0.5 rounded-full
              bg-blue-100 text-blue-600 flex-shrink-0 mt-0.5
            ">
              v{item.version}
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-1 line-clamp-2" title={displayDescription}>
            {displayDescription}
          </p>
          {/* Error message */}
          {error && (
            <p className="text-xs text-red-600 mt-1">
              {error} - Click to retry
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
