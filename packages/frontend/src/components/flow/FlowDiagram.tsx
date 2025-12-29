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
  type EdgeMouseHandler,
  type Connection,
  type IsValidConnection,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import type { View, Flow, ReturnValue, CallFlow, ActionConnection, CreateActionConnectionRequest } from '@chatgpt-app-builder/shared';
import { api } from '../../lib/api';
import { ViewNode } from './ViewNode';
import { UserIntentNode } from './UserIntentNode';
import { MockDataNode } from './MockDataNode';
import { AddUserIntentNode } from './AddUserIntentNode';
import { AddStepNode } from './AddStepNode';
import { ReturnValueNode } from './ReturnValueNode';
import { CallFlowNode } from './CallFlowNode';

interface FlowDiagramProps {
  flow: Flow;
  views: View[];
  returnValues: ReturnValue[];
  callFlows: CallFlow[];
  actionConnections: ActionConnection[];
  onViewEdit: (view: View) => void;
  onViewDelete: (view: View) => void;
  onReturnValueEdit: (returnValue: ReturnValue) => void;
  onReturnValueDelete: (returnValue: ReturnValue) => void;
  onCallFlowEdit: (callFlow: CallFlow) => void;
  onCallFlowDelete: (callFlow: CallFlow) => void;
  onUserIntentEdit: () => void;
  onMockDataEdit: (view: View) => void;
  onAddUserIntent?: () => void;
  onAddStep?: () => void;
  canDelete: boolean;
  onActionConnectionsChange?: (connections: ActionConnection[]) => void;
}

/**
 * Determines the current state of a flow based on its data
 */
function getFlowState(flow: Flow, returnValues: ReturnValue[], callFlows: CallFlow[]) {
  const hasUserIntent = Boolean(flow.toolDescription?.trim());
  const hasViews = Boolean(flow.views?.length);
  const hasReturnValues = returnValues.length > 0;
  const hasCallFlows = callFlows.length > 0;
  const hasSteps = hasViews || hasReturnValues || hasCallFlows;
  return { hasUserIntent, hasViews, hasReturnValues, hasCallFlows, hasSteps };
}

const nodeTypes = {
  viewNode: ViewNode,
  userIntentNode: UserIntentNode,
  mockDataNode: MockDataNode,
  addUserIntentNode: AddUserIntentNode,
  addStepNode: AddStepNode,
  returnValueNode: ReturnValueNode,
  callFlowNode: CallFlowNode,
};

/**
 * Visual diagram of views using React Flow
 * Displays user intent node followed by view or return value nodes in order
 */
