import { useState, useCallback } from 'react';
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  type EdgeProps,
} from '@xyflow/react';
import { Trash2 } from 'lucide-react';
import type { Connection } from '@chatgpt-app-builder/shared';
import { api } from '../../lib/api';

export interface DeletableEdgeData {
  flowId: string;
  connection: Connection;
  onDelete: (connectionId: string) => void;
}

/**
 * Custom edge component with trash icon on hover for deleting connections.
 * Shows the trash icon at the midpoint of the edge when hovered.
 * Clicking the icon immediately deletes the connection without confirmation.
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

      {/* Visible edge */}
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          ...style,
          opacity: isDeleting ? 0.5 : 1,
        }}
        markerEnd={markerEnd}
      />

      {/* Delete button that appears on hover */}
      <EdgeLabelRenderer>
        <div
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            pointerEvents: 'all',
            opacity: isHovered ? 1 : 0,
            transition: 'opacity 0.15s ease-in-out',
          }}
          className="nodrag nopan"
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          <button
            onClick={handleDelete}
            disabled={isDeleting}
            className="flex items-center justify-center w-6 h-6 rounded-full bg-red-500 hover:bg-red-600 text-white shadow-md transition-colors disabled:opacity-50"
            title="Delete connection"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </EdgeLabelRenderer>
    </>
  );
}
