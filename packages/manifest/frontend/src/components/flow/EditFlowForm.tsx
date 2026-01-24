import { useState, type FormEvent } from 'react';
import type { Flow, UpdateFlowRequest } from '@manifest/shared';
import { Button } from '@/components/ui/shadcn/button';
import { Spinner } from '@/components/ui/shadcn/spinner';
import { Input } from '@/components/ui/shadcn/input';
import { Label } from '@/components/ui/shadcn/label';
import { Textarea } from '@/components/ui/shadcn/textarea';
import { Alert, AlertDescription } from '@/components/ui/shadcn/alert';

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
      <div className="space-y-2">
        <Label htmlFor="flow-name">
          Flow Name
        </Label>
        <Input
          id="flow-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="My Flow"
          disabled={isLoading}
          maxLength={300}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="flow-description">
          Description (optional)
        </Label>
        <Textarea
          id="flow-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="A brief description of this flow..."
          className="min-h-[60px] resize-y"
          disabled={isLoading}
          maxLength={500}
        />
      </div>

      <p className="text-xs text-muted-foreground">
        To configure MCP tool properties (tool name, description, parameters), edit the trigger node on the canvas.
      </p>

      {(error || validationError) && (
        <Alert variant="destructive">
          <AlertDescription>{error || validationError}</AlertDescription>
        </Alert>
      )}

      <div className="flex justify-end gap-3 pt-2">
        <Button variant="outline" onClick={onCancel} disabled={isLoading}>
          Cancel
        </Button>
        <Button type="submit" disabled={isLoading || !name.trim()}>
          {isLoading && <Spinner className="w-4 h-4 mr-2" />}
          {isLoading ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>
    </form>
  );
}
