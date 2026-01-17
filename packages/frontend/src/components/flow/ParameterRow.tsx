import { Trash2 } from 'lucide-react';
import type { FlowParameter, ParameterType } from '@chatgpt-app-builder/shared';
import { Button } from '@/components/ui/shadcn/button';

const PARAMETER_TYPES: { value: ParameterType; label: string }[] = [
  { value: 'string', label: 'String' },
  { value: 'number', label: 'Number' },
  { value: 'integer', label: 'Integer' },
  { value: 'boolean', label: 'Boolean' },
];

interface ParameterRowProps {
  parameter: FlowParameter;
  index: number;
  onChange: (index: number, updated: FlowParameter) => void;
  onRemove: (index: number) => void;
  disabled?: boolean;
  error?: string;
}

/**
 * Single parameter row with name input, type dropdown, optional checkbox, and remove button
 */
export function ParameterRow({
  parameter,
  index,
  onChange,
  onRemove,
  disabled = false,
  error,
}: ParameterRowProps) {
  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(index, { ...parameter, name: e.target.value });
  };

  const handleTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onChange(index, { ...parameter, type: e.target.value as ParameterType });
  };

  const handleDescriptionChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(index, { ...parameter, description: e.target.value });
  };

  const handleOptionalChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(index, { ...parameter, optional: e.target.checked });
  };

  const handleRemove = () => {
    onRemove(index);
  };

  const isSystem = parameter.isSystem === true;
  const isFieldDisabled = disabled || isSystem;

  return (
    <div
      className={`space-y-2 p-3 border rounded-lg ${
        isSystem
          ? 'bg-muted/50 border-muted-foreground/20 opacity-75'
          : 'bg-muted/30'
      }`}
    >
      <div className="flex items-start gap-2">
        {/* System parameter indicator */}
        {isSystem && (
          <div className="flex items-center gap-1 px-2 py-2" title="System parameter (cannot be modified)">
            <svg
              className="w-4 h-4 text-muted-foreground"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
          </div>
        )}

        {/* Name input */}
        <div className="flex-1 min-w-0">
          <input
            type="text"
            value={parameter.name}
            onChange={handleNameChange}
            placeholder="Parameter name"
            className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-background text-sm ${
              error ? 'border-destructive' : ''
            } ${isSystem ? 'cursor-not-allowed' : ''}`}
            disabled={isFieldDisabled}
            maxLength={50}
          />
          {error && (
            <p className="text-xs text-destructive mt-1">{error}</p>
          )}
        </div>

        {/* Type dropdown */}
        <select
          value={parameter.type}
          onChange={handleTypeChange}
          className={`px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-background text-sm min-w-[110px] ${
            isSystem ? 'cursor-not-allowed' : ''
          }`}
          disabled={isFieldDisabled}
        >
          {PARAMETER_TYPES.map((type) => (
            <option key={type.value} value={type.value}>
              {type.label}
            </option>
          ))}
        </select>

        {/* Optional checkbox */}
        <label
          className={`flex items-center gap-1.5 px-2 py-2 text-sm whitespace-nowrap ${
            isSystem ? 'cursor-not-allowed' : 'cursor-pointer'
          }`}
        >
          <input
            type="checkbox"
            checked={parameter.optional}
            onChange={handleOptionalChange}
            className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
            disabled={isFieldDisabled}
          />
          <span className="text-muted-foreground">Optional</span>
        </label>

        {/* Remove button - hidden for system parameters */}
        {!isSystem && (
          <Button
            variant="ghost"
            size="icon"
            type="button"
            onClick={handleRemove}
            disabled={disabled}
            className="text-muted-foreground hover:text-destructive"
            aria-label={`Remove parameter ${parameter.name || index + 1}`}
          >
            <Trash2 className="w-5 h-5" />
          </Button>
        )}
      </div>

      {/* Description input */}
      <input
        type="text"
        value={parameter.description}
        onChange={handleDescriptionChange}
        placeholder="Description (e.g., The user's email address)"
        className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-background text-sm ${
          isSystem ? 'cursor-not-allowed' : ''
        }`}
        disabled={isFieldDisabled}
        maxLength={350}
      />
    </div>
  );
}
