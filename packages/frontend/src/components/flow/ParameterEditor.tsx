import { useMemo } from 'react';
import { Plus } from 'lucide-react';
import type { FlowParameter } from '@chatgpt-app-builder/shared';
import { SYSTEM_PARAMETER_NAMES } from '@chatgpt-app-builder/shared';
import { Button } from '@/components/ui/shadcn/button';
import { ParameterRow } from './ParameterRow';

interface ParameterEditorProps {
  parameters: FlowParameter[];
  onChange: (parameters: FlowParameter[]) => void;
  disabled?: boolean;
}

/**
 * Validates parameters and returns error messages keyed by index
 */
function validateParameters(parameters: FlowParameter[]): Map<number, string> {
  const errors = new Map<number, string>();
  const seenNames = new Map<string, number>();

  for (let i = 0; i < parameters.length; i++) {
    const param = parameters[i];
    const trimmedName = param.name.trim();

    // Skip validation for system parameters (they are pre-validated)
    if (param.isSystem) {
      seenNames.set(trimmedName.toLowerCase(), i);
      continue;
    }

    // Check for empty name
    if (trimmedName.length === 0) {
      errors.set(i, 'Name is required');
      continue;
    }

    // Check for max length
    if (trimmedName.length > 50) {
      errors.set(i, 'Name must be 50 characters or less');
      continue;
    }

    // Check for reserved system parameter names
    const normalizedName = trimmedName.toLowerCase();
    if (SYSTEM_PARAMETER_NAMES.includes(normalizedName as typeof SYSTEM_PARAMETER_NAMES[number])) {
      errors.set(i, `"${trimmedName}" is a reserved system parameter name`);
      continue;
    }

    // Check for duplicates (case-insensitive)
    if (seenNames.has(normalizedName)) {
      const firstIndex = seenNames.get(normalizedName)!;
      errors.set(i, `Duplicate of parameter ${firstIndex + 1}`);
    } else {
      seenNames.set(normalizedName, i);
    }
  }

  return errors;
}

/**
 * Editor for managing a list of flow parameters
 * Supports add, edit, remove operations with validation
 */
export function ParameterEditor({
  parameters,
  onChange,
  disabled = false,
}: ParameterEditorProps) {
  const errors = useMemo(() => validateParameters(parameters), [parameters]);

  const handleParameterChange = (index: number, updated: FlowParameter) => {
    const newParameters = [...parameters];
    newParameters[index] = updated;
    onChange(newParameters);
  };

  const handleRemoveParameter = (index: number) => {
    const newParameters = parameters.filter((_, i) => i !== index);
    onChange(newParameters);
  };

  const handleAddParameter = () => {
    const newParameter: FlowParameter = {
      name: '',
      type: 'string',
      description: '',
      optional: false,
    };
    // Add new parameter after system parameters to keep them first
    const systemParams = parameters.filter((p) => p.isSystem);
    const userParams = parameters.filter((p) => !p.isSystem);
    onChange([...systemParams, ...userParams, newParameter]);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="block text-sm font-medium">
          Parameters <span className="text-muted-foreground">(optional)</span>
        </label>
        <Button
          variant="ghost"
          size="sm"
          type="button"
          onClick={handleAddParameter}
          disabled={disabled}
          className="flex items-center gap-1 text-sm text-primary hover:bg-primary/10"
        >
          <Plus className="w-4 h-4" />
          Add Parameter
        </Button>
      </div>

      {parameters.length === 0 ? (
        <p className="text-sm text-muted-foreground py-2">
          No parameters defined. Click "Add Parameter" to add one.
        </p>
      ) : (
        <div className="space-y-2">
          {parameters.map((param, index) => (
            <ParameterRow
              key={index}
              parameter={param}
              index={index}
              onChange={handleParameterChange}
              onRemove={handleRemoveParameter}
              disabled={disabled}
              error={errors.get(index)}
            />
          ))}
        </div>
      )}

      {errors.size > 0 && (
        <p className="text-xs text-destructive">
          Please fix the parameter errors above before submitting.
        </p>
      )}
    </div>
  );
}

/**
 * Check if parameters are valid (no errors)
 */
export function areParametersValid(parameters: FlowParameter[]): boolean {
  const errors = validateParameters(parameters);
  return errors.size === 0;
}
