/**
 * AppearanceTab - Form-based visual configuration for UI nodes.
 * Dynamically generates form controls based on the component's appearance schema.
 */
import {
  type AppearanceConfig,
  type AppearanceOptionSchema,
  type ComponentAppearanceSchema,
  type RegistryAppearanceOption,
  COMPONENT_APPEARANCE_REGISTRY,
  getDefaultAppearanceConfig,
} from '@manifest/shared';
import { Switch } from '../ui/shadcn/switch';
import { Select } from '../ui/select';

interface AppearanceTabProps {
  /** Component type to get the schema for */
  componentType: string;
  /** Current appearance configuration */
  config: AppearanceConfig;
  /** Callback when configuration changes */
  onChange: (config: AppearanceConfig) => void;
  /** Whether the form is disabled */
  disabled?: boolean;
  /** Custom appearance options (for registry components) - overrides static registry */
  customOptions?: RegistryAppearanceOption[];
}

export function AppearanceTab({
  componentType,
  config,
  onChange,
  disabled = false,
  customOptions,
}: AppearanceTabProps) {
  // Use custom options if provided (for registry components), otherwise fall back to static registry
  const schema: ComponentAppearanceSchema | undefined = customOptions && customOptions.length > 0
    ? { componentType, options: customOptions as AppearanceOptionSchema[] }
    : COMPONENT_APPEARANCE_REGISTRY[componentType] as ComponentAppearanceSchema | undefined;

  // Handle empty state - no configurable options
  if (!schema || schema.options.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
          <svg
            className="w-8 h-8 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
            />
          </svg>
        </div>
        <h3 className="text-sm font-medium text-gray-900 mb-1">
          No Appearance Options
        </h3>
        <p className="text-sm text-gray-500 max-w-sm">
          This component doesn't have configurable appearance options.
          Use the Code tab to customize it directly.
        </p>
      </div>
    );
  }

  // Get default values for any missing config keys
  const defaults = getDefaultAppearanceConfig(componentType);
  const effectiveConfig = { ...defaults, ...config };

  // Handle value change for a specific option
  const handleValueChange = (key: string, value: string | number | boolean) => {
    onChange({
      ...effectiveConfig,
      [key]: value,
    });
  };

  return (
    <div className="space-y-6">
      {schema.options.map((option) => (
        <FormField
          key={option.key}
          option={option}
          value={effectiveConfig[option.key]}
          onChange={(value) => handleValueChange(option.key, value)}
          disabled={disabled}
        />
      ))}
    </div>
  );
}

interface FormFieldProps {
  option: AppearanceOptionSchema;
  value: string | number | boolean;
  onChange: (value: string | number | boolean) => void;
  disabled: boolean;
}

function FormField({ option, value, onChange, disabled }: FormFieldProps) {
  const fieldId = `appearance-${option.key}`;

  return (
    <div>
      <div className="flex items-center justify-between">
        <label htmlFor={fieldId} className="block text-sm font-medium text-gray-700">
          {option.label}
        </label>
        {option.type === 'boolean' && (
          <Switch
            id={fieldId}
            checked={value as boolean}
            onCheckedChange={onChange}
            disabled={disabled}
          />
        )}
      </div>

      {option.type === 'enum' && option.enumValues && (
        <Select
          id={fieldId}
          value={value as string | number}
          onValueChange={onChange}
          options={option.enumValues.map((v) => ({
            value: v,
            label: String(v),
          }))}
          disabled={disabled}
          className="mt-1"
        />
      )}

      {option.type === 'string' && (
        <input
          id={fieldId}
          type="text"
          value={value as string}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary disabled:opacity-50"
        />
      )}

      {option.type === 'number' && (
        <input
          id={fieldId}
          type="number"
          value={value as number}
          onChange={(e) => onChange(Number(e.target.value))}
          disabled={disabled}
          className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary disabled:opacity-50"
        />
      )}

      {option.description && (
        <p className="text-xs text-gray-500 mt-1">{option.description}</p>
      )}
    </div>
  );
}
