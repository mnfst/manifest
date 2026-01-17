import { useState, useEffect, useCallback } from 'react';
import { Plus, KeyRound } from 'lucide-react';
import { Button } from '@/components/ui/shadcn/button';
import { Input } from '@/components/ui/shadcn/input';
import type { AppSecret } from '@chatgpt-app-builder/shared';
import { api, ApiClientError } from '../../lib/api';
import { SecretRow } from './SecretRow';

interface SecretsTabProps {
  appId: string;
}

/**
 * Secrets management tab for App Settings
 * Displays list of secrets with add form and CRUD operations
 */
export function SecretsTab({ appId }: SecretsTabProps) {
  const [secrets, setSecrets] = useState<AppSecret[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Add form state
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const loadSecrets = useCallback(async () => {
    try {
      const response = await api.listSecrets(appId);
      setSecrets(response.secrets);
      setError(null);
    } catch (err) {
      if (err instanceof ApiClientError) {
        setError(err.message);
      } else {
        setError('Failed to load secrets');
      }
    } finally {
      setIsLoading(false);
    }
  }, [appId]);

  useEffect(() => {
    loadSecrets();
  }, [loadSecrets]);

  const handleAddSecret = async (e: React.FormEvent) => {
    e.preventDefault();

    const key = newKey.trim();
    const value = newValue.trim();

    if (!key || !value) {
      setAddError('Both key and value are required');
      return;
    }

    // Validate key format (env var naming)
    const keyRegex = /^[A-Za-z_][A-Za-z0-9_]*$/;
    if (!keyRegex.test(key)) {
      setAddError('Key must start with a letter or underscore and contain only letters, numbers, and underscores');
      return;
    }

    setIsAdding(true);
    setAddError(null);

    try {
      const newSecret = await api.createSecret(appId, { key, value });
      setSecrets((prev) => [...prev, newSecret]);
      setNewKey('');
      setNewValue('');
    } catch (err) {
      if (err instanceof ApiClientError) {
        setAddError(err.message);
      } else {
        setAddError('Failed to add secret');
      }
    } finally {
      setIsAdding(false);
    }
  };

  const handleUpdateSecret = async (secretId: string, key: string, value: string) => {
    const secret = await api.updateSecret(secretId, { key, value });
    setSecrets((prev) =>
      prev.map((s) => (s.id === secretId ? secret : s))
    );
  };

  const handleDeleteSecret = async (secretId: string) => {
    await api.deleteSecret(secretId);
    setSecrets((prev) => prev.filter((s) => s.id !== secretId));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-muted-foreground">Loading secrets...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-destructive">{error}</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold">Secret Variables</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Manage environment variables and API keys for this app. These values are securely stored and available during flow execution.
        </p>
      </div>

      {/* Add Secret Form */}
      <form onSubmit={handleAddSecret} className="border border-border rounded-lg p-4 bg-muted/30">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <Input
              type="text"
              value={newKey}
              onChange={(e) => setNewKey(e.target.value.toUpperCase())}
              placeholder="SECRET_KEY"
              className="font-mono"
              disabled={isAdding}
            />
          </div>
          <div className="flex-1">
            <Input
              type="text"
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              placeholder="secret_value"
              className="font-mono"
              disabled={isAdding}
            />
          </div>
          <Button type="submit" disabled={isAdding || !newKey.trim() || !newValue.trim()}>
            <Plus className="w-4 h-4" />
            {isAdding ? 'Adding...' : 'Add'}
          </Button>
        </div>
        {addError && (
          <p className="text-destructive text-sm mt-2">{addError}</p>
        )}
      </form>

      {/* Secrets List */}
      {secrets.length === 0 ? (
        <div className="border border-dashed border-border rounded-lg p-8 text-center">
          <KeyRound className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
          <h3 className="text-lg font-medium text-muted-foreground mb-1">
            No secrets yet
          </h3>
          <p className="text-sm text-muted-foreground">
            Add your first secret variable using the form above.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {secrets.map((secret) => (
            <SecretRow
              key={secret.id}
              secret={secret}
              onUpdate={handleUpdateSecret}
              onDelete={handleDeleteSecret}
            />
          ))}
        </div>
      )}
    </div>
  );
}
