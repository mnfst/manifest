import { AppForm } from './AppForm';
import { Alert, AlertDescription } from '@/components/ui/shadcn/alert';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/shadcn/dialog';

interface CreateAppModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { name: string; description?: string }) => void;
  isLoading?: boolean;
  error?: string | null;
}

/**
 * Modal wrapper for AppForm
 * Uses shadcn Dialog with automatic backdrop click, escape key, and focus trapping
 */
export function CreateAppModal({
  isOpen,
  onClose,
  onSubmit,
  isLoading = false,
  error,
}: CreateAppModalProps) {
  const handleOpenChange = (open: boolean) => {
    if (!open && !isLoading) {
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create New App</DialogTitle>
        </DialogHeader>

        <AppForm onSubmit={onSubmit} isLoading={isLoading} />

        {error && (
          <Alert variant="destructive" className="mt-4">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </DialogContent>
    </Dialog>
  );
}
