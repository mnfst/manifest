import { useMemo, useRef, useState, useEffect, useCallback } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  MarkerType,
  type Node,
  type Edge,
  type NodeMouseHandler,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import type { View } from '@chatgpt-app-builder/shared';
import { ViewNode } from './ViewNode';

interface FlowDiagramProps {
  views: View[];
  onViewEdit: (view: View) => void;
  onViewDelete: (view: View) => void;
  canDelete: boolean;
}

const nodeTypes = {
  viewNode: ViewNode,
};

/**
 * Visual diagram of views using React Flow
 * Displays views as connected nodes in order
 */
function FlowDiagramInner({
  views,
  onViewEdit,
  onViewDelete,
  canDelete,
}: FlowDiagramProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.offsetWidth,
          height: containerRef.current.offsetHeight,
        });
      }
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  // Handle node click - check which button was clicked
  const onNodeClick: NodeMouseHandler = useCallback((event, node) => {
    const target = event.target as HTMLElement;
    const button = target.closest('button');
    if (button) {
      const action = button.getAttribute('data-action');
      const view = views.find(v => v.id === node.id);
      if (view) {
        if (action === 'edit') {
          onViewEdit(view);
        } else if (action === 'delete' && canDelete) {
          onViewDelete(view);
        }
      }
    }
  }, [views, onViewEdit, onViewDelete, canDelete]);

  // Generate nodes from views
  const nodes = useMemo<Node[]>(() => {
    return views.map((view, index) => ({
      id: view.id,
      type: 'viewNode',
      position: { x: 50 + index * 280, y: 80 },
      data: {
        view,
        canDelete,
        onEdit: () => onViewEdit(view),
        onDelete: () => onViewDelete(view),
      },
    }));
  }, [views, canDelete, onViewEdit, onViewDelete]);

  // Generate edges between consecutive nodes
  const edges = useMemo<Edge[]>(() => {
    return views.slice(0, -1).map((view, index) => ({
      id: `edge-${view.id}-${views[index + 1].id}`,
      source: view.id,
      target: views[index + 1].id,
      type: 'smoothstep',
      animated: false,
      style: { stroke: '#9ca3af', strokeWidth: 2 },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: '#9ca3af',
      },
    }));
  }, [views]);

  if (views.length === 0) {
    return (
      <div ref={containerRef} className="w-full h-full bg-muted/30 flex items-center justify-center">
        <p className="text-muted-foreground">No views yet. Add a view to get started.</p>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="w-full h-full bg-muted/30">
      {dimensions.width > 0 && dimensions.height > 0 && (
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodeClick={onNodeClick}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          panOnScroll
          zoomOnScroll
          minZoom={0.3}
          maxZoom={2}
          proOptions={{ hideAttribution: true }}
        >
          <Background variant={BackgroundVariant.Dots} gap={16} size={1} color="#d1d5db" />
        </ReactFlow>
      )}
    </div>
  );
}

export function FlowDiagram(props: FlowDiagramProps) {
  return (
    <ReactFlowProvider>
      <FlowDiagramInner {...props} />
    </ReactFlowProvider>
  );
}
