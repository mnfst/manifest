import { ChevronRight, LayoutTemplate } from 'lucide-react';
import type { RegistryCategoryInfo } from '@chatgpt-app-builder/shared';
import { Button } from '@/components/ui/shadcn/button';

interface CategoryListProps {
  categories: RegistryCategoryInfo[];
  onSelectCategory: (categoryId: string) => void;
}

/**
 * Display a list of registry categories
 * Each category shows its name and item count
 */
export function CategoryList({ categories, onSelectCategory }: CategoryListProps) {
  if (categories.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-8">
        No categories available
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {categories.map((category) => (
        <CategoryItem
          key={category.id}
          category={category}
          onClick={() => onSelectCategory(category.id)}
        />
      ))}
    </div>
  );
}

interface CategoryItemProps {
  category: RegistryCategoryInfo;
  onClick: () => void;
}

/**
 * Single category item with icon, name, and item count
 */
function CategoryItem({ category, onClick }: CategoryItemProps) {
  return (
    <Button
      variant="ghost"
      onClick={onClick}
      className="w-full p-3 h-auto rounded-lg border cursor-pointer transition-all group text-left justify-start hover:border-primary hover:bg-primary/5"
    >
      <div className="flex items-center gap-3 w-full">
        <div className="w-10 h-10 rounded-lg flex items-center justify-center transition-colors bg-gray-100 group-hover:bg-gray-200">
          <LayoutTemplate className="w-5 h-5 text-gray-600" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-foreground capitalize">{category.displayName}</h3>
          <p className="text-sm text-muted-foreground">
            {category.itemCount} {category.itemCount === 1 ? 'component' : 'components'}
          </p>
        </div>
        <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
      </div>
    </Button>
  );
}
