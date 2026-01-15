import { useEffect, useRef, useState, type FormEvent } from 'react';

interface CreateFlowModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { name: string; description?: string }) => void;
  isLoading?: boolean;
  error?: string | null;
}

/**
 * Modal for creating a new flow with name and description
 */
export function CreateFlowModal({
  isOpen,
  onClose,
  onSubmit,
  isLoading = false,
  error,
}: CreateFlowModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const canSubmit = name.trim().length > 0 && !isLoading;

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setName('');
      setDescription('');
      // Focus the name input after a short delay to ensure modal is rendered
      setTimeout(() => nameInputRef.current?.focus(), 100);
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
    if (!canSubmit) return;
    onSubmit({
      name: name.trim(),
      description: description.trim() || undefined,
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={handleBackdropClick}
    >
      <div
        ref={modalRef}
        className="bg-card border rounded-lg shadow-lg w-full max-w-lg max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
        aria-labelledby="flow-modal-title"
      >
        <div className="flex items-center justify-between p-4 border-b">
          <h2 id="flow-modal-title" className="text-lg font-semibold">
            Create New Flow
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

        <form onSubmit={handleSubmit} className="p-4 space-y-4 overflow-y-auto flex-1">
          <p className="text-muted-foreground text-sm">
            Give your flow a name and optional description.
          </p>

          {/* Name field */}
          <div className="space-y-2">
            <label htmlFor="flow-name" className="block text-sm font-medium">
              Name <span className="text-destructive">*</span>
            </label>
            <input
              ref={nameInputRef}
              id="flow-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Product Catalog"
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-background"
              disabled={isLoading}
              maxLength={300}
              required
            />
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{name.length}/300 characters</span>
            </div>
          </div>

          {/* Description field */}
          <div className="space-y-2">
            <label htmlFor="flow-description" className="block text-sm font-medium">
              Description <span className="text-muted-foreground">(optional - internal usage only, not exposed)</span>
            </label>
            <textarea
              id="flow-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Briefly describe what this flow does..."
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-background min-h-[80px] resize-y"
              disabled={isLoading}
              maxLength={500}
            />
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{description.length}/500 characters</span>
            </div>
          </div>

          {error && (
            <div className="p-3 bg-destructive/10 text-destructive rounded-lg text-sm">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!canSubmit}
              className="px-6 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
            >
              {isLoading ? 'Creating...' : 'Create Flow'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
