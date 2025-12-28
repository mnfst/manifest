import { useState } from 'react';
import type { Connector } from '@chatgpt-app-builder/shared';
import { Pencil, Trash2, RefreshCw } from 'lucide-react';
import type { ConnectionInfo } from '../../pages/ConnectorsPage';

interface ConnectorRowProps {
  connector: Connector;
  connectionInfo: ConnectionInfo;
  onEdit?: (connector: Connector) => void;
  onDelete?: (connector: Connector) => void;
  onTestConnection?: (connector: Connector) => void;
}

function getStatusColor(status: ConnectionInfo['status']) {
  switch (status) {
    case 'connected':
      return 'bg-green-500';
    case 'disconnected':
      return 'bg-red-500';
    case 'testing':
      return 'bg-yellow-500 animate-pulse';
    case 'unknown':
    default:
      return 'bg-gray-400';
  }
}

function formatLastConnected(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) {
    return 'just now';
  } else if (diffMins < 60) {
    return `${diffMins} minute${diffMins === 1 ? '' : 's'} ago`;
  } else if (diffHours < 24) {
    return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
  } else if (diffDays < 7) {
    return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
  } else {
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
}

function getConnectorTypeLabel(type: string) {
  switch (type) {
    case 'mysql':
      return 'MySQL Database';
    default:
      return type;
  }
}

export function ConnectorRow({
  connector,
  connectionInfo,
  onEdit,
  onDelete,
  onTestConnection,
}: ConnectorRowProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  const getTooltipText = () => {
    if (connectionInfo.status === 'testing') {
      return 'Testing connection...';
    }
    if (connectionInfo.status === 'connected' && connectionInfo.lastConnectedAt) {
      return `Last connected: ${formatLastConnected(connectionInfo.lastConnectedAt)}`;
    }
    if (connectionInfo.status === 'disconnected') {
      return 'Connection failed';
    }
    return 'Not tested';
  };

  return (
    <tr className="border-b hover:bg-muted/50 transition-colors group">
      <td className="py-3 pl-4">
        <div className="relative flex items-center gap-2">
          <span
            className={`w-3 h-3 rounded-full cursor-help ${getStatusColor(connectionInfo.status)}`}
            onMouseEnter={() => setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
          />
          {showTooltip && (
            <div className="absolute left-6 top-1/2 -translate-y-1/2 z-10 px-2 py-1 text-xs text-white bg-gray-900 rounded shadow-lg whitespace-nowrap">
              {getTooltipText()}
              <div className="absolute left-0 top-1/2 -translate-x-1 -translate-y-1/2 w-0 h-0 border-t-4 border-b-4 border-r-4 border-transparent border-r-gray-900" />
            </div>
          )}
        </div>
      </td>
      <td className="py-3">
        <span className="font-medium text-foreground">{connector.name}</span>
      </td>
      <td className="py-3">
        <span className="text-sm text-muted-foreground">
          {getConnectorTypeLabel(connector.connectorType)}
        </span>
      </td>
      <td className="py-3">
        <span className="text-sm text-muted-foreground">
          {connector.config.host}:{connector.config.port}
        </span>
      </td>
      <td className="py-3">
        <span className="text-sm text-muted-foreground">
          {connector.config.database}
        </span>
      </td>
      <td className="py-3 pr-4">
        <div className="flex items-center justify-end gap-1">
          {onTestConnection && (
            <button
              onClick={() => onTestConnection(connector)}
              disabled={connectionInfo.status === 'testing'}
              className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-colors opacity-0 group-hover:opacity-100 disabled:opacity-50"
              aria-label={`Test connection for ${connector.name}`}
              title="Test connection"
            >
              <RefreshCw className={`w-4 h-4 ${connectionInfo.status === 'testing' ? 'animate-spin' : ''}`} />
            </button>
          )}
          {onEdit && (
            <button
              onClick={() => onEdit(connector)}
              className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-colors opacity-0 group-hover:opacity-100"
              aria-label={`Edit ${connector.name}`}
              title="Edit connector"
            >
              <Pencil className="w-4 h-4" />
            </button>
          )}
          {onDelete && (
            <button
              onClick={() => onDelete(connector)}
              className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded transition-colors opacity-0 group-hover:opacity-100"
              aria-label={`Delete ${connector.name}`}
              title="Delete connector"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}
