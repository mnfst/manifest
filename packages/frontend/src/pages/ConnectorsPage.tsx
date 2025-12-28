import { useState, useEffect } from 'react';
import type { Connector, CreateConnectorRequest, UpdateConnectorRequest } from '@chatgpt-app-builder/shared';
import { api } from '../lib/api';
import { ConnectorList } from '../components/connector/ConnectorList';
import { CreateConnectorModal } from '../components/connector/CreateConnectorModal';
import { EditConnectorModal } from '../components/connector/EditConnectorModal';
import { DeleteConnectorDialog } from '../components/connector/DeleteConnectorDialog';
import { Plus } from 'lucide-react';

type ConnectionStatus = 'connected' | 'disconnected' | 'unknown' | 'testing';

export interface ConnectionInfo {
  status: ConnectionStatus;
  lastConnectedAt?: Date;
}

const STORAGE_KEY = 'connector-connection-infos';

function loadConnectionInfos(): Record<string, ConnectionInfo> {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return {};
    const parsed = JSON.parse(stored);
    // Convert date strings back to Date objects
    const result: Record<string, ConnectionInfo> = {};
    for (const [id, info] of Object.entries(parsed)) {
      const typedInfo = info as { status: ConnectionStatus; lastConnectedAt?: string };
      result[id] = {
        status: typedInfo.status === 'testing' ? 'unknown' : typedInfo.status, // Reset testing state
        lastConnectedAt: typedInfo.lastConnectedAt ? new Date(typedInfo.lastConnectedAt) : undefined,
      };
    }
    return result;
  } catch {
    return {};
  }
}

function saveConnectionInfos(infos: Record<string, ConnectionInfo>) {
  try {
    // Convert Date objects to ISO strings for storage
    const toStore: Record<string, { status: ConnectionStatus; lastConnectedAt?: string }> = {};
    for (const [id, info] of Object.entries(infos)) {
      toStore[id] = {
        status: info.status,
        lastConnectedAt: info.lastConnectedAt?.toISOString(),
      };
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toStore));
  } catch {
    // Ignore storage errors
  }
}

export function ConnectorsPage() {
  const [connectors, setConnectors] = useState<Connector[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [editingConnector, setEditingConnector] = useState<Connector | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [deletingConnector, setDeletingConnector] = useState<Connector | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [connectionInfos, setConnectionInfos] = useState<Record<string, ConnectionInfo>>(loadConnectionInfos);

  // Persist connection infos to localStorage
  useEffect(() => {
    saveConnectionInfos(connectionInfos);
  }, [connectionInfos]);

  const loadConnectors = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.listConnectors();
      setConnectors(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load connectors');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConnectors();
  }, []);

  const handleAddNew = () => {
    setCreateError(null);
    setIsCreateModalOpen(true);
  };

  const handleCreateSubmit = async (request: CreateConnectorRequest) => {
    try {
      setIsCreating(true);
      setCreateError(null);
      const newConnector = await api.createConnector(request);
      setConnectors((prev) => [newConnector, ...prev]);
      // Set to connected since we just tested it successfully in the modal
      setConnectionInfos((prev) => ({
        ...prev,
        [newConnector.id]: { status: 'connected', lastConnectedAt: new Date() },
      }));
      setIsCreateModalOpen(false);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create connector');
    } finally {
      setIsCreating(false);
    }
  };

  const handleEdit = (connector: Connector) => {
    setEditError(null);
    setEditingConnector(connector);
  };

  const handleEditSubmit = async (id: string, request: UpdateConnectorRequest) => {
    try {
      setIsEditing(true);
      setEditError(null);
      const updatedConnector = await api.updateConnector(id, request);
      setConnectors((prev) =>
        prev.map((c) => (c.id === id ? updatedConnector : c))
      );
      setEditingConnector(null);
      // Set to connected since config changes require a successful test
      setConnectionInfos((prev) => ({
        ...prev,
        [id]: { status: 'connected', lastConnectedAt: new Date() },
      }));
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Failed to update connector');
    } finally {
      setIsEditing(false);
    }
  };

  const handleDelete = (connector: Connector) => {
    setDeleteError(null);
    setDeletingConnector(connector);
  };

  const handleDeleteConfirm = async (id: string) => {
    try {
      setIsDeleting(true);
      setDeleteError(null);
      await api.deleteConnector(id);
      setConnectors((prev) => prev.filter((c) => c.id !== id));
      setDeletingConnector(null);
      // Clean up connection info
      setConnectionInfos((prev) => {
        const updated = { ...prev };
        delete updated[id];
        return updated;
      });
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Failed to delete connector');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleTestConnection = async (connector: Connector) => {
    setConnectionInfos((prev) => ({
      ...prev,
      [connector.id]: { ...prev[connector.id], status: 'testing' },
    }));
    try {
      const result = await api.testConnectorConnection(connector.id);
      setConnectionInfos((prev) => ({
        ...prev,
        [connector.id]: {
          status: result.success ? 'connected' : 'disconnected',
          lastConnectedAt: result.success ? new Date() : prev[connector.id]?.lastConnectedAt,
        },
      }));
    } catch {
      setConnectionInfos((prev) => ({
        ...prev,
        [connector.id]: { ...prev[connector.id], status: 'disconnected' },
      }));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Loading connectors...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <div className="text-destructive mb-4">{error}</div>
        <button
          onClick={loadConnectors}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col">
      <div className="flex items-center justify-between p-6 border-b">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Connectors</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your external data connections
          </p>
        </div>
        <button
          onClick={handleAddNew}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add
        </button>
      </div>

      <div className="flex-1 p-6">
        <ConnectorList
          connectors={connectors}
          connectionInfos={connectionInfos}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onTestConnection={handleTestConnection}
          onAddNew={handleAddNew}
        />
      </div>

      <CreateConnectorModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSubmit={handleCreateSubmit}
        isLoading={isCreating}
        error={createError}
      />

      <EditConnectorModal
        isOpen={editingConnector !== null}
        connector={editingConnector}
        onClose={() => setEditingConnector(null)}
        onSubmit={handleEditSubmit}
        isLoading={isEditing}
        error={editError}
      />

      <DeleteConnectorDialog
        isOpen={deletingConnector !== null}
        connector={deletingConnector}
        onClose={() => setDeletingConnector(null)}
        onConfirm={handleDeleteConfirm}
        isLoading={isDeleting}
        error={deleteError}
      />
    </div>
  );
}
