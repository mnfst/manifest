import { MoreVertical, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/shadcn/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/shadcn/dropdown-menu';

interface ViewNodeDropdownProps {
  canDelete?: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onEditCode?: () => void;
}

/**
 * Dropdown menu for view node actions (Edit/Delete)
 * Uses shadcn DropdownMenu for accessibility and consistent styling
 */
export function ViewNodeDropdown({ canDelete, onEdit, onDelete, onEditCode }: ViewNodeDropdownProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          data-action="toggle-menu"
          onPointerDown={(e) => e.stopPropagation()}
          className="h-8 w-8 nodrag"
          aria-label="View actions"
          type="button"
          title="Actions"
        >
          <MoreVertical className="w-4 h-4 text-gray-500" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[120px]">
        <DropdownMenuItem
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            // Use onEditCode (unified editor) if available, otherwise fallback to onEdit (modal)
            if (onEditCode) {
              onEditCode();
            } else {
              onEdit();
            }
          }}
          className="nodrag"
        >
          <Pencil className="w-4 h-4 mr-2 text-blue-600" />
          Edit
        </DropdownMenuItem>
        <DropdownMenuItem
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            if (canDelete) {
              onDelete();
            }
          }}
          disabled={!canDelete}
          className={`nodrag ${canDelete ? 'text-red-600 focus:text-red-600' : ''}`}
          title={!canDelete ? "Cannot delete the last view" : undefined}
        >
          <Trash2 className="w-4 h-4 mr-2" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
