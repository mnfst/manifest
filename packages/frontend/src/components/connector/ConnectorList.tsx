import type { Connector } from '@chatgpt-app-builder/shared';
import { ConnectorRow } from './ConnectorRow';
import { Database } from 'lucide-react';
import type { ConnectionInfo } from '../../pages/ConnectorsPage';

interface ConnectorListProps {
  connectors: Connector[];
  connectionInfos: Record<string, ConnectionInfo>;
  onEdit?: (connector: Connector) => void;
  onDelete?: (connector: Connector) => void;
  onTestConnection?: (connector: Connector) => void;
  onAddNew?: () => void;
}

export function ConnectorList({
  connectors,
  connectionInfos,
  onEdit,
  onDelete,
  onTestConnection,
  onAddNew,
}: ConnectorListProps) {
  if (connectors.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
        <div className="p-4 bg-muted rounded-full mb-4">
          <Database className="w-8 h-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-medium text-foreground mb-2">
          No connectors yet
        </h3>
        <p className="text-sm text-muted-foreground mb-4 max-w-sm">
          Connectors allow you to connect to external data sources like databases, APIs, and files.
        </p>
        {onAddNew && (
          <button
            onClick={onAddNew}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
          >
            Add your first connector
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="w-full">
      <table className="w-full">
        <thead>
          <tr className="border-b text-left text-sm text-muted-foreground">
            <th className="pb-3 pl-4 font-medium w-10">Status</th>
            <th className="pb-3 font-medium">Name</th>
            <th className="pb-3 font-medium">Type</th>
            <th className="pb-3 font-medium">Host</th>
            <th className="pb-3 font-medium">Database</th>
            <th className="pb-3 pr-4 font-medium text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {connectors.map((connector) => (
            <ConnectorRow
              key={connector.id}
              connector={connector}
              connectionInfo={connectionInfos[connector.id] || { status: 'unknown' }}
              onEdit={onEdit}
              onDelete={onDelete}
              onTestConnection={onTestConnection}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
