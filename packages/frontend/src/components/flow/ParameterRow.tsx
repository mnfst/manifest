import type { FlowParameter, ParameterType } from '@chatgpt-app-builder/shared';

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

  return (
    <div className="space-y-2 p-3 border rounded-lg bg-muted/30">
      <div className="flex items-start gap-2">
        {/* Name input */}
        <div className="flex-1 min-w-0">
          <input
            type="text"
            value={parameter.name}
            onChange={handleNameChange}
            placeholder="Parameter name"
            className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-background text-sm ${
              error ? 'border-destructive' : ''
            }`}
            disabled={disabled}
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
          className="px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-background text-sm min-w-[110px]"
          disabled={disabled}
        >
          {PARAMETER_TYPES.map((type) => (
            <option key={type.value} value={type.value}>
              {type.label}
            </option>
          ))}
        </select>

        {/* Optional checkbox */}
        <label className="flex items-center gap-1.5 px-2 py-2 text-sm whitespace-nowrap cursor-pointer">
          <input
            type="checkbox"
            checked={parameter.optional}
            onChange={handleOptionalChange}
            className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
            disabled={disabled}
          />
          <span className="text-muted-foreground">Optional</span>
        </label>

        {/* Remove button */}
        <button
          type="button"
          onClick={handleRemove}
          disabled={disabled}
          className="p-2 text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50"
          aria-label={`Remove parameter ${parameter.name || index + 1}`}
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
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
            />
          </svg>
        </button>
      </div>

      {/* Description input */}
      <input
        type="text"
        value={parameter.description}
        onChange={handleDescriptionChange}
        placeholder="Description (e.g., The user's email address)"
        className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-background text-sm"
        disabled={disabled}
        maxLength={200}
      />
    </div>
  );
}
