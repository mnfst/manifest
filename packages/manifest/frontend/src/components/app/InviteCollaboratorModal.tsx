import { useState, useEffect, type FormEvent } from 'react';
import { AlertTriangle } from 'lucide-react';
import type { AppRole } from '@manifest/shared';
import { Button } from '@/components/ui/shadcn/button';
import { Spinner } from '@/components/ui/shadcn/spinner';
import { Label } from '@/components/ui/shadcn/label';
import { Alert, AlertDescription } from '@/components/ui/shadcn/alert';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/shadcn/dialog';

interface InviteCollaboratorModalProps {
  isOpen: boolean;
  email: string;
  role: AppRole;
  onClose: () => void;
  onConfirm: () => void;
  isLoading?: boolean;
  error?: string | null;
}

/**
 * Modal for confirming invitation of a non-registered collaborator
 * Shows when attempting to add a collaborator who doesn't exist in the system
 */
export function InviteCollaboratorModal({
  isOpen,
  email,
  role,
  onClose,
  onConfirm,
  isLoading = false,
  error,
}: InviteCollaboratorModalProps) {
  const [hasConfirmed, setHasConfirmed] = useState(false);

  // Reset confirmation state when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      setHasConfirmed(false);
    }
  }, [isOpen]);

  const handleOpenChange = (open: boolean) => {
    if (!open && !isLoading) {
      onClose();
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setHasConfirmed(true);
    onConfirm();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite Collaborator</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Info message */}
          <div className="flex items-start gap-3 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
            <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-amber-700 dark:text-amber-300">
              <p className="font-medium">Collaborator not found</p>
              <p className="mt-1">
                No account exists for <strong>{email}</strong>. Would you like
                to send them an invitation email?
              </p>
            </div>
          </div>

          {/* Invitation details */}
          <div className="space-y-3">
            <div>
              <Label className="mb-1 text-muted-foreground">
                Email
              </Label>
              <div className="px-3 py-2 bg-muted rounded-md text-sm">
                {email}
              </div>
            </div>

            <div>
              <Label className="mb-1 text-muted-foreground">
                Role
              </Label>
              <div className="px-3 py-2 bg-muted rounded-md text-sm capitalize">
                {role}
              </div>
            </div>
          </div>

          {/* What happens next */}
          <div className="text-sm text-muted-foreground space-y-1">
            <p className="font-medium">What happens next:</p>
            <ul className="list-disc list-inside space-y-1 ml-1">
              <li>An invitation email will be sent to {email}</li>
              <li>They can sign up using the link in the email</li>
              <li>Once they sign up, they'll automatically get {role} access</li>
            </ul>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <DialogFooter className="gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isLoading}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isLoading}
              className="flex-1"
            >
              {isLoading && <Spinner className="w-4 h-4 mr-2" />}
              {isLoading
                ? hasConfirmed
                  ? 'Sending...'
                  : 'Sending...'
                : 'Send Invitation'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
