import type { ThemeVariables } from '@chatgpt-app-builder/shared';

interface RadiusControlProps {
  /** Current radius value */
  value: string;
  /** Callback when value changes */
  onChange: (key: keyof ThemeVariables, value: string) => void;
  /** Validation error message */
  error?: string;
}

/**
 * Control for the --radius theme variable
 * Provides a slider and manual input
 */
export function RadiusControl({ value, onChange, error }: RadiusControlProps) {
  // Parse the numeric value from rem (default unit)
  const parseRadius = (val: string): number => {
    const match = val.match(/^([\d.]+)(rem|px)?$/);
    if (!match) return 0.5;
    const num = parseFloat(match[1]);
    const unit = match[2] || 'rem';
    // Convert px to rem approximation (16px = 1rem)
    return unit === 'px' ? num / 16 : num;
  };

  const numericValue = parseRadius(value);

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    onChange('--radius', `${val}rem`);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-foreground">
          Border Radius
        </label>
        {/* Preview box */}
        <div
          className="w-10 h-10 bg-primary"
          style={{ borderRadius: value }}
        />
      </div>
      {/* Slider */}
      <input
        type="range"
        min="0"
        max="2"
        step="0.05"
        value={numericValue}
        onChange={handleSliderChange}
        className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
      />
      {/* Value display */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>0</span>
        <input
          type="text"
          value={value}
          onChange={(e) => onChange('--radius', e.target.value)}
          className={`w-20 px-2 py-1 text-xs font-mono text-center border rounded bg-background focus:outline-none focus:ring-1 focus:ring-ring ${
            error ? 'border-destructive' : 'border-input'
          }`}
          placeholder="0.5rem"
        />
        <span>2rem</span>
      </div>
      {/* Error message */}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
