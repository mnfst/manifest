import { AlertTriangle } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '../ui/shadcn/alert-dialog';

interface ResetConfirmDialogProps {
  /** Whether the dialog is open */
  isOpen: boolean;
  /** Callback when user confirms reset */
  onConfirm: () => void;
  /** Callback when user cancels */
  onCancel: () => void;
}

/**
 * Confirmation dialog for resetting theme to defaults
 */
export function ResetConfirmDialog({
  isOpen,
  onConfirm,
  onCancel,
}: ResetConfirmDialogProps) {
  return (
    <AlertDialog open={isOpen} onOpenChange={(open) => !open && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
            </div>
            <div className="flex-1">
              <AlertDialogTitle>Reset to Default Theme?</AlertDialogTitle>
              <AlertDialogDescription className="mt-2">
                This will discard all your custom theme changes and restore the
                default shadcn color scheme. This action cannot be undone.
              </AlertDialogDescription>
            </div>
          </div>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Reset Theme
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
