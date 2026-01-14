import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { AppRole } from '@chatgpt-app-builder/shared';

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
  const modalRef = useRef<HTMLDivElement>(null);
  const [hasConfirmed, setHasConfirmed] = useState(false);

  // Reset confirmation state when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      setHasConfirmed(false);
    }
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isLoading) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, isLoading, onClose]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && !isLoading) {
      onClose();
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setHasConfirmed(true);
    onConfirm();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={handleBackdropClick}
    >
      <div
        ref={modalRef}
        className="bg-card border rounded-lg shadow-lg w-full max-w-md animate-in fade-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
        aria-labelledby="invite-modal-title"
      >
        <div className="flex items-center justify-between p-4 border-b">
          <h2 id="invite-modal-title" className="text-lg font-semibold">
            Invite Collaborator
          </h2>
          <button
            onClick={onClose}
            disabled={isLoading}
            className="p-1 text-muted-foreground hover:text-foreground rounded transition-colors disabled:opacity-50"
            aria-label="Close modal"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Info message */}
          <div className="flex items-start gap-3 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
            <svg
              className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
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
              <label className="block text-sm font-medium text-muted-foreground mb-1">
                Email
              </label>
              <div className="px-3 py-2 bg-muted rounded-md text-sm">
                {email}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">
                Role
              </label>
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
            <div className="p-3 bg-destructive/10 text-destructive rounded-lg text-sm">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="flex-1 py-2 border rounded-lg font-medium hover:bg-muted transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity flex items-center justify-center gap-2"
            >
              {isLoading && (
                <svg
                  className="w-4 h-4 animate-spin"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
              )}
              {isLoading
                ? hasConfirmed
                  ? 'Sending...'
                  : 'Sending...'
                : 'Send Invitation'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
