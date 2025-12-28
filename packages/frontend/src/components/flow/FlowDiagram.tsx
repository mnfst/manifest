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
import type { View, Flow, ReturnValue } from '@chatgpt-app-builder/shared';
import { ViewNode } from './ViewNode';
import { UserIntentNode } from './UserIntentNode';
import { MockDataNode } from './MockDataNode';
import { AddUserIntentNode } from './AddUserIntentNode';
import { AddStepNode } from './AddStepNode';
import { ReturnValueNode } from './ReturnValueNode';

interface FlowDiagramProps {
  flow: Flow;
  views: View[];
  returnValues: ReturnValue[];
  onViewEdit: (view: View) => void;
  onViewDelete: (view: View) => void;
  onReturnValueEdit: (returnValue: ReturnValue) => void;
  onReturnValueDelete: (returnValue: ReturnValue) => void;
  onUserIntentEdit: () => void;
  onMockDataEdit: (view: View) => void;
  onAddUserIntent?: () => void;
  onAddStep?: () => void;
  canDelete: boolean;
}

/**
 * Determines the current state of a flow based on its data
 */
function getFlowState(flow: Flow, returnValues: ReturnValue[]) {
  const hasUserIntent = Boolean(flow.toolDescription?.trim());
  const hasViews = Boolean(flow.views?.length);
  const hasReturnValues = returnValues.length > 0;
  const hasSteps = hasViews || hasReturnValues;
  return { hasUserIntent, hasViews, hasReturnValues, hasSteps };
}

const nodeTypes = {
  viewNode: ViewNode,
  userIntentNode: UserIntentNode,
  mockDataNode: MockDataNode,
  addUserIntentNode: AddUserIntentNode,
  addStepNode: AddStepNode,
  returnValueNode: ReturnValueNode,
};

/**
 * Visual diagram of views using React Flow
 * Displays user intent node followed by view or return value nodes in order
 */
function FlowDiagramInner({
  flow,
  views,
  returnValues,
  onViewEdit,
  onViewDelete,
  onReturnValueEdit,
  onReturnValueDelete,
  onUserIntentEdit,
  onMockDataEdit,
  onAddUserIntent,
  onAddStep,
  canDelete,
}: FlowDiagramProps) {
  const flowState = getFlowState(flow, returnValues);
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

  // Generate nodes: User Intent node (or placeholder) + MockData nodes + View nodes
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

      // If no steps yet, show AddStepNode placeholder
      if (!flowState.hasSteps && onAddStep) {
        nodeList.push({
          id: 'add-step',
          type: 'addStepNode',
          position: { x: 330, y: 80 },
          data: {
            onClick: onAddStep,
          },
        });
      } else if (flowState.hasViews) {
        // Add MockData nodes (above) and View nodes (below) for each view
        views.forEach((view, index) => {
          const xPosition = 330 + index * 280;

          // MockData node (above view)
          nodeList.push({
            id: `mockdata-${view.id}`,
            type: 'mockDataNode',
            position: { x: xPosition, y: 20 },
            data: {
              mockData: view.mockData,
              layoutTemplate: view.layoutTemplate,
              onEdit: () => onMockDataEdit(view),
            },
          });

          // View node (below mockdata)
          nodeList.push({
            id: view.id,
            type: 'viewNode',
            position: { x: xPosition, y: 130 },
            data: {
              view,
              canDelete,
              onEdit: () => onViewEdit(view),
              onDelete: () => onViewDelete(view),
            },
          });
        });
      } else if (flowState.hasReturnValues) {
        // Add ReturnValue nodes
        returnValues.forEach((returnValue, index) => {
          const xPosition = 330 + index * 250;

          nodeList.push({
            id: returnValue.id,
            type: 'returnValueNode',
            position: { x: xPosition, y: 80 },
            data: {
              returnValue,
              canDelete,
              onEdit: () => onReturnValueEdit(returnValue),
              onDelete: () => onReturnValueDelete(returnValue),
            },
          });
        });
      }
    }

    return nodeList;
  }, [flow, flowState.hasUserIntent, flowState.hasViews, flowState.hasSteps, flowState.hasReturnValues, views, returnValues, canDelete, dimensions, onViewEdit, onViewDelete, onReturnValueEdit, onReturnValueDelete, onUserIntentEdit, onMockDataEdit, onAddUserIntent, onAddStep]);

  // Generate edges: User Intent → first step (View/ReturnValue or AddStep), MockData → View, then step → step
  const edges = useMemo<Edge[]>(() => {
    const edgeList: Edge[] = [];

    // Only show edges if we have user intent
    if (!flowState.hasUserIntent) {
      return edgeList;
    }

    // Edge from User Intent to AddStepNode placeholder (if no steps)
    if (!flowState.hasSteps && onAddStep) {
      edgeList.push({
        id: 'edge-user-intent-add-step',
        source: 'user-intent',
        target: 'add-step',
        type: 'smoothstep',
        animated: true,
        style: { stroke: '#d1d5db', strokeWidth: 2, strokeDasharray: '5,5' },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: '#d1d5db',
        },
      });
    } else if (flowState.hasViews && views.length > 0) {
      // Edge from User Intent to first View
      edgeList.push({
        id: 'edge-user-intent-first-view',
        source: 'user-intent',
        target: views[0].id,
        targetHandle: 'left',
        type: 'smoothstep',
        animated: false,
        style: { stroke: '#60a5fa', strokeWidth: 2 },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: '#60a5fa',
        },
      });

      // Edges from MockData to View (vertical connection)
      views.forEach((view) => {
        edgeList.push({
          id: `edge-mockdata-${view.id}`,
          source: `mockdata-${view.id}`,
          target: view.id,
          targetHandle: 'top',
          type: 'smoothstep',
          animated: false,
          style: { stroke: '#f59e0b', strokeWidth: 2 },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: '#f59e0b',
          },
        });
      });

      // Edges between consecutive Views
      views.slice(0, -1).forEach((view, index) => {
        edgeList.push({
          id: `edge-${view.id}-${views[index + 1].id}`,
          source: view.id,
          target: views[index + 1].id,
          targetHandle: 'left',
          type: 'smoothstep',
          animated: false,
          style: { stroke: '#9ca3af', strokeWidth: 2 },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: '#9ca3af',
          },
        });
      });
    } else if (flowState.hasReturnValues && returnValues.length > 0) {
      // Edge from User Intent to first ReturnValue
      edgeList.push({
        id: 'edge-user-intent-first-return-value',
        source: 'user-intent',
        target: returnValues[0].id,
        targetHandle: 'left',
        type: 'smoothstep',
        animated: false,
        style: { stroke: '#22c55e', strokeWidth: 2 },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: '#22c55e',
        },
      });

      // Edges between consecutive ReturnValues
      returnValues.slice(0, -1).forEach((rv, index) => {
        edgeList.push({
          id: `edge-${rv.id}-${returnValues[index + 1].id}`,
          source: rv.id,
          target: returnValues[index + 1].id,
          targetHandle: 'left',
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
  }, [views, returnValues, flowState.hasUserIntent, flowState.hasViews, flowState.hasSteps, flowState.hasReturnValues, onAddStep]);

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
