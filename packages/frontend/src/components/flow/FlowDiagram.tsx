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
} from '@chatgpt-app-builder/shared';
import { api } from '../../lib/api';
import { ViewNode } from './ViewNode';
import { UserIntentNode } from './UserIntentNode';
import { AddUserIntentNode } from './AddUserIntentNode';
import { ReturnValueNode } from './ReturnValueNode';
import { CallFlowNode } from './CallFlowNode';
import { ApiCallNode } from './ApiCallNode';
import { DeletableEdge } from './DeletableEdge';
import { CompatibilityDetailModal } from './CompatibilityDetailModal';
import { useSchemaValidation } from '../../hooks/useSchemaValidation';
import { STATUS_COLORS, type ConnectionValidationState } from '../../types/schema';

interface FlowDiagramProps {
  flow: Flow;
  onNodeEdit: (node: NodeInstance) => void;
  onNodeDelete: (node: NodeInstance) => void;
  onAddStep?: () => void;
  canDelete: boolean;
  onConnectionsChange?: (connections: Connection[]) => void;
  flowNameLookup?: Record<string, string>; // Maps flowId to flowName for CallFlow nodes
  /** ID of a node that was recently saved (triggers re-validation of its connections) */
  savedNodeId?: string | null;
}

/**
 * Determines the current state of a flow based on its data
 */
function getFlowState(flow: Flow) {
  const nodes = flow.nodes ?? [];
  const userIntentNodes = nodes.filter(n => n.type === 'UserIntent');
  const statCardNodes = nodes.filter(n => n.type === 'StatCard');
  const returnNodes = nodes.filter(n => n.type === 'Return');
  const callFlowNodes = nodes.filter(n => n.type === 'CallFlow');
  const apiCallNodes = nodes.filter(n => n.type === 'ApiCall');
  const hasUserIntentNodes = userIntentNodes.length > 0;
  const hasStatCardNodes = statCardNodes.length > 0;
  const hasReturnNodes = returnNodes.length > 0;
  const hasCallFlowNodes = callFlowNodes.length > 0;
  const hasApiCallNodes = apiCallNodes.length > 0;
  const hasSteps = hasStatCardNodes || hasReturnNodes || hasCallFlowNodes || hasApiCallNodes;
  return { hasUserIntentNodes, hasStatCardNodes, hasReturnNodes, hasCallFlowNodes, hasApiCallNodes, hasSteps, userIntentNodes, statCardNodes, returnNodes, callFlowNodes, apiCallNodes };
}

const nodeTypes = {
  viewNode: ViewNode,
  userIntentNode: UserIntentNode,
  addUserIntentNode: AddUserIntentNode,
  returnValueNode: ReturnValueNode,
  callFlowNode: CallFlowNode,
  apiCallNode: ApiCallNode,
};

const edgeTypes = {
  deletable: DeletableEdge,
};

/**
 * Visual diagram of nodes using React Flow
 * Displays UserIntent trigger nodes followed by StatCard, Return, CallFlow, or ApiCall nodes
 */
