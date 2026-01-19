import { useMemo } from 'react';
import type { ThemeVariables } from '@manifest/shared';

interface ThemeProviderProps {
  themeVariables: ThemeVariables;
  isDarkMode?: boolean;
  children: React.ReactNode;
}

/**
 * Injects CSS variables for shadcn theming
 * Applies theme variables as inline styles on a wrapper element
 */
export function ThemeProvider({ themeVariables, isDarkMode = false, children }: ThemeProviderProps) {
  const style = useMemo(() => {
    const cssVars: Record<string, string> = {};
    for (const [key, value] of Object.entries(themeVariables)) {
      if (value) {
        cssVars[key] = value;
      }
    }
    return cssVars as React.CSSProperties;
  }, [themeVariables]);

  return (
    <div style={style} className={`h-full ${isDarkMode ? 'dark' : ''}`}>
      {children}
    </div>
  );
}
