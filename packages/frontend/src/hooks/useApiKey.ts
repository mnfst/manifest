import { useState, useCallback, useEffect } from 'react';
import type { StoredApiKey } from '@chatgpt-app-builder/shared';

const STORAGE_KEY = 'openai-api-key';

/**
 * Hook for managing OpenAI API key in localStorage
 * Provides get, set, clear, and masked display functionality
 */
export function useApiKey() {
  const [apiKey, setApiKeyState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load API key from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed: StoredApiKey = JSON.parse(stored);
        setApiKeyState(parsed.value);
      }
    } catch {
      // Invalid stored data, clear it
      localStorage.removeItem(STORAGE_KEY);
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Save API key to localStorage
   */
  const setApiKey = useCallback((key: string) => {
    const stored: StoredApiKey = {
      value: key,
      provider: 'openai',
      savedAt: new Date().toISOString(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
    setApiKeyState(key);
  }, []);

  /**
   * Remove API key from localStorage
   */
  const clearApiKey = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setApiKeyState(null);
  }, []);

  /**
   * Get masked version of API key for display (e.g., "sk-...abc123")
   */
  const getMaskedKey = useCallback((): string | null => {
    if (!apiKey) return null;
    if (apiKey.length <= 8) return '****';
    return `${apiKey.slice(0, 3)}...${apiKey.slice(-6)}`;
  }, [apiKey]);

  /**
   * Check if an API key is stored
   */
  const hasApiKey = apiKey !== null;

  return {
    apiKey,
    hasApiKey,
    isLoading,
    setApiKey,
    clearApiKey,
    getMaskedKey,
  };
}
