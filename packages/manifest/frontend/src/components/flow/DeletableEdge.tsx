import { useState, useCallback } from 'react';
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  type EdgeProps,
} from '@xyflow/react';
import { Trash2, AlertTriangle, CheckCircle, AlertCircle, HelpCircle } from 'lucide-react';
import { STATUS_COLORS, getStatusLabel, type Connection, type CompatibilityStatus } from '@manifest/shared';
import { Button } from '@/components/ui/shadcn/button';
import { api } from '../../lib/api';
import type { ConnectionValidationState } from '../../types/schema';

export interface DeletableEdgeData {
  flowId: string;
  connection: Connection;
  onDelete: (connectionId: string) => void;
  validation?: ConnectionValidationState;
  onShowDetails?: (connection: Connection, validation: ConnectionValidationState) => void;
}

/**
 * Get the status icon component for a validation status.
 */
function getStatusIcon(status: CompatibilityStatus) {
  switch (status) {
    case 'compatible':
      return <CheckCircle className="w-3 h-3" />;
    case 'warning':
      return <AlertTriangle className="w-3 h-3" />;
    case 'error':
      return <AlertCircle className="w-3 h-3" />;
    case 'unknown':
    default:
      return <HelpCircle className="w-3 h-3" />;
  }
}

/**
 * Get the background color class for validation status badge.
 */
function getStatusBgClass(status: CompatibilityStatus): string {
  switch (status) {
    case 'compatible':
      return 'bg-green-500';
    case 'warning':
      return 'bg-yellow-500';
    case 'error':
      return 'bg-red-500';
    case 'unknown':
    default:
      return 'bg-gray-500';
  }
}

/**
 * Custom edge component with trash icon on hover for deleting connections.
 * Shows the trash icon at the midpoint of the edge when hovered.
 * Clicking the icon immediately deletes the connection without confirmation.
 * Also displays validation status with colored edges and tooltip.
 */
export function DeletableEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  data,
}: EdgeProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const edgeData = data as DeletableEdgeData | undefined;
  const validation = edgeData?.validation;

  // Determine edge color based on validation status
  const edgeColor = validation
    ? STATUS_COLORS[validation.status]
    : (style?.stroke as string) || '#60a5fa'; // Default to original style or blue

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const handleDelete = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();

    if (!edgeData || isDeleting) return;

    setIsDeleting(true);
    try {
      await api.deleteConnection(edgeData.flowId, edgeData.connection.id);
      edgeData.onDelete(edgeData.connection.id);
    } catch (err) {
      console.error('Failed to delete connection:', err);
      setIsDeleting(false);
    }
  }, [edgeData, isDeleting]);

  // Build tooltip text
  const tooltipText = validation
    ? `${getStatusLabel(validation.status)}${validation.summary ? `: ${validation.summary}` : ''}`
    : 'Schema not validated';

  return (
    <>
      {/* Invisible wider path for easier hover detection */}
      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={20}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        style={{ cursor: 'pointer' }}
      />

      {/* Visible edge with validation-based color */}
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          ...style,
          stroke: edgeColor,
          strokeWidth: validation ? 2.5 : (style?.strokeWidth as number) || 2,
          opacity: isDeleting ? 0.5 : 1,
          // Add dashed animation for error connections
          ...(validation?.status === 'error' && {
            strokeDasharray: '8 4',
          }),
        }}
        markerEnd={markerEnd}
      />

      {/* Persistent incompatibility indicator for error status */}
      {validation && (validation.status === 'error' || validation.status === 'warning') && !isHovered && (
        <EdgeLabelRenderer>
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              if (edgeData?.onShowDetails && edgeData.connection) {
                edgeData.onShowDetails(edgeData.connection, validation);
              }
            }}
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              pointerEvents: 'all',
            }}
            className={`nodrag nopan flex items-center justify-center w-5 h-5 rounded-full text-white shadow-md hover:scale-110 transition-transform ${getStatusBgClass(validation.status)}`}
            title={`${tooltipText}${edgeData?.onShowDetails ? ' (Click for details)' : ''}`}
          >
            {getStatusIcon(validation.status)}
          </Button>
        </EdgeLabelRenderer>
      )}

      {/* Full controls that appear on hover */}
      <EdgeLabelRenderer>
        <div
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            pointerEvents: 'all',
            opacity: isHovered ? 1 : 0,
            transition: 'opacity 0.15s ease-in-out',
          }}
          className="nodrag nopan flex items-center gap-1"
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          {/* Validation status badge - clickable to show details */}
          {validation && (
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                if (edgeData?.onShowDetails && edgeData.connection) {
                  edgeData.onShowDetails(edgeData.connection, validation);
                }
              }}
              className={`flex items-center gap-1 px-2 py-1 rounded-full text-white text-xs shadow-md hover:opacity-90 transition-opacity h-auto ${getStatusBgClass(validation.status)}`}
              title={`${tooltipText}${edgeData?.onShowDetails ? ' (Click for details)' : ''}`}
            >
              {getStatusIcon(validation.status)}
              <span>{getStatusLabel(validation.status)}</span>
            </Button>
          )}

          {/* Delete button */}
          <Button
            variant="destructive"
            size="icon"
            onClick={handleDelete}
            disabled={isDeleting}
            className="flex items-center justify-center w-6 h-6 rounded-full shadow-md"
            title="Delete connection"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </EdgeLabelRenderer>
    </>
  );
}
