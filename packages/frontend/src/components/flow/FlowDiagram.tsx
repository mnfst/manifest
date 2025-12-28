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
import type { View, Flow } from '@chatgpt-app-builder/shared';
import { ViewNode } from './ViewNode';
import { UserIntentNode } from './UserIntentNode';

interface FlowDiagramProps {
  flow: Flow;
  views: View[];
  onViewEdit: (view: View) => void;
  onViewDelete: (view: View) => void;
  onUserIntentEdit: () => void;
  canDelete: boolean;
}

const nodeTypes = {
  viewNode: ViewNode,
  userIntentNode: UserIntentNode,
};

/**
 * Visual diagram of views using React Flow
 * Displays user intent node followed by view nodes in order
 */
function FlowDiagramInner({
  flow,
  views,
  onViewEdit,
  onViewDelete,
  onUserIntentEdit,
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

  // Generate nodes: User Intent node + View nodes
  const nodes = useMemo<Node[]>(() => {
    const nodeList: Node[] = [];

    // Add User Intent node at the beginning
    nodeList.push({
      id: 'user-intent',
      type: 'userIntentNode',
      position: { x: 50, y: 80 },
      data: {
        flow,
        onEdit: onUserIntentEdit,
      },
    });

    // Add View nodes shifted to the right
    views.forEach((view, index) => {
      nodeList.push({
        id: view.id,
        type: 'viewNode',
        position: { x: 330 + index * 280, y: 80 },
        data: {
          view,
          canDelete,
          onEdit: () => onViewEdit(view),
          onDelete: () => onViewDelete(view),
        },
      });
    });

    return nodeList;
  }, [flow, views, canDelete, onViewEdit, onViewDelete, onUserIntentEdit]);

  // Generate edges: User Intent → first View, then View → View
  const edges = useMemo<Edge[]>(() => {
    const edgeList: Edge[] = [];

    // Edge from User Intent to first View (if views exist)
    if (views.length > 0) {
      edgeList.push({
        id: 'edge-user-intent-first-view',
        source: 'user-intent',
        target: views[0].id,
        type: 'smoothstep',
        animated: false,
        style: { stroke: '#60a5fa', strokeWidth: 2 },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: '#60a5fa',
        },
      });
    }

    // Edges between consecutive Views
    views.slice(0, -1).forEach((view, index) => {
      edgeList.push({
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
      });
    });

    return edgeList;
  }, [views]);

  // Even with no views, we still show the User Intent node
  // The empty state message is now shown inside the ReactFlow diagram

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
