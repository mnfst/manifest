import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { FlowParameter } from '@chatgpt-app-builder/shared';
import { ParameterEditor, areParametersValid } from './ParameterEditor';

interface CreateFlowModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { name: string; description?: string; parameters?: FlowParameter[] }) => void;
  isLoading?: boolean;
  error?: string | null;
}

/**
 * Converts a display name to a valid snake_case tool name.
 */
function toSnakeCase(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .trim()
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

/**
 * Validates that a tool name is valid.
 */
function isValidToolName(toolName: string): boolean {
  return toolName.length > 0 && /^[a-z][a-z0-9_]*$/.test(toolName);
}

/**
 * Modal for creating a new flow with name and description
 * Tool name is auto-generated from the name using snake_case conversion
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
  const [parameters, setParameters] = useState<FlowParameter[]>([]);

  const toolName = toSnakeCase(name);
  const isToolNameValid = name.trim().length === 0 || isValidToolName(toolName);
  const parametersValid = areParametersValid(parameters);
  const canSubmit = name.trim().length > 0 && isValidToolName(toolName) && parametersValid && !isLoading;

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setName('');
      setDescription('');
      setParameters([]);
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
      parameters: parameters.length > 0 ? parameters : undefined,
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
            Give your flow a name and optional description. The tool name will be generated automatically.
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

          {/* Tool name preview */}
          {name.trim().length > 0 && (
            <div className="space-y-1">
              <label className="block text-sm font-medium text-muted-foreground">
                Tool Name (auto-generated)
              </label>
              <div className={`px-3 py-2 rounded-lg text-sm font-mono ${
                isToolNameValid
                  ? 'bg-muted text-foreground'
                  : 'bg-destructive/10 text-destructive'
              }`}>
                {toolName || '(invalid - name must contain letters or numbers)'}
              </div>
              {!isToolNameValid && (
                <p className="text-xs text-destructive">
                  Name must contain at least one letter or number
                </p>
              )}
            </div>
          )}

          {/* Description field */}
          <div className="space-y-2">
            <label htmlFor="flow-description" className="block text-sm font-medium">
              Description <span className="text-muted-foreground">(optional)</span>
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

          {/* Parameters */}
          <div className="border-t pt-4">
            <ParameterEditor
              parameters={parameters}
              onChange={setParameters}
              disabled={isLoading}
            />
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
