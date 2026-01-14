import type { ThemeVariables } from '@chatgpt-app-builder/shared';

/**
 * HSL color representation for react-colorful picker
 */
export interface HslObject {
  h: number; // Hue: 0-360 degrees
  s: number; // Saturation: 0-100 percent
  l: number; // Lightness: 0-100 percent
}

// Patterns for validation
const HSL_PATTERN = /^(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)%\s+(\d+(?:\.\d+)?)%$/;
const RADIUS_PATTERN = /^(\d+(?:\.\d+)?)(rem|px|em)$/;

/**
 * Parse HSL string to HslObject
 * "222.2 47.4% 11.2%" -> { h: 222.2, s: 47.4, l: 11.2 }
 */
export function parseHslString(hslString: string): HslObject | null {
  const match = hslString.trim().match(HSL_PATTERN);
  if (!match) return null;

  const [, h, s, l] = match;
  return {
    h: parseFloat(h),
    s: parseFloat(s),
    l: parseFloat(l),
  };
}

/**
 * Format HslObject to HSL string
 * { h: 222.2, s: 47.4, l: 11.2 } -> "222.2 47.4% 11.2%"
 */
export function formatHslObject(hsl: HslObject): string {
  // Round to 1 decimal place for cleaner output
  const h = Math.round(hsl.h * 10) / 10;
  const s = Math.round(hsl.s * 10) / 10;
  const l = Math.round(hsl.l * 10) / 10;
  return `${h} ${s}% ${l}%`;
}

/**
 * Validate HSL string format
 * Returns error message or null if valid
 */
export function validateHslString(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return 'Value is required';

  const match = trimmed.match(HSL_PATTERN);
  if (!match) {
    return 'Invalid HSL format. Expected: "hue saturation% lightness%" (e.g., "222.2 47.4% 11.2%")';
  }

  const [, h, s, l] = match.map(Number);
  if (h < 0 || h > 360) return 'Hue must be between 0 and 360';
  if (s < 0 || s > 100) return 'Saturation must be between 0% and 100%';
  if (l < 0 || l > 100) return 'Lightness must be between 0% and 100%';

  return null; // Valid
}

/**
 * Validate radius value format
 * Returns error message or null if valid
 */
export function validateRadius(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return 'Value is required';

  if (!RADIUS_PATTERN.test(trimmed)) {
    return 'Invalid radius format. Expected: "0.5rem" or "8px"';
  }
  return null; // Valid
}

/**
 * Check if a string is a valid HSL value
 */
export function isValidHslString(value: string): boolean {
  return validateHslString(value) === null;
}

/**
 * Check if a theme variable key is a color (vs radius)
 */
export function isColorVariable(key: string): boolean {
  return key !== '--radius';
}

/**
 * Convert HSL string to CSS hsl() format for display
 * "222.2 47.4% 11.2%" -> "hsl(222.2, 47.4%, 11.2%)"
 */
export function hslStringToCss(hslString: string): string {
  const hsl = parseHslString(hslString);
  if (!hsl) return hslString;
  return `hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`;
}

/**
 * Parse CSS custom properties string to ThemeVariables
 * Used for parsing code editor content
 */
export function parseCssVariables(css: string): Partial<ThemeVariables> {
  const result: Partial<ThemeVariables> = {};

  // Match CSS variable declarations: --name: value;
  const varPattern = /(--[\w-]+)\s*:\s*([^;]+);/g;
  let match;

  while ((match = varPattern.exec(css)) !== null) {
    const [, key, value] = match;
    const trimmedValue = value.trim();
    if (key.startsWith('--')) {
      result[key as keyof ThemeVariables] = trimmedValue;
    }
  }

  return result;
}

/**
 * Format ThemeVariables to CSS custom properties string
 * Used for code editor display
 */
export function formatCssVariables(variables: ThemeVariables): string {
  const lines = [':root {'];

  for (const [key, value] of Object.entries(variables)) {
    if (value !== undefined) {
      lines.push(`  ${key}: ${value};`);
    }
  }

  lines.push('}');
  return lines.join('\n');
}
