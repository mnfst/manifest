import { useState, useCallback } from 'react';
import { HslColorPicker } from 'react-colorful';
import type { ThemeVariables } from '@chatgpt-app-builder/shared';
import {
  parseHslString,
  formatHslObject,
  hslStringToCss,
  type HslObject,
} from '../../lib/hsl-utils';

interface ColorPickerControlProps {
  /** Variable key (e.g., '--primary') */
  variableKey: keyof ThemeVariables;
  /** Current HSL value string */
  value: string;
  /** Callback when value changes */
  onChange: (key: keyof ThemeVariables, value: string) => void;
  /** Validation error message */
  error?: string;
  /** Display label */
  label?: string;
}

/**
 * Color picker control for a single theme variable
 * Uses react-colorful HslColorPicker with HSL string conversion
 */
export function ColorPickerControl({
  variableKey,
  value,
  onChange,
  error,
  label,
}: ColorPickerControlProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Parse HSL string to object for the picker
  const hslObject = parseHslString(value) || { h: 0, s: 0, l: 50 };

  // Handle picker color change
  const handleColorChange = useCallback(
    (newColor: HslObject) => {
      onChange(variableKey, formatHslObject(newColor));
    },
    [variableKey, onChange]
  );

  // Format display label from variable key
  const displayLabel = label || variableKey.replace('--', '').replace(/-/g, ' ');

  return (
    <div className="relative flex items-center gap-2">
      {/* Color swatch - click to open picker */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-8 h-8 rounded border shadow-sm flex-shrink-0 focus:outline-none focus:ring-2 focus:ring-ring ${
          error ? 'border-destructive' : 'border-input'
        }`}
        style={{ backgroundColor: hslStringToCss(value) }}
        aria-label={`Pick color for ${displayLabel}`}
      />
      <span className="text-xs text-muted-foreground capitalize">{displayLabel}</span>
      {/* Color picker popover */}
      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute left-0 top-full mt-1 z-50 p-2 bg-popover border border-border rounded-lg shadow-lg">
            <HslColorPicker
              color={hslObject}
              onChange={handleColorChange}
            />
          </div>
        </>
      )}
    </div>
  );
}
