import { useEffect, useRef, useState } from 'react';
import type { Flow } from '@chatgpt-app-builder/shared';

interface UserIntentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: { toolDescription: string; whenToUse: string; whenNotToUse: string }) => void;
  flow: Flow;
  isLoading?: boolean;
  error?: string | null;
}

/**
 * Modal for editing user intent configuration
 * Allows editing description, when to use, and when not to use fields
 */
export function UserIntentModal({
  isOpen,
  onClose,
  onSave,
  flow,
  isLoading = false,
  error,
}: UserIntentModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const [toolDescription, setToolDescription] = useState(flow.toolDescription || '');
  const [whenToUse, setWhenToUse] = useState(flow.whenToUse || '');
  const [whenNotToUse, setWhenNotToUse] = useState(flow.whenNotToUse || '');

  // Reset form when flow changes or modal opens
  useEffect(() => {
    if (isOpen) {
      setToolDescription(flow.toolDescription || '');
      setWhenToUse(flow.whenToUse || '');
      setWhenNotToUse(flow.whenNotToUse || '');
    }
  }, [isOpen, flow]);

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!toolDescription.trim()) return;
    onSave({ toolDescription, whenToUse, whenNotToUse });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={handleBackdropClick}
    >
      <div
        ref={modalRef}
        className="bg-card border rounded-lg shadow-lg w-full max-w-lg animate-in fade-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
      >
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-md bg-blue-100 flex items-center justify-center">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="currentColor"
                className="w-4 h-4 text-blue-600"
              >
                <path
                  fillRule="evenodd"
                  d="M4.848 2.771A49.144 49.144 0 0112 2.25c2.43 0 4.817.178 7.152.52 1.978.292 3.348 2.024 3.348 3.97v6.02c0 1.946-1.37 3.678-3.348 3.97a48.901 48.901 0 01-3.476.383.39.39 0 00-.297.17l-2.755 4.133a.75.75 0 01-1.248 0l-2.755-4.133a.39.39 0 00-.297-.17 48.9 48.9 0 01-3.476-.384c-1.978-.29-3.348-2.024-3.348-3.97V6.741c0-1.946 1.37-3.68 3.348-3.97zM6.75 8.25a.75.75 0 01.75-.75h9a.75.75 0 010 1.5h-9a.75.75 0 01-.75-.75zm.75 2.25a.75.75 0 000 1.5H12a.75.75 0 000-1.5H7.5z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <h2 id="dialog-title" className="text-lg font-semibold">
              Edit User Intent
            </h2>
          </div>
          <button
            onClick={onClose}
            disabled={isLoading}
            className="p-1 text-muted-foreground hover:text-foreground rounded transition-colors disabled:opacity-50"
            aria-label="Close dialog"
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
          <p className="text-sm text-muted-foreground">
            Configure when the AI should use this tool. These fields help the AI understand the tool's purpose and appropriate usage.
          </p>

          <div className="space-y-2">
            <label htmlFor="toolDescription" className="block text-sm font-medium">
              Description <span className="text-red-500">*</span>
            </label>
            <textarea
              id="toolDescription"
              value={toolDescription}
              onChange={(e) => setToolDescription(e.target.value)}
              placeholder="Describe what this tool does..."
              className="w-full px-3 py-2 border rounded-lg text-sm resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              rows={3}
              maxLength={500}
              required
              disabled={isLoading}
            />
            <p className="text-xs text-muted-foreground text-right">
              {toolDescription.length}/500
            </p>
          </div>

          <div className="space-y-2">
            <label htmlFor="whenToUse" className="block text-sm font-medium">
              When to Use
            </label>
            <textarea
              id="whenToUse"
              value={whenToUse}
              onChange={(e) => setWhenToUse(e.target.value)}
              placeholder="Describe scenarios when the AI should use this tool..."
              className="w-full px-3 py-2 border rounded-lg text-sm resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              rows={2}
              maxLength={500}
              disabled={isLoading}
            />
            <p className="text-xs text-muted-foreground text-right">
              {whenToUse.length}/500
            </p>
          </div>

          <div className="space-y-2">
            <label htmlFor="whenNotToUse" className="block text-sm font-medium">
              When Not to Use
            </label>
            <textarea
              id="whenNotToUse"
              value={whenNotToUse}
              onChange={(e) => setWhenNotToUse(e.target.value)}
              placeholder="Describe scenarios when the AI should NOT use this tool..."
              className="w-full px-3 py-2 border rounded-lg text-sm resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              rows={2}
              maxLength={500}
              disabled={isLoading}
            />
            <p className="text-xs text-muted-foreground text-right">
              {whenNotToUse.length}/500
            </p>
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="px-4 py-2 text-sm font-medium border rounded-lg hover:bg-muted transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading || !toolDescription.trim()}
              className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2"
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
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