function FlowDiagramInner({
  flow,
  views,
  returnValues,
  callFlows,
  actionConnections,
  onViewEdit,
  onViewDelete,
  onReturnValueEdit,
  onReturnValueDelete,
  onCallFlowEdit,
  onCallFlowDelete,
  onUserIntentEdit,
  onMockDataEdit,
  onAddUserIntent,
  onAddStep,
  canDelete,
  onActionConnectionsChange,
}: FlowDiagramProps) {
  const flowState = getFlowState(flow, returnValues, callFlows);
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

  // Validate connection - only allow action handles to connect to return value or call flow nodes
  const isValidConnection: IsValidConnection = useCallback((connection: Connection) => {
    // Only validate connections from action handles
    if (!connection.sourceHandle?.startsWith('action:')) {
      return false; // Don't allow non-action connections (diagram is read-only for other edges)
    }

    // Action handles can connect to return value nodes or call flow nodes
    const targetNode = connection.target;
    const isReturnValueTarget = returnValues.some(rv => rv.id === targetNode);
    const isCallFlowTarget = callFlows.some(cf => cf.id === targetNode);

    return isReturnValueTarget || isCallFlowTarget;
  }, [returnValues, callFlows]);

  // Handle new connection from action handle to target
  const onConnect = useCallback(async (connection: Connection) => {
    if (!connection.sourceHandle?.startsWith('action:')) return;
    if (!connection.source || !connection.target) return;

    const actionName = connection.sourceHandle.replace('action:', '');
    const viewId = connection.source;
    const targetNodeId = connection.target;

    // Determine target type
    const isReturnValueTarget = returnValues.some(rv => rv.id === targetNodeId);
    const isCallFlowTarget = callFlows.some(cf => cf.id === targetNodeId);

    if (!isReturnValueTarget && !isCallFlowTarget) return;

    const request: CreateActionConnectionRequest = {
      actionName,
      targetType: isReturnValueTarget ? 'return-value' : 'call-flow',
      targetReturnValueId: isReturnValueTarget ? targetNodeId : undefined,
      targetCallFlowId: isCallFlowTarget ? targetNodeId : undefined,
    };

    try {
      const newConnection = await api.createActionConnection(viewId, request);
      // Notify parent of the change
      if (onActionConnectionsChange) {
        // Replace any existing connection for this action, or add new one
        const updatedConnections = actionConnections.filter(
          c => !(c.viewId === viewId && c.actionName === actionName)
        );
        updatedConnections.push(newConnection);
        onActionConnectionsChange(updatedConnections);
      }
    } catch (err) {
      console.error('Failed to create action connection:', err);
    }
  }, [returnValues, callFlows, actionConnections, onActionConnectionsChange]);

  // Handle edge click for action connection deletion
  const onEdgeClick: EdgeMouseHandler = useCallback(async (event, edge) => {
    // Only handle action connection edges (those starting with 'action-edge-')
    if (!edge.id.startsWith('action-edge-')) {
      return;
    }

    // Find the corresponding action connection
    const connectionId = edge.id.replace('action-edge-', '');
    const connection = actionConnections.find(c => c.id === connectionId);
    if (!connection) {
      return;
    }

    // Confirm deletion (simple confirm for POC)
    if (!window.confirm('Delete this action connection?')) {
      return;
    }

    try {
      await api.deleteActionConnection(connection.viewId, connection.actionName);
      // Notify parent of the change
      if (onActionConnectionsChange) {
        const updatedConnections = actionConnections.filter(c => c.id !== connectionId);
        onActionConnectionsChange(updatedConnections);
      }
    } catch (err) {
      console.error('Failed to delete action connection:', err);
    }
  }, [actionConnections, onActionConnectionsChange]);

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

      // Track horizontal position for all step types
      let xPosition = 330;

      // Add MockData nodes (above) and View nodes (below) for each view
      views.forEach((view) => {
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

        xPosition += 280;
      });

      // Add ReturnValue nodes
      returnValues.forEach((returnValue) => {
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

        xPosition += 250;
      });

      // Add CallFlow nodes
      callFlows.forEach((callFlow) => {
        nodeList.push({
          id: callFlow.id,
          type: 'callFlowNode',
          position: { x: xPosition, y: 80 },
          data: {
            callFlow,
            canDelete,
            onEdit: () => onCallFlowEdit(callFlow),
            onDelete: () => onCallFlowDelete(callFlow),
          },
        });

        xPosition += 250;
      });

      // Show AddStepNode only if there are no end actions (return values or call flows)
      // End actions are terminal - nothing comes after them
      const hasEndActions = returnValues.length > 0 || callFlows.length > 0;
      if (onAddStep && !hasEndActions) {
        nodeList.push({
          id: 'add-step',
          type: 'addStepNode',
          position: { x: xPosition, y: 80 },
          data: {
            onClick: onAddStep,
          },
        });
      }
    }

    return nodeList;
  }, [flow, flowState.hasUserIntent, flowState.hasViews, flowState.hasSteps, flowState.hasReturnValues, flowState.hasCallFlows, views, returnValues, callFlows, canDelete, dimensions, onViewEdit, onViewDelete, onReturnValueEdit, onReturnValueDelete, onCallFlowEdit, onCallFlowDelete, onUserIntentEdit, onMockDataEdit, onAddUserIntent, onAddStep]);

  // Generate edges: User Intent → first step (View/ReturnValue or AddStep), MockData → View, then step → step
  const edges = useMemo<Edge[]>(() => {
    const edgeList: Edge[] = [];

    // Only show edges if we have user intent
    if (!flowState.hasUserIntent) {
      return edgeList;
    }

    // Determine the first step to connect from User Intent
    // Only show add-step if there are no end actions (return values or call flows)
    const hasAnyEndActions = returnValues.length > 0 || callFlows.length > 0;
    const firstStep = views.length > 0
      ? { id: views[0].id, handle: 'left', color: '#60a5fa' }
      : returnValues.length > 0
        ? { id: returnValues[0].id, handle: 'left', color: '#22c55e' }
        : callFlows.length > 0
          ? { id: callFlows[0].id, handle: 'left', color: '#a855f7' }
          : (onAddStep && !hasAnyEndActions)
            ? { id: 'add-step', handle: undefined, color: '#d1d5db', dashed: true }
            : null;

    // Edge from User Intent to first step
    if (firstStep) {
      edgeList.push({
        id: 'edge-user-intent-first-step',
        source: 'user-intent',
        target: firstStep.id,
        targetHandle: firstStep.handle,
        type: 'smoothstep',
        animated: firstStep.dashed || false,
        style: {
          stroke: firstStep.color,
          strokeWidth: 2,
          ...(firstStep.dashed ? { strokeDasharray: '5,5' } : {}),
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: firstStep.color,
        },
      });
    }

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

    // Edge from last view to add-step button (only if no end actions exist)
    const hasEndActions = returnValues.length > 0 || callFlows.length > 0;
    if (views.length > 0 && onAddStep && !hasEndActions) {
      edgeList.push({
        id: 'edge-last-view-add-step',
        source: views[views.length - 1].id,
        target: 'add-step',
        type: 'smoothstep',
        animated: true,
        style: { stroke: '#d1d5db', strokeWidth: 2, strokeDasharray: '5,5' },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: '#d1d5db',
        },
      });
    }

    // Add action connection edges (purple themed, from action handles to targets)
    actionConnections.forEach((connection) => {
      const targetId = connection.targetType === 'return-value'
        ? connection.targetReturnValueId
        : connection.targetCallFlowId;

      if (!targetId) return;

      // Verify the target still exists
      const targetExists = connection.targetType === 'return-value'
        ? returnValues.some(rv => rv.id === targetId)
        : callFlows.some(cf => cf.id === targetId);

      if (!targetExists) return;

      edgeList.push({
        id: `action-edge-${connection.id}`,
        source: connection.viewId,
        sourceHandle: `action:${connection.actionName}`,
        target: targetId,
        targetHandle: 'action-target',
        type: 'smoothstep',
        animated: false,
        style: { stroke: '#a855f7', strokeWidth: 2 },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: '#a855f7',
        },
      });
    });

    return edgeList;
  }, [views, returnValues, callFlows, actionConnections, flowState.hasUserIntent, flowState.hasViews, flowState.hasSteps, flowState.hasReturnValues, flowState.hasCallFlows, onAddStep]);

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
          onEdgeClick={onEdgeClick}
          onConnect={onConnect}
          isValidConnection={isValidConnection}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          nodesDraggable={false}
          nodesConnectable={true}
          elementsSelectable={true}
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
