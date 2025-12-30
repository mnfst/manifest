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
  type NodeChange,
  type Connection as RFConnection,
  applyNodeChanges,
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
import { DeletableEdge } from './DeletableEdge';

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

const edgeTypes = {
  deletable: DeletableEdge,
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
  const connections = useMemo(() => flow.connections ?? [], [flow.connections]);
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

  // Check if adding a connection would create a cycle (client-side validation)
  const wouldCreateCycle = useCallback((sourceId: string, targetId: string): boolean => {
    const visited = new Set<string>();
    const stack = [targetId];

    while (stack.length > 0) {
      const current = stack.pop()!;
      if (current === sourceId) return true;
      if (visited.has(current)) continue;
      visited.add(current);

      for (const conn of connections) {
        if (conn.sourceNodeId === current) {
          stack.push(conn.targetNodeId);
        }
      }
    }
    return false;
  }, [connections]);

  // Validate connection - allow connections between any nodes with proper handles
  const isValidConnection = useCallback((connection: { source?: string | null; sourceHandle?: string | null; target?: string | null; targetHandle?: string | null }) => {
    const sourceId = connection.source;
    const targetId = connection.target;

    // Must have source and target
    if (!sourceId || !targetId) return false;

    // Prevent self-connections
    if (sourceId === targetId) return false;

    // Prevent circular connections
    if (wouldCreateCycle(sourceId, targetId)) return false;

    return true;
  }, [wouldCreateCycle]);

  // Handle new connection from any source handle to any target
  const onConnect = useCallback(async (connection: RFConnection) => {
    if (!connection.source || !connection.target) return;

    const request: CreateConnectionRequest = {
      sourceNodeId: connection.source,
      sourceHandle: connection.sourceHandle || 'output',
      targetNodeId: connection.target,
      targetHandle: connection.targetHandle || 'input',
    };

    try {
      const newConnection = await api.createConnection(flow.id, request);
      // Notify parent of the change
      if (onConnectionsChange) {
        const updatedConnections = [...connections, newConnection];
        onConnectionsChange(updatedConnections);
      }
    } catch (err) {
      console.error('Failed to create connection:', err);
    }
  }, [flow.id, connections, onConnectionsChange]);

  // Handle connection deletion (called from DeletableEdge)
  const handleConnectionDelete = useCallback((connectionId: string) => {
    if (onConnectionsChange) {
      const updatedConnections = connections.filter(c => c.id !== connectionId);
      onConnectionsChange(updatedConnections);
    }
  }, [connections, onConnectionsChange]);

  // Generate base nodes: User Intent node (or placeholder) + MockData nodes + Interface/Return/CallFlow nodes
  const computedNodes = useMemo<Node[]>(() => {
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

      // Always show AddStepNode when user intent exists - users can add unconnected nodes
      if (onAddStep) {
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

  // State for draggable nodes - initialized from computedNodes and updated on drag
  const [nodes, setNodes] = useState<Node[]>(computedNodes);

  // Sync nodes state when computed nodes change (e.g., new node added, flow data changed)
  useEffect(() => {
    setNodes(computedNodes);
  }, [computedNodes]);

  // Handle node changes (position updates during drag)
  const onNodesChange = useCallback((changes: NodeChange[]) => {
    setNodes((nds) => applyNodeChanges(changes, nds));
  }, []);

  // Generate edges: Only user-created connections from flow.connections
  // No automatic edges - users manually connect nodes via handles
  const edges = useMemo<Edge[]>(() => {
    const edgeList: Edge[] = [];

    // Only show edges if we have user intent
    if (!flowState.hasUserIntent) {
      return edgeList;
    }

    // Only show user-created connections from flow.connections
    connections.forEach((connection) => {
      // Handle special case: connection from user-intent node
      const isFromUserIntent = connection.sourceNodeId === 'user-intent';

      // Verify source node exists (user-intent is a virtual node, always exists if hasUserIntent)
      const sourceExists = isFromUserIntent || flow.nodes?.some(n => n.id === connection.sourceNodeId);
      const targetExists = flow.nodes?.some(n => n.id === connection.targetNodeId);

      if (!sourceExists || !targetExists) return;

      // Determine edge color based on source type
      let strokeColor = '#60a5fa'; // Default blue
      if (isFromUserIntent) {
        strokeColor = '#60a5fa'; // Blue for user intent
      } else {
        const sourceNode = flow.nodes?.find(n => n.id === connection.sourceNodeId);
        if (sourceNode?.type === 'Interface') {
          strokeColor = '#60a5fa'; // Blue for interface
        } else if (sourceNode?.type === 'Return') {
          strokeColor = '#22c55e'; // Green for return
        } else if (sourceNode?.type === 'CallFlow') {
          strokeColor = '#a855f7'; // Purple for call flow
        }
      }

      edgeList.push({
        id: `connection-${connection.id}`,
        source: connection.sourceNodeId,
        sourceHandle: connection.sourceHandle,
        target: connection.targetNodeId,
        targetHandle: connection.targetHandle || 'input',
        type: 'deletable',
        animated: false,
        style: { stroke: strokeColor, strokeWidth: 2 },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: strokeColor,
        },
        data: {
          flowId: flow.id,
          connection,
          onDelete: handleConnectionDelete,
        },
      });
    });

    return edgeList;
  }, [flow.id, flow.nodes, flowState.hasUserIntent, connections, handleConnectionDelete]);

  return (
    <div ref={containerRef} className="w-full h-full bg-muted/30">
      {dimensions.width > 0 && dimensions.height > 0 && (
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onNodesChange={onNodesChange}
          onNodeClick={onNodeClick}
          onConnect={onConnect}
          isValidConnection={isValidConnection}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          nodesDraggable={true}
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
