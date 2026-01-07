import { useState, type FormEvent } from 'react';
import type { Flow, UpdateFlowRequest } from '@chatgpt-app-builder/shared';

interface EditFlowFormProps {
  flow: Flow;
  onSave: (data: UpdateFlowRequest) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
  error?: string | null;
}

/**
 * Form for editing flow details
 * Edits name and description only.
 * Tool properties (toolName, toolDescription, parameters) are now
 * configured on individual trigger nodes via NodeEditModal.
 */
export function EditFlowForm({
  flow,
  onSave,
  onCancel,
  isLoading = false,
  error,
}: EditFlowFormProps) {
  const [name, setName] = useState(flow.name);
  const [description, setDescription] = useState(flow.description || '');
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    const trimmedName = name.trim();

    if (!trimmedName) {
      setValidationError('Flow name is required');
      return;
    }

    if (trimmedName.length > 300) {
      setValidationError('Flow name must be 300 characters or less');
      return;
    }

    await onSave({
      name: trimmedName,
      description: description.trim() || undefined,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label
          htmlFor="flow-name"
          className="block text-sm font-medium mb-1"
        >
          Flow Name
        </label>
        <input
          id="flow-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="My Flow"
          className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-background"
          disabled={isLoading}
          maxLength={300}
          required
        />
      </div>

      <div>
        <label
          htmlFor="flow-description"
          className="block text-sm font-medium mb-1"
        >
          Description (optional)
        </label>
        <textarea
          id="flow-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="A brief description of this flow..."
          className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-background min-h-[60px] resize-y"
          disabled={isLoading}
          maxLength={500}
        />
      </div>

      <p className="text-xs text-muted-foreground">
        To configure MCP tool properties (tool name, description, parameters), edit the trigger node on the canvas.
      </p>

      {(error || validationError) && (
        <div className="p-3 bg-destructive/10 text-destructive rounded-lg text-sm">
          {error || validationError}
        </div>
      )}

      <div className="flex justify-end gap-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={isLoading}
          className="px-4 py-2 text-sm font-medium border rounded-lg hover:bg-muted transition-colors disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isLoading || !name.trim()}
          className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity flex items-center gap-2"
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
          {isLoading ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </form>
  );
}
