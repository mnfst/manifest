import { useState } from 'react';
import { useApiKey } from '../../hooks/useApiKey';
import { api } from '../../lib/api';

/**
 * API Keys settings tab
 * Allows users to save, validate, and manage their OpenAI API key
 */
export function ApiKeysTab() {
  const { hasApiKey, isLoading, setApiKey, clearApiKey, getMaskedKey } = useApiKey();
  const [inputValue, setInputValue] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleSave = async () => {
    if (!inputValue.trim()) {
      setError('Please enter an API key');
      return;
    }

    setError(null);
    setSuccessMessage(null);
    setIsValidating(true);

    try {
      const result = await api.validateApiKey(inputValue.trim());
      if (result.valid) {
        setApiKey(inputValue.trim());
        setInputValue('');
        setSuccessMessage('API key saved successfully');
      } else {
        setError(result.error || 'Invalid API key');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to validate API key');
    } finally {
      setIsValidating(false);
    }
  };

  const handleDelete = () => {
    clearApiKey();
    setSuccessMessage(null);
    setError(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isValidating) {
      handleSave();
    }
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-lg font-semibold mb-2">OpenAI API Key</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Enter your OpenAI API key to enable chat functionality in the Preview tab.
          Your key is stored locally in your browser and never sent to our servers.
        </p>
      </div>

      {hasApiKey ? (
        <div className="space-y-4">
          <div className="flex items-center gap-4 p-4 bg-muted rounded-lg">
            <div className="flex-1">
              <div className="text-sm text-muted-foreground mb-1">Current API Key</div>
              <div className="font-mono text-sm">{getMaskedKey()}</div>
            </div>
            <button
              onClick={handleDelete}
              className="px-4 py-2 text-sm text-destructive hover:bg-destructive/10 rounded-md transition-colors"
            >
              Delete
            </button>
          </div>
          <div className="text-sm text-muted-foreground">
            To update your API key, delete the current one and enter a new key below.
          </div>
        </div>
      ) : null}

      <div className="space-y-4">
        <div>
          <label htmlFor="api-key-input" className="block text-sm font-medium mb-2">
            {hasApiKey ? 'Replace API Key' : 'API Key'}
          </label>
          <div className="flex gap-2">
            <input
              id="api-key-input"
              type="password"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="sk-..."
              className="flex-1 px-3 py-2 border border-input rounded-md bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              disabled={isValidating}
            />
            <button
              onClick={handleSave}
              disabled={isValidating || !inputValue.trim()}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isValidating ? 'Validating...' : 'Save'}
            </button>
          </div>
        </div>

        {error && (
          <div className="p-3 bg-destructive/10 text-destructive rounded-md text-sm">
            {error}
          </div>
        )}

        {successMessage && (
          <div className="p-3 bg-green-500/10 text-green-600 dark:text-green-400 rounded-md text-sm">
            {successMessage}
          </div>
        )}
      </div>

      <div className="pt-4 border-t border-border">
        <h3 className="text-sm font-medium mb-2">How to get an API key</h3>
        <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
          <li>Go to <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">platform.openai.com/api-keys</a></li>
          <li>Sign in or create an OpenAI account</li>
          <li>Click "Create new secret key"</li>
          <li>Copy the key and paste it above</li>
        </ol>
      </div>
    </div>
  );
}