function FlowDiagramInner({
  flow,
  onNodeEdit,
  onNodeDelete,
  onAddStep,
  canDelete,
  onConnectionsChange,
  flowNameLookup = {},
  savedNodeId,
}: FlowDiagramProps) {
  // Memoize flow state to prevent recalculation on every render
  const flowState = useMemo(() => getFlowState(flow), [flow.nodes]);

  // Create a stable node lookup map (used by callbacks and edge generation)
  const nodeMap = useMemo(() => {
    const map = new Map<string, NodeInstance>();
    (flow.nodes ?? []).forEach(n => map.set(n.id, n));
    return map;
  }, [flow.nodes]);

  // Memoize connections array
  const connections = useMemo(() => flow.connections ?? [], [flow.connections]);

  // Schema validation hook for connection validation status
  const { validateConnection, validateConnections, getValidationByConnection, invalidateNode } = useSchemaValidation(flow.id);

  // Validate all connections when they change
  useEffect(() => {
    if (connections.length > 0) {
      validateConnections(connections).catch(err => {
        console.error('Failed to validate connections:', err);
      });
    }
  }, [connections, validateConnections]);

  // Re-validate connections when a node is saved (parameters may have changed)
  useEffect(() => {
    if (savedNodeId) {
      // Invalidate cache for this node
      invalidateNode(savedNodeId);

      // Find and re-validate connections involving this node
      const affectedConnections = connections.filter(
        c => c.sourceNodeId === savedNodeId || c.targetNodeId === savedNodeId
      );

      if (affectedConnections.length > 0) {
        validateConnections(affectedConnections).catch(err => {
          console.error('Failed to re-validate connections after node save:', err);
        });
      }
    }
  }, [savedNodeId, connections, invalidateNode, validateConnections]);

  // State for compatibility detail modal
  const [selectedConnection, setSelectedConnection] = useState<{
    connection: Connection;
    validation: ConnectionValidationState;
    sourceName?: string;
    targetName?: string;
  } | null>(null);

  // Handler for showing connection details
  const handleShowConnectionDetails = useCallback((connection: Connection, validation: ConnectionValidationState) => {
    const sourceNode = nodeMap.get(connection.sourceNodeId);
    const targetNode = nodeMap.get(connection.targetNodeId);
    setSelectedConnection({
      connection,
      validation,
      sourceName: sourceNode?.name,
      targetName: targetNode?.name,
    });
  }, [nodeMap]);

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
  }, [flowState.hasUserIntentNodes, nodeCount, fitView]);

  // Handle node click - check which button was clicked
  const onNodeClick: NodeMouseHandler = useCallback((_event, node) => {
    const target = _event.target as HTMLElement;
    const button = target.closest('button');
    if (button) {
      const action = button.getAttribute('data-action');
      const nodeInstance = nodeMap.get(node.id);
      if (nodeInstance) {
        if (action === 'edit') {
          onNodeEdit(nodeInstance);
        } else if (action === 'delete' && canDelete) {
          onNodeDelete(nodeInstance);
        }
      }
    }
  }, [nodeMap, onNodeEdit, onNodeDelete, canDelete]);

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

    // Prevent connections TO trigger nodes (UserIntent nodes)
    // Use flowState.userIntentNodes for stable reference
    const isTargetTrigger = flowState.userIntentNodes.some(n => n.id === targetId);
    if (isTargetTrigger) return false;

    // Prevent circular connections
    if (wouldCreateCycle(sourceId, targetId)) return false;

    return true;
  }, [wouldCreateCycle, flowState.userIntentNodes]);

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

      // Validate the new connection for schema compatibility
      validateConnection(connection.source, connection.target).catch(err => {
        console.error('Failed to validate connection:', err);
      });

      // Notify parent of the change
      if (onConnectionsChange) {
        const updatedConnections = [...connections, newConnection];
        onConnectionsChange(updatedConnections);
      }
    } catch (err) {
      console.error('Failed to create connection:', err);
    }
  }, [flow.id, connections, onConnectionsChange, validateConnection]);

  // Handle connection deletion (called from DeletableEdge)
  const handleConnectionDelete = useCallback((connectionId: string) => {
    if (onConnectionsChange) {
      const updatedConnections = connections.filter(c => c.id !== connectionId);
      onConnectionsChange(updatedConnections);
    }
  }, [connections, onConnectionsChange]);

  // Generate base nodes: UserIntent nodes + StatCard/Return/CallFlow/ApiCall nodes
  const computedNodes = useMemo<Node[]>(() => {
    const nodeList: Node[] = [];

    // Track horizontal position for nodes without saved positions
    let xPosition = 50;

    // Show AddUserIntentNode placeholder if no UserIntent nodes exist
    if (!flowState.hasUserIntentNodes) {
      // Centered placeholder for adding user intent
      const centerX = Math.max(200, (dimensions.width - 200) / 2);
      const centerY = Math.max(100, (dimensions.height - 100) / 2);
      nodeList.push({
        id: 'add-user-intent',
        type: 'addUserIntentNode',
        position: { x: centerX, y: centerY },
        data: {
          onClick: onAddStep,
        },
      });
    } else {
      // Add UserIntent nodes (trigger nodes)
      flowState.userIntentNodes.forEach((node) => {
        const nodePos = node.position || { x: xPosition, y: 80 };
        nodeList.push({
          id: node.id,
          type: 'userIntentNode',
          position: nodePos,
          data: {
            node,
            canDelete,
            onEdit: () => onNodeEdit(node),
            onDelete: () => onNodeDelete(node),
          },
        });

        xPosition = Math.max(xPosition, nodePos.x) + 280;
      });

      // Add StatCard nodes
      flowState.statCardNodes.forEach((node) => {
        // Use saved position or calculate based on order
        const nodePos = node.position || { x: xPosition, y: 130 };

        nodeList.push({
          id: node.id,
          type: 'viewNode',
          position: nodePos,
          data: {
            node,
            canDelete,
            onEdit: () => onNodeEdit(node),
            onDelete: () => onNodeDelete(node),
          },
        });

        // Update xPosition for next node without saved position
        xPosition = Math.max(xPosition, nodePos.x) + 280;
      });

      // Add Return nodes
      flowState.returnNodes.forEach((node) => {
        const nodePos = node.position || { x: xPosition, y: 80 };
        nodeList.push({
          id: node.id,
          type: 'returnValueNode',
          position: nodePos,
          data: {
            node,
            canDelete,
            onEdit: () => onNodeEdit(node),
            onDelete: () => onNodeDelete(node),
          },
        });

        xPosition = Math.max(xPosition, nodePos.x) + 250;
      });

      // Add CallFlow nodes
      flowState.callFlowNodes.forEach((node) => {
        const params = node.parameters as { targetFlowId?: string | null };
        const targetFlowId = params?.targetFlowId;
        const nodePos = node.position || { x: xPosition, y: 80 };

        nodeList.push({
          id: node.id,
          type: 'callFlowNode',
          position: nodePos,
          data: {
            node,
            targetFlowName: targetFlowId ? flowNameLookup[targetFlowId] : undefined,
            canDelete,
            onEdit: () => onNodeEdit(node),
            onDelete: () => onNodeDelete(node),
          },
        });

        xPosition = Math.max(xPosition, nodePos.x) + 250;
      });

      // Add ApiCall nodes
      flowState.apiCallNodes.forEach((node) => {
        const nodePos = node.position || { x: xPosition, y: 80 };

        nodeList.push({
          id: node.id,
          type: 'apiCallNode',
          position: nodePos,
          data: {
            node,
            canDelete,
            onEdit: () => onNodeEdit(node),
            onDelete: () => onNodeDelete(node),
          },
        });

        xPosition = Math.max(xPosition, nodePos.x) + 250;
      });
    }

    return nodeList;
  // Use specific dependencies instead of entire flow object to prevent unnecessary recalculations
  // onAddStep is used for AddUserIntentNode placeholder when no triggers exist
  }, [flowState, canDelete, dimensions.width, dimensions.height, onNodeEdit, onNodeDelete, onAddStep, flowNameLookup]);

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

  // Persist node position when drag ends
  const onNodeDragStop = useCallback(async (_event: React.MouseEvent, node: Node) => {
    // Skip virtual nodes (user-intent, add-step)
    if (node.id === 'user-intent' || node.id === 'add-step') {
      return;
    }

    try {
      await api.updateNodePosition(flow.id, node.id, {
        x: node.position.x,
        y: node.position.y,
      });
    } catch (err) {
      console.error('Failed to save node position:', err);
    }
  }, [flow.id]);

  // Generate edges: Only user-created connections from flow.connections
  // No automatic edges - users manually connect nodes via handles
  const edges = useMemo<Edge[]>(() => {
    const edgeList: Edge[] = [];

    // Only show edges if we have UserIntent nodes
    if (!flowState.hasUserIntentNodes) {
      return edgeList;
    }

    // Only show user-created connections from flow.connections
    connections.forEach((connection) => {
      // Verify source and target nodes exist using the stable nodeMap
      const sourceNode = nodeMap.get(connection.sourceNodeId);
      const targetNode = nodeMap.get(connection.targetNodeId);

      if (!sourceNode || !targetNode) return;

      // Get validation status for this connection
      const validation = getValidationByConnection(connection);

      // Determine edge color based on validation status (if available) or source type
      let strokeColor: string;
      if (validation) {
        strokeColor = STATUS_COLORS[validation.status];
      } else {
        // Fallback to source type coloring when validation not available
        strokeColor = '#60a5fa'; // Default blue
        if (sourceNode.type === 'UserIntent') {
          strokeColor = '#60a5fa'; // Blue for user intent
        } else if (sourceNode.type === 'StatCard') {
          strokeColor = '#60a5fa'; // Blue for interface
        } else if (sourceNode.type === 'Return') {
          strokeColor = '#22c55e'; // Green for return
        } else if (sourceNode.type === 'CallFlow') {
          strokeColor = '#a855f7'; // Purple for call flow
        } else if (sourceNode.type === 'ApiCall') {
          strokeColor = '#f97316'; // Orange for API call
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
          validation,
          onShowDetails: handleShowConnectionDetails,
        },
      });
    });

    return edgeList;
  }, [flow.id, nodeMap, flowState.hasUserIntentNodes, connections, handleConnectionDelete, getValidationByConnection, handleShowConnectionDetails]);

  return (
    <>
    <div ref={containerRef} className="w-full h-full bg-muted/30">
      {dimensions.width > 0 && dimensions.height > 0 && (
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onNodesChange={onNodesChange}
          onNodeDragStop={onNodeDragStop}
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

    {/* Compatibility Detail Modal */}
    {selectedConnection && (
      <CompatibilityDetailModal
        isOpen={true}
        onClose={() => setSelectedConnection(null)}
        connection={selectedConnection.connection}
        validation={selectedConnection.validation}
        sourceName={selectedConnection.sourceName}
        targetName={selectedConnection.targetName}
      />
    )}
    </>
  );
}

export function FlowDiagram(props: FlowDiagramProps) {
  return (
    <ReactFlowProvider>
      <FlowDiagramInner {...props} />
    </ReactFlowProvider>
  );
}
