import type { ThemeVariables } from '@manifest/shared';
import { ColorPickerControl } from './ColorPickerControl';
import { RadiusControl } from './RadiusControl';
import type { ThemeVariableGroup } from './types';

interface VariableControlGroupProps {
  /** Group configuration */
  group: ThemeVariableGroup;
  /** Current theme variables */
  variables: ThemeVariables;
  /** Callback when a variable changes */
  onChange: (key: keyof ThemeVariables, value: string) => void;
  /** Map of variable keys to validation errors */
  errors: Map<string, string>;
}

/**
 * Renders a group of related theme variable controls
 * Handles both color pickers and special controls (radius)
 */
export function VariableControlGroup({
  group,
  variables,
  onChange,
  errors,
}: VariableControlGroupProps) {
  return (
    <div className="border border-border rounded-lg p-3 bg-card">
      <h3 className="text-sm font-semibold text-foreground mb-2">{group.label}</h3>
      <div className="space-y-2">
        {group.variables.map((variableKey) => {
          const value = variables[variableKey] || '';
          const error = errors.get(variableKey);

          // Special handling for radius
          if (variableKey === '--radius') {
            return (
              <RadiusControl
                key={variableKey}
                value={value}
                onChange={onChange}
                error={error}
              />
            );
          }

          // Color picker for all other variables
          return (
            <ColorPickerControl
              key={variableKey}
              variableKey={variableKey}
              value={value}
              onChange={onChange}
              error={error}
            />
          );
        })}
      </div>
    </div>
  );
}
