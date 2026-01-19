import { useState, useEffect, useCallback } from 'react';
import type { PlatformStyle, ThemeMode, PreviewPreferences } from '@manifest/shared';

const STORAGE_KEYS = {
  platformStyle: 'generator:platformStyle',
  themeMode: 'generator:themeMode',
} as const;

/**
 * Load preferences from localStorage with validation
 */
function loadPreferences(): PreviewPreferences {
  try {
    const storedPlatformStyle = localStorage.getItem(STORAGE_KEYS.platformStyle);
    const storedThemeMode = localStorage.getItem(STORAGE_KEYS.themeMode);

    return {
      platformStyle: storedPlatformStyle === 'claude' ? 'claude' : 'chatgpt',
      themeMode: storedThemeMode === 'dark' ? 'dark' : 'light',
    };
  } catch {
    // localStorage not available (SSR or privacy mode)
    return {
      platformStyle: 'chatgpt',
      themeMode: 'light',
    };
  }
}

/**
 * Save a single preference to localStorage
 */
function savePreference(key: keyof typeof STORAGE_KEYS, value: string): void {
  try {
    localStorage.setItem(STORAGE_KEYS[key], value);
  } catch {
    // localStorage not available
  }
}

/**
 * Hook for managing preview preferences with localStorage persistence
 */
export function usePreviewPreferences() {
  const [preferences, setPreferences] = useState<PreviewPreferences>(loadPreferences);

  // Load preferences on mount (handles SSR hydration)
  useEffect(() => {
    setPreferences(loadPreferences());
  }, []);

  const setPlatformStyle = useCallback((style: PlatformStyle) => {
    setPreferences(prev => ({ ...prev, platformStyle: style }));
    savePreference('platformStyle', style);
  }, []);

  const setThemeMode = useCallback((mode: ThemeMode) => {
    setPreferences(prev => ({ ...prev, themeMode: mode }));
    savePreference('themeMode', mode);
  }, []);

  const toggleThemeMode = useCallback(() => {
    setPreferences(prev => {
      const newMode = prev.themeMode === 'light' ? 'dark' : 'light';
      savePreference('themeMode', newMode);
      return { ...prev, themeMode: newMode };
    });
  }, []);

  return {
    ...preferences,
    setPlatformStyle,
    setThemeMode,
    toggleThemeMode,
  };
}
