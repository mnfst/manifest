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
import { AddUserIntentNode } from './AddUserIntentNode';
import { AddViewNode } from './AddViewNode';

interface FlowDiagramProps {
  flow: Flow;
  views: View[];
  onViewEdit: (view: View) => void;
  onViewDelete: (view: View) => void;
  onUserIntentEdit: () => void;
  onAddUserIntent?: () => void;
  onAddView?: () => void;
  canDelete: boolean;
}

/**
 * Determines the current state of a flow based on its data
 */
function getFlowState(flow: Flow) {
  const hasUserIntent = Boolean(flow.toolDescription?.trim());
  const hasViews = Boolean(flow.views?.length);
  return { hasUserIntent, hasViews };
}

const nodeTypes = {
  viewNode: ViewNode,
  userIntentNode: UserIntentNode,
  addUserIntentNode: AddUserIntentNode,
  addViewNode: AddViewNode,
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
  onAddUserIntent,
  onAddView,
  canDelete,
}: FlowDiagramProps) {
  const flowState = getFlowState(flow);
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

  // Generate nodes: User Intent node (or placeholder) + View nodes
  const nodes = useMemo<Node[]>(() => {
    const nodeList: Node[] = [];

    // Show AddUserIntentNode placeholder if no user intent, otherwise show UserIntentNode
    if (!flowState.hasUserIntent) {
      // Centered placeholder for adding user intent
      const centerX = Math.max(200, (dimensions.width - 200) / 2);
      const centerY = Math.max(100, (dimensions.height - 100) / 2);
      nodeList.push({
        id: 'add-user-intent',
        type: 'addUserIntentNode',
        position: { x: centerX, y: centerY },
        data: {
          onClick: onAddUserIntent || onUserIntentEdit,
        },
      });
    } else {
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

      // If no views yet, show AddViewNode placeholder
      if (!flowState.hasViews && onAddView) {
        nodeList.push({
          id: 'add-view',
          type: 'addViewNode',
          position: { x: 330, y: 80 },
          data: {
            onClick: onAddView,
          },
        });
      } else {
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
      }
    }

    return nodeList;
  }, [flow, flowState.hasUserIntent, flowState.hasViews, views, canDelete, dimensions, onViewEdit, onViewDelete, onUserIntentEdit, onAddUserIntent, onAddView]);

  // Generate edges: User Intent → first View (or AddViewNode), then View → View
  const edges = useMemo<Edge[]>(() => {
    const edgeList: Edge[] = [];

    // Only show edges if we have user intent
    if (!flowState.hasUserIntent) {
      return edgeList;
    }

    // Edge from User Intent to AddViewNode placeholder (if no views)
    if (!flowState.hasViews && onAddView) {
      edgeList.push({
        id: 'edge-user-intent-add-view',
        source: 'user-intent',
        target: 'add-view',
        type: 'smoothstep',
        animated: true,
        style: { stroke: '#d1d5db', strokeWidth: 2, strokeDasharray: '5,5' },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: '#d1d5db',
        },
      });
    } else if (views.length > 0) {
      // Edge from User Intent to first View
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
    }

    return edgeList;
  }, [views, flowState.hasUserIntent, flowState.hasViews, onAddView]);

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
