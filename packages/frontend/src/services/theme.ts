/** Read a CSS custom property value. */
export function getCssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

/** Read a shadcn HSL CSS variable and return as usable hsl() string. */
export function getHsl(name: string): string {
  const raw = getCssVar(name);
  return `hsl(${raw})`;
}

/** Read a shadcn HSL variable and return with custom alpha. */
export function getHslA(name: string, alpha: number): string {
  const raw = getCssVar(name);
  return `hsl(${raw} / ${alpha})`;
}
