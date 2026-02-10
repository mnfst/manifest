import { AlertTriangle } from 'lucide-react';
import type { Flow } from '@manifest/shared';
import { Button } from '@/components/ui/shadcn/button';
import { Spinner } from '@/components/ui/shadcn/spinner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/shadcn/dialog';

interface DeleteFlowModalProps {
  isOpen: boolean;
  flow: Flow | null;
  onClose: () => void;
  onConfirm: () => void;
  isLoading?: boolean;
}

/**
 * Modal for confirming flow deletion
 * Uses shadcn Dialog with automatic backdrop click, escape key, and focus trapping
 */
export function DeleteFlowModal({
  isOpen,
  flow,
  onClose,
  onConfirm,
  isLoading = false,
}: DeleteFlowModalProps) {
  const handleOpenChange = (open: boolean) => {
    if (!open && !isLoading) {
      onClose();
    }
  };

  if (!flow) return null;

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Flow</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete <strong>{flow.name}</strong>?
            This will permanently remove the flow and all its views. This action cannot be undone.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-destructive" />
          </div>
        </div>

        <DialogFooter className="flex-row gap-3">
          <Button variant="outline" onClick={onClose} disabled={isLoading} className="flex-1">
            Cancel
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={isLoading} className="flex-1">
            {isLoading && <Spinner className="w-4 h-4 mr-2" />}
            {isLoading ? 'Deleting...' : 'Delete Flow'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
