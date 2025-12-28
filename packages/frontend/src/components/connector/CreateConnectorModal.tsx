import { useState, useEffect, useRef } from 'react';
import { X, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import type { CreateConnectorRequest, MySQLConnectorConfig } from '@chatgpt-app-builder/shared';
import { ConnectorType } from '@chatgpt-app-builder/shared';
import { api } from '../../lib/api';

interface CreateConnectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (request: CreateConnectorRequest) => void;
  isLoading?: boolean;
  error?: string | null;
}

type TestStatus = 'idle' | 'testing' | 'success' | 'failed';

export function CreateConnectorModal({
  isOpen,
  onClose,
  onSubmit,
  isLoading = false,
  error,
}: CreateConnectorModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const [name, setName] = useState('');
  const [host, setHost] = useState('localhost');
  const [port, setPort] = useState('3306');
  const [database, setDatabase] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [testStatus, setTestStatus] = useState<TestStatus>('idle');
  const [testMessage, setTestMessage] = useState<string | null>(null);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setName('');
      setHost('localhost');
      setPort('3306');
      setDatabase('');
      setUsername('');
      setPassword('');
      setValidationError(null);
      setTestStatus('idle');
      setTestMessage(null);
    }
  }, [isOpen]);

  // Reset test status when connection params change
  useEffect(() => {
    setTestStatus('idle');
    setTestMessage(null);
  }, [host, port, database, username, password]);

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

  if (!isOpen) return null;

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
    if (!password.trim()) return 'Password is required';
    return null;
  };

  const handleTestConnection = async () => {
    const validationErr = validateForm();
    if (validationErr && validationErr !== 'Connector name is required') {
      setValidationError(validationErr);
      return;
    }
    setValidationError(null);

    setTestStatus('testing');
    setTestMessage(null);

    try {
      const result = await api.testConnectionConfig({
        host: host.trim(),
        port: parseInt(port, 10),
        database: database.trim(),
        username: username.trim(),
        password: password.trim(),
      });

      setTestStatus(result.success ? 'success' : 'failed');
      setTestMessage(result.message);
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

    if (testStatus !== 'success') {
      setValidationError('Please test the connection before creating');
      return;
    }

    const config: MySQLConnectorConfig = {
      host: host.trim(),
      port: parseInt(port, 10),
      database: database.trim(),
      username: username.trim(),
      password: password.trim(),
    };

    onSubmit({
      name: name.trim(),
      connectorType: ConnectorType.MYSQL,
      config,
    });
  };

  const displayError = validationError || error;
  const canCreate = testStatus === 'success' && name.trim().length > 0;

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
            Add Connector
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
            <label htmlFor="name" className="block text-sm font-medium text-foreground mb-1">
              Connector Name
            </label>
            <input
              id="name"
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
            <label htmlFor="type" className="block text-sm font-medium text-foreground mb-1">
              Type
            </label>
            <select
              id="type"
              value="mysql"
              disabled
              className="w-full px-3 py-2 border rounded-lg bg-muted text-foreground focus:outline-none cursor-not-allowed"
            >
              <option value="mysql">MySQL Database</option>
            </select>
            <p className="text-xs text-muted-foreground mt-1">
              More connector types coming soon
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label htmlFor="host" className="block text-sm font-medium text-foreground mb-1">
                Host
              </label>
              <input
                id="host"
                type="text"
                value={host}
                onChange={(e) => setHost(e.target.value)}
                placeholder="localhost"
                className="w-full px-3 py-2 border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                disabled={isLoading}
              />
            </div>
            <div>
              <label htmlFor="port" className="block text-sm font-medium text-foreground mb-1">
                Port
              </label>
              <input
                id="port"
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
            <label htmlFor="database" className="block text-sm font-medium text-foreground mb-1">
              Database
            </label>
            <input
              id="database"
              type="text"
              value={database}
              onChange={(e) => setDatabase(e.target.value)}
              placeholder="my_database"
              className="w-full px-3 py-2 border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              disabled={isLoading}
            />
          </div>

          <div>
            <label htmlFor="username" className="block text-sm font-medium text-foreground mb-1">
              Username
            </label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="root"
              className="w-full px-3 py-2 border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              disabled={isLoading}
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-foreground mb-1">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              className="w-full px-3 py-2 border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              disabled={isLoading}
            />
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
              disabled={isLoading || !canCreate}
              className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {isLoading ? 'Creating...' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
