import { useMemo, useRef, useState, useEffect, useCallback } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  MarkerType,
  useReactFlow,
  type Node,
  type Edge,
  type NodeMouseHandler,
  type EdgeMouseHandler,
  type Connection as RFConnection,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import type {
  Flow,
  NodeInstance,
  Connection,
  CreateConnectionRequest,
  InterfaceNodeParameters,
} from '@chatgpt-app-builder/shared';
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
  onNodeEdit: (node: NodeInstance) => void;
  onNodeDelete: (node: NodeInstance) => void;
  onUserIntentEdit: () => void;
  onMockDataEdit: (node: NodeInstance) => void;
  onAddUserIntent?: () => void;
  onAddStep?: () => void;
  canDelete: boolean;
  onConnectionsChange?: (connections: Connection[]) => void;
  flowNameLookup?: Record<string, string>; // Maps flowId to flowName for CallFlow nodes
}

/**
 * Determines the current state of a flow based on its data
 */
function getFlowState(flow: Flow) {
  const hasUserIntent = Boolean(flow.toolDescription?.trim());
  const nodes = flow.nodes ?? [];
  const interfaceNodes = nodes.filter(n => n.type === 'Interface');
  const returnNodes = nodes.filter(n => n.type === 'Return');
  const callFlowNodes = nodes.filter(n => n.type === 'CallFlow');
  const hasInterfaceNodes = interfaceNodes.length > 0;
  const hasReturnNodes = returnNodes.length > 0;
  const hasCallFlowNodes = callFlowNodes.length > 0;
  const hasSteps = hasInterfaceNodes || hasReturnNodes || hasCallFlowNodes;
  return { hasUserIntent, hasInterfaceNodes, hasReturnNodes, hasCallFlowNodes, hasSteps, interfaceNodes, returnNodes, callFlowNodes };
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
 * Visual diagram of nodes using React Flow
 * Displays user intent node followed by Interface, Return, or CallFlow nodes
 */
function FlowDiagramInner({
  flow,
  onNodeEdit,
  onNodeDelete,
  onUserIntentEdit,
  onMockDataEdit,
  onAddUserIntent,
  onAddStep,
  canDelete,
  onConnectionsChange,
  flowNameLookup = {},
}: FlowDiagramProps) {
  const flowState = getFlowState(flow);
  const connections = flow.connections ?? [];
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const { fitView } = useReactFlow();

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

  // Re-fit view when the flow state changes (e.g., user intent added/removed, nodes added)
  const nodeCount = (flow.nodes ?? []).length;
  useEffect(() => {
    // Small delay to ensure nodes are rendered before fitting
    const timer = setTimeout(() => {
      fitView({ padding: 0.2 });
    }, 50);
    return () => clearTimeout(timer);
  }, [flowState.hasUserIntent, nodeCount, fitView]);

  // Handle node click - check which button was clicked
  const onNodeClick: NodeMouseHandler = useCallback((_event, node) => {
    const target = _event.target as HTMLElement;
    const button = target.closest('button');
    if (button) {
      const action = button.getAttribute('data-action');
      const nodeInstance = flow.nodes?.find(n => n.id === node.id);
      if (nodeInstance) {
        if (action === 'edit') {
          onNodeEdit(nodeInstance);
        } else if (action === 'delete' && canDelete) {
          onNodeDelete(nodeInstance);
        }
      }
    }
  }, [flow.nodes, onNodeEdit, onNodeDelete, canDelete]);

  // Validate connection - only allow action handles to connect to Return or CallFlow nodes
  const isValidConnection = useCallback((connection: { sourceHandle?: string | null; target?: string | null }) => {
    // Only validate connections from action handles
    if (!connection.sourceHandle?.startsWith('action:')) {
      return false; // Don't allow non-action connections (diagram is read-only for other edges)
    }

    // Action handles can connect to Return nodes or CallFlow nodes
    const targetNodeId = connection.target;
    const isReturnTarget = flowState.returnNodes.some(n => n.id === targetNodeId);
    const isCallFlowTarget = flowState.callFlowNodes.some(n => n.id === targetNodeId);

    return isReturnTarget || isCallFlowTarget;
  }, [flowState.returnNodes, flowState.callFlowNodes]);

  // Handle new connection from action handle to target
  const onConnect = useCallback(async (connection: RFConnection) => {
    if (!connection.sourceHandle?.startsWith('action:')) return;
    if (!connection.source || !connection.target) return;

    const request: CreateConnectionRequest = {
      sourceNodeId: connection.source,
      sourceHandle: connection.sourceHandle,
      targetNodeId: connection.target,
      targetHandle: connection.targetHandle || 'action-target',
    };

    try {
      const newConnection = await api.createConnection(flow.id, request);
      // Notify parent of the change
      if (onConnectionsChange) {
        // Replace any existing connection for this source handle, or add new one
        const updatedConnections = connections.filter(
          c => !(c.sourceNodeId === connection.source && c.sourceHandle === connection.sourceHandle)
        );
        updatedConnections.push(newConnection);
        onConnectionsChange(updatedConnections);
      }
    } catch (err) {
      console.error('Failed to create connection:', err);
    }
  }, [flow.id, connections, onConnectionsChange]);

  // Handle edge click for connection deletion
  const onEdgeClick: EdgeMouseHandler = useCallback(async (_event, edge) => {
    // Only handle action connection edges (those starting with 'action-edge-')
    if (!edge.id.startsWith('action-edge-')) {
      return;
    }

    // Find the corresponding connection
    const connectionId = edge.id.replace('action-edge-', '');
    const connection = connections.find(c => c.id === connectionId);
    if (!connection) {
      return;
    }

    // Confirm deletion (simple confirm for POC)
    if (!window.confirm('Delete this connection?')) {
      return;
    }

    try {
      await api.deleteConnection(flow.id, connection.id);
      // Notify parent of the change
      if (onConnectionsChange) {
        const updatedConnections = connections.filter(c => c.id !== connectionId);
        onConnectionsChange(updatedConnections);
      }
    } catch (err) {
      console.error('Failed to delete connection:', err);
    }
  }, [flow.id, connections, onConnectionsChange]);

  // Generate nodes: User Intent node (or placeholder) + MockData nodes + Interface/Return/CallFlow nodes
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

      // Add MockData nodes (above) and Interface nodes (below) for each Interface node
      flowState.interfaceNodes.forEach((node) => {
        const params = node.parameters as unknown as InterfaceNodeParameters;

        // MockData node (above interface)
        nodeList.push({
          id: `mockdata-${node.id}`,
          type: 'mockDataNode',
          position: { x: xPosition, y: 20 },
          data: {
            mockData: params?.mockData,
            layoutTemplate: params?.layoutTemplate || 'table',
            onEdit: () => onMockDataEdit(node),
          },
        });

        // Interface node (below mockdata)
        nodeList.push({
          id: node.id,
          type: 'viewNode',
          position: { x: xPosition, y: 130 },
          data: {
            node,
            canDelete,
            onEdit: () => onNodeEdit(node),
            onDelete: () => onNodeDelete(node),
          },
        });

        xPosition += 280;
      });

      // Add Return nodes
      flowState.returnNodes.forEach((node) => {
        nodeList.push({
          id: node.id,
          type: 'returnValueNode',
          position: { x: xPosition, y: 80 },
          data: {
            node,
            canDelete,
            onEdit: () => onNodeEdit(node),
            onDelete: () => onNodeDelete(node),
          },
        });

        xPosition += 250;
      });

      // Add CallFlow nodes
      flowState.callFlowNodes.forEach((node) => {
        const params = node.parameters as { targetFlowId?: string | null };
        const targetFlowId = params?.targetFlowId;

        nodeList.push({
          id: node.id,
          type: 'callFlowNode',
          position: { x: xPosition, y: 80 },
          data: {
            node,
            targetFlowName: targetFlowId ? flowNameLookup[targetFlowId] : undefined,
            canDelete,
            onEdit: () => onNodeEdit(node),
            onDelete: () => onNodeDelete(node),
          },
        });

        xPosition += 250;
      });

      // Show AddStepNode only if there are no end actions (Return or CallFlow nodes)
      // End actions are terminal - nothing comes after them
      const hasEndActions = flowState.hasReturnNodes || flowState.hasCallFlowNodes;
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
  }, [flow, flowState, canDelete, dimensions, onNodeEdit, onNodeDelete, onUserIntentEdit, onMockDataEdit, onAddUserIntent, onAddStep, flowNameLookup]);

  // Generate edges: User Intent → first step, MockData → Interface, then step → step
  const edges = useMemo<Edge[]>(() => {
    const edgeList: Edge[] = [];

    // Only show edges if we have user intent
    if (!flowState.hasUserIntent) {
      return edgeList;
    }

    // Determine the first step to connect from User Intent
    const hasAnyEndActions = flowState.hasReturnNodes || flowState.hasCallFlowNodes;
    const firstStep = flowState.interfaceNodes.length > 0
      ? { id: flowState.interfaceNodes[0].id, handle: 'left', color: '#60a5fa' }
      : flowState.returnNodes.length > 0
        ? { id: flowState.returnNodes[0].id, handle: 'left', color: '#22c55e' }
        : flowState.callFlowNodes.length > 0
          ? { id: flowState.callFlowNodes[0].id, handle: 'left', color: '#a855f7' }
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

    // Edges from MockData to Interface (vertical connection)
    flowState.interfaceNodes.forEach((node) => {
      edgeList.push({
        id: `edge-mockdata-${node.id}`,
        source: `mockdata-${node.id}`,
        target: node.id,
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

    // Edges between consecutive Interface nodes
    flowState.interfaceNodes.slice(0, -1).forEach((node, index) => {
      edgeList.push({
        id: `edge-${node.id}-${flowState.interfaceNodes[index + 1].id}`,
        source: node.id,
        target: flowState.interfaceNodes[index + 1].id,
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

    // Edge from last Interface to add-step button (only if no end actions exist)
    const hasEndActions = flowState.hasReturnNodes || flowState.hasCallFlowNodes;
    if (flowState.interfaceNodes.length > 0 && onAddStep && !hasEndActions) {
      edgeList.push({
        id: 'edge-last-interface-add-step',
        source: flowState.interfaceNodes[flowState.interfaceNodes.length - 1].id,
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

    // Add connection edges (purple themed, from action handles to targets)
    connections.forEach((connection) => {
      // Only show edges for action connections
      if (!connection.sourceHandle.startsWith('action:')) return;

      // Verify both source and target nodes exist
      const sourceExists = flow.nodes?.some(n => n.id === connection.sourceNodeId);
      const targetExists = flow.nodes?.some(n => n.id === connection.targetNodeId);

      if (!sourceExists || !targetExists) return;

      edgeList.push({
        id: `action-edge-${connection.id}`,
        source: connection.sourceNodeId,
        sourceHandle: connection.sourceHandle,
        target: connection.targetNodeId,
        targetHandle: connection.targetHandle || 'action-target',
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
  }, [flow.nodes, flowState, connections, onAddStep]);

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
