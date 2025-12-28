import type { Connector } from '@chatgpt-app-builder/shared';
import { Database, Pencil, Trash2 } from 'lucide-react';

interface ConnectorCardProps {
  connector: Connector;
  onEdit?: (connector: Connector) => void;
  onDelete?: (connector: Connector) => void;
}

export function ConnectorCard({ connector, onEdit, onDelete }: ConnectorCardProps) {
  const handleEditClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onEdit?.(connector);
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete?.(connector);
  };

  return (
    <div className="bg-card border rounded-lg p-4 hover:border-primary/50 hover:shadow-sm transition-all group">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className="p-2 bg-primary/10 rounded-lg shrink-0">
            <Database className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-medium text-foreground truncate">
              {connector.name}
            </h3>
            <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
              <span className="px-2 py-0.5 bg-muted rounded capitalize">
                {connector.connectorType}
              </span>
              <span className="capitalize">{connector.category}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {connector.config.host}:{connector.config.port} / {connector.config.database}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {onEdit && (
            <button
              onClick={handleEditClick}
              className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-colors opacity-0 group-hover:opacity-100"
              aria-label={`Edit ${connector.name}`}
              title="Edit connector"
            >
              <Pencil className="w-4 h-4" />
            </button>
          )}
          {onDelete && (
            <button
              onClick={handleDeleteClick}
              className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded transition-colors opacity-0 group-hover:opacity-100"
              aria-label={`Delete ${connector.name}`}
              title="Delete connector"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
