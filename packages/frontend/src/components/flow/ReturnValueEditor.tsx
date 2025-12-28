import { useEffect, useRef, useState } from 'react';
import { FileText, X } from 'lucide-react';
import type { ReturnValue } from '@chatgpt-app-builder/shared';

interface ReturnValueEditorProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (text: string) => void;
  returnValue?: ReturnValue | null;
  isLoading?: boolean;
  error?: string | null;
}

/**
 * Modal for creating/editing a return value
 * Allows editing the text content that will be returned from an MCP tool
 */
export function ReturnValueEditor({
  isOpen,
  onClose,
  onSave,
  returnValue,
  isLoading = false,
  error,
}: ReturnValueEditorProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const [text, setText] = useState(returnValue?.text || '');

  const isEditing = Boolean(returnValue);

  // Reset form when returnValue changes or modal opens
  useEffect(() => {
    if (isOpen) {
      setText(returnValue?.text || '');
    }
  }, [isOpen, returnValue]);

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
    if (!text.trim()) return;
    onSave(text);
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
        aria-labelledby="return-value-title"
      >
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-md bg-green-100 flex items-center justify-center">
              <FileText className="w-4 h-4 text-green-600" />
            </div>
            <h2 id="return-value-title" className="text-lg font-semibold">
              {isEditing ? 'Edit Return Value' : 'Add Return Value'}
            </h2>
          </div>
          <button
            onClick={onClose}
            disabled={isLoading}
            className="p-1 text-muted-foreground hover:text-foreground rounded transition-colors disabled:opacity-50"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <p className="text-sm text-muted-foreground">
            Enter the text content that will be returned when this MCP tool is called.
            This text will be sent back to the LLM for further processing.
          </p>

          <div className="space-y-2">
            <label htmlFor="returnValueText" className="block text-sm font-medium">
              Text Content <span className="text-red-500">*</span>
            </label>
            <textarea
              id="returnValueText"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Enter the text to return..."
              className="w-full px-3 py-2 border rounded-lg text-sm resize-none focus:ring-2 focus:ring-green-500 focus:border-green-500 font-mono"
              rows={8}
              required
              disabled={isLoading}
              autoFocus
            />
            <p className="text-xs text-muted-foreground">
              Tip: You can include dynamic placeholders or formatted text that will be processed by the LLM.
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
              disabled={isLoading || !text.trim()}
              className="px-4 py-2 text-sm font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center gap-2"
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
              {isEditing ? 'Save' : 'Add'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
