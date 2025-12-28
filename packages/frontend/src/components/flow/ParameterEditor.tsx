import { useMemo } from 'react';
import type { FlowParameter } from '@chatgpt-app-builder/shared';
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

    // Check for duplicates (case-insensitive)
    const normalizedName = trimmedName.toLowerCase();
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
    onChange([...parameters, newParameter]);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="block text-sm font-medium">
          Parameters <span className="text-muted-foreground">(optional)</span>
        </label>
        <button
          type="button"
          onClick={handleAddParameter}
          disabled={disabled}
          className="flex items-center gap-1 px-3 py-1.5 text-sm text-primary hover:bg-primary/10 rounded-lg transition-colors disabled:opacity-50"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 4v16m8-8H4"
            />
          </svg>
          Add Parameter
        </button>
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
