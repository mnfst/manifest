import type { RegistryItem as RegistryItemType } from '@manifest/shared';
import { RegistryItem } from './RegistryItem';

interface RegistryItemListProps {
  items: RegistryItemType[];
  onSelectItem: (item: RegistryItemType) => Promise<void>;
  onHoverItem?: (item: RegistryItemType | null, rect: DOMRect | null) => void;
}

/**
 * List of registry items within a category
 */
export function RegistryItemList({ items, onSelectItem, onHoverItem }: RegistryItemListProps) {
  if (items.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-8">
        No components in this category
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {items.map((item) => (
        <RegistryItem
          key={item.name}
          item={item}
          onSelect={onSelectItem}
          onHover={onHoverItem}
        />
      ))}
    </div>
  );
}
