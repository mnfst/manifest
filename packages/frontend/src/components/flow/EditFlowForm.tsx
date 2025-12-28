import { useState, type FormEvent } from 'react';
import type { Flow, UpdateFlowRequest, FlowParameter } from '@chatgpt-app-builder/shared';
import { ParameterEditor, areParametersValid } from './ParameterEditor';

interface EditFlowFormProps {
  flow: Flow;
  onSave: (data: UpdateFlowRequest) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
  error?: string | null;
}

/**
 * Form for editing flow details
 * Edits name, description, toolName, and toolDescription
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
  const [toolName, setToolName] = useState(flow.toolName);
  const [toolDescription, setToolDescription] = useState(flow.toolDescription);
  const [parameters, setParameters] = useState<FlowParameter[]>(flow.parameters ?? []);
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    const trimmedName = name.trim();
    const trimmedToolName = toolName.trim();
    const trimmedToolDescription = toolDescription.trim();

    if (!trimmedName) {
      setValidationError('Flow name is required');
      return;
    }

    if (trimmedName.length > 300) {
      setValidationError('Flow name must be 300 characters or less');
      return;
    }

    if (!trimmedToolName) {
      setValidationError('Tool name is required');
      return;
    }

    if (trimmedToolName.length > 50) {
      setValidationError('Tool name must be 50 characters or less');
      return;
    }

    if (!/^[a-z][a-z0-9_]*$/.test(trimmedToolName)) {
      setValidationError('Tool name must start with a letter and contain only lowercase letters, numbers, and underscores');
      return;
    }

    if (!trimmedToolDescription) {
      setValidationError('Tool description is required');
      return;
    }

    if (trimmedToolDescription.length > 500) {
      setValidationError('Tool description must be 500 characters or less');
      return;
    }

    if (!areParametersValid(parameters)) {
      setValidationError('Please fix parameter errors before saving');
      return;
    }

    await onSave({
      name: trimmedName,
      description: description.trim() || undefined,
      toolName: trimmedToolName,
      toolDescription: trimmedToolDescription,
      parameters,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
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
            htmlFor="tool-name"
            className="block text-sm font-medium mb-1"
          >
            Tool Name
          </label>
          <input
            id="tool-name"
            type="text"
            value={toolName}
            onChange={(e) => setToolName(e.target.value)}
            placeholder="my_tool_name"
            className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-background font-mono text-sm"
            disabled={isLoading}
            maxLength={50}
            required
          />
          <p className="text-xs text-muted-foreground mt-1">
            Lowercase letters, numbers, and underscores only
          </p>
        </div>
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

      <div>
        <label
          htmlFor="tool-description"
          className="block text-sm font-medium mb-1"
        >
          Tool Description
        </label>
        <textarea
          id="tool-description"
          value={toolDescription}
          onChange={(e) => setToolDescription(e.target.value)}
          placeholder="What this tool does when invoked by ChatGPT..."
          className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-background min-h-[80px] resize-y"
          disabled={isLoading}
          maxLength={500}
          required
        />
        <p className="text-xs text-muted-foreground mt-1">
          This description helps ChatGPT understand when to use this tool
        </p>
      </div>

      {/* Parameters */}
      <div className="border-t pt-4">
        <ParameterEditor
          parameters={parameters}
          onChange={setParameters}
          disabled={isLoading}
        />
      </div>

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
          disabled={isLoading || !name.trim() || !toolName.trim() || !toolDescription.trim()}
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
