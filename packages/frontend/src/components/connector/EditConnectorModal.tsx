import { useState, useEffect, useRef } from 'react';
import { X, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import type { Connector, UpdateConnectorRequest, MySQLConnectorConfig } from '@chatgpt-app-builder/shared';
import { api } from '../../lib/api';

interface EditConnectorModalProps {
  isOpen: boolean;
  connector: Connector | null;
  onClose: () => void;
  onSubmit: (id: string, request: UpdateConnectorRequest) => void;
  isLoading?: boolean;
  error?: string | null;
}

type TestStatus = 'idle' | 'testing' | 'success' | 'failed';

export function EditConnectorModal({
  isOpen,
  connector,
  onClose,
  onSubmit,
  isLoading = false,
  error,
}: EditConnectorModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const [name, setName] = useState('');
  const [host, setHost] = useState('');
  const [port, setPort] = useState('');
  const [database, setDatabase] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [testStatus, setTestStatus] = useState<TestStatus>('idle');
  const [testMessage, setTestMessage] = useState<string | null>(null);
  const [configChanged, setConfigChanged] = useState(false);

  // Populate form when connector changes
  useEffect(() => {
    if (connector) {
      setName(connector.name);
      setHost(connector.config.host);
      setPort(String(connector.config.port));
      setDatabase(connector.config.database);
      setUsername(connector.config.username);
      setPassword(''); // Don't populate password - it's masked
      setValidationError(null);
      setTestStatus('idle');
      setTestMessage(null);
      setConfigChanged(false);
    }
  }, [connector]);

  // Track if connection config changed
  useEffect(() => {
    if (connector) {
      const hasChanges =
        host !== connector.config.host ||
        port !== String(connector.config.port) ||
        database !== connector.config.database ||
        username !== connector.config.username ||
        password.trim().length > 0;
      setConfigChanged(hasChanges);
      if (hasChanges) {
        setTestStatus('idle');
        setTestMessage(null);
      }
    }
  }, [host, port, database, username, password, connector]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isLoading) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, isLoading, onClose]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen || !connector) return null;

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && !isLoading) {
      onClose();
    }
  };

  const validateForm = (): string | null => {
    if (!name.trim()) return 'Connector name is required';
    if (!host.trim()) return 'Host is required';
    const portNum = parseInt(port, 10);
    if (isNaN(portNum) || portNum < 1 || portNum > 65535) return 'Port must be between 1 and 65535';
    if (!database.trim()) return 'Database name is required';
    if (!username.trim()) return 'Username is required';
    return null;
  };

  const handleTestConnection = async () => {
    const validationErr = validateForm();
    if (validationErr && validationErr !== 'Connector name is required') {
      setValidationError(validationErr);
      return;
    }

    // For test, we need a password - if not provided and config changed, require it
    if (!password.trim() && configChanged) {
      setValidationError('Password is required to test connection with new settings');
      return;
    }

    setValidationError(null);
    setTestStatus('testing');
    setTestMessage(null);

    try {
      // If password not provided, use existing connector's test endpoint
      if (!password.trim()) {
        const result = await api.testConnectorConnection(connector.id);
        setTestStatus(result.success ? 'success' : 'failed');
        setTestMessage(result.message);
      } else {
        // Test with new config
        const result = await api.testConnectionConfig({
          host: host.trim(),
          port: parseInt(port, 10),
          database: database.trim(),
          username: username.trim(),
          password: password.trim(),
        });
        setTestStatus(result.success ? 'success' : 'failed');
        setTestMessage(result.message);
      }
    } catch (err) {
      setTestStatus('failed');
      setTestMessage(err instanceof Error ? err.message : 'Connection test failed');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    const validationErr = validateForm();
    if (validationErr) {
      setValidationError(validationErr);
      return;
    }

    // If config changed, require successful test
    if (configChanged && testStatus !== 'success') {
      setValidationError('Please test the connection before saving changes');
      return;
    }

    const config: Partial<MySQLConnectorConfig> = {
      host: host.trim(),
      port: parseInt(port, 10),
      database: database.trim(),
      username: username.trim(),
    };

    // Only include password if it was changed
    if (password.trim()) {
      config.password = password.trim();
    }

    onSubmit(connector.id, {
      name: name.trim(),
      config,
    });
  };

  const displayError = validationError || error;
  // Can save if: name provided AND (no config changes OR successful test)
  const canSave = name.trim().length > 0 && (!configChanged || testStatus === 'success');

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={handleBackdropClick}
    >
      <div
        ref={modalRef}
        className="bg-card border rounded-lg shadow-lg w-full max-w-md animate-in fade-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <div className="flex items-center justify-between p-4 border-b">
          <h2 id="modal-title" className="text-lg font-semibold">
            Edit Connector
          </h2>
          <button
            onClick={onClose}
            disabled={isLoading}
            className="p-1 text-muted-foreground hover:text-foreground rounded transition-colors disabled:opacity-50"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label htmlFor="edit-name" className="block text-sm font-medium text-foreground mb-1">
              Connector Name
            </label>
            <input
              id="edit-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Production Database"
              className="w-full px-3 py-2 border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              disabled={isLoading}
              autoFocus
            />
          </div>

          <div>
            <label htmlFor="edit-type" className="block text-sm font-medium text-foreground mb-1">
              Type
            </label>
            <select
              id="edit-type"
              value="mysql"
              disabled
              className="w-full px-3 py-2 border rounded-lg bg-muted text-foreground focus:outline-none cursor-not-allowed"
            >
              <option value="mysql">MySQL Database</option>
            </select>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label htmlFor="edit-host" className="block text-sm font-medium text-foreground mb-1">
                Host
              </label>
              <input
                id="edit-host"
                type="text"
                value={host}
                onChange={(e) => setHost(e.target.value)}
                placeholder="localhost"
                className="w-full px-3 py-2 border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                disabled={isLoading}
              />
            </div>
            <div>
              <label htmlFor="edit-port" className="block text-sm font-medium text-foreground mb-1">
                Port
              </label>
              <input
                id="edit-port"
                type="number"
                value={port}
                onChange={(e) => setPort(e.target.value)}
                placeholder="3306"
                min="1"
                max="65535"
                className="w-full px-3 py-2 border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                disabled={isLoading}
              />
            </div>
          </div>

          <div>
            <label htmlFor="edit-database" className="block text-sm font-medium text-foreground mb-1">
              Database
            </label>
            <input
              id="edit-database"
              type="text"
              value={database}
              onChange={(e) => setDatabase(e.target.value)}
              placeholder="my_database"
              className="w-full px-3 py-2 border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              disabled={isLoading}
            />
          </div>

          <div>
            <label htmlFor="edit-username" className="block text-sm font-medium text-foreground mb-1">
              Username
            </label>
            <input
              id="edit-username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="root"
              className="w-full px-3 py-2 border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              disabled={isLoading}
            />
          </div>

          <div>
            <label htmlFor="edit-password" className="block text-sm font-medium text-foreground mb-1">
              Password
            </label>
            <input
              id="edit-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Leave blank to keep current password"
              className="w-full px-3 py-2 border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              disabled={isLoading}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Leave blank to keep the existing password
            </p>
          </div>

          {/* Test Connection Button and Status */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleTestConnection}
              disabled={isLoading || testStatus === 'testing'}
              className="px-4 py-2 border rounded-lg text-foreground hover:bg-muted transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {testStatus === 'testing' ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Testing...
                </>
              ) : (
                'Test Connection'
              )}
            </button>
            {testStatus === 'success' && (
              <div className="flex items-center gap-1.5 text-green-600">
                <CheckCircle className="w-4 h-4" />
                <span className="text-sm">Connected</span>
              </div>
            )}
            {testStatus === 'failed' && (
              <div className="flex items-center gap-1.5 text-red-600">
                <XCircle className="w-4 h-4" />
                <span className="text-sm">Failed</span>
              </div>
            )}
          </div>

          {configChanged && testStatus === 'idle' && (
            <p className="text-xs text-amber-600 dark:text-amber-500">
              Connection settings changed. Please test before saving.
            </p>
          )}

          {testStatus === 'failed' && testMessage && (
            <div className="p-3 bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 rounded-lg text-sm">
              {testMessage}
            </div>
          )}

          {displayError && (
            <div className="p-3 bg-destructive/10 text-destructive rounded-lg text-sm">
              {displayError}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="flex-1 px-4 py-2 border rounded-lg text-foreground hover:bg-muted transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading || !canSave}
              className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {isLoading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
