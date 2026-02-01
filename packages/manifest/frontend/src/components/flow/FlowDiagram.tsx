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
  type OnConnectEnd,
  applyNodeChanges,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  STATUS_COLORS,
  type Flow,
  type NodeInstance,
  type Connection,
  type CreateConnectionRequest,
  type NodeType,
} from '@manifest/shared';
import { X, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/shadcn/button';
import { api } from '../../lib/api';
import { ViewNode } from './ViewNode';
import { UserIntentNode } from './UserIntentNode';
import { AddUserIntentNode } from './AddUserIntentNode';
import { ReturnValueNode } from './ReturnValueNode';
import { CallFlowNode } from './CallFlowNode';
import { ApiCallNode } from './ApiCallNode';
import { TransformNode } from './TransformNode';
import { LinkNode } from './LinkNode';
import { RegistryComponentNode } from './RegistryComponentNode';
import { BlankComponentNode } from './BlankComponentNode';
import { DeletableEdge } from './DeletableEdge';
import { CompatibilityDetailModal } from './CompatibilityDetailModal';
import { useSchemaValidation } from '../../hooks/useSchemaValidation';
import type { ConnectionValidationState } from '../../types/schema';

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
  /** Handler for "+" button click on nodes - opens node library with pending connection */
  onAddFromNode?: (sourceNodeId: string, sourceHandle: string, sourcePosition: { x: number; y: number }) => void;
  /** Handler for dropping node type on a "+" button */
  onDropOnNode?: (nodeType: NodeType, sourceNodeId: string, sourceHandle: string, sourcePosition: { x: number; y: number }) => void;
  /** Handler for dropping node type on canvas */
  onDropOnCanvas?: (nodeType: NodeType, position: { x: number; y: number }) => void;
  /** Handler for dropping registry item on canvas */
  onDropRegistryItem?: (registryItemName: string, position: { x: number; y: number }) => void;
  /** Callback when user wants to edit Interface node code */
  onNodeEditCode?: (node: NodeInstance) => void;
  /** Callback when flow data needs to be refreshed (e.g., after transformer insertion) */
  onFlowUpdate?: () => void;
  /** Callback when clicking on empty canvas area */
  onPaneClick?: () => void;
}

/**
 * Determines the current state of a flow based on its data
 */
function getFlowState(flow: Flow) {
  const nodes = flow.nodes ?? [];
  const userIntentNodes = nodes.filter(n => n.type === 'UserIntent');
  const registryComponentNodes = nodes.filter(n => n.type === 'RegistryComponent');
  const blankComponentNodes = nodes.filter(n => n.type === 'BlankComponent');
  const returnNodes = nodes.filter(n => n.type === 'Return');
  const callFlowNodes = nodes.filter(n => n.type === 'CallFlow');
  const apiCallNodes = nodes.filter(n => n.type === 'ApiCall');
  const transformNodes = nodes.filter(n => n.type === 'JavaScriptCodeTransform');
  const linkNodes = nodes.filter(n => n.type === 'Link');
  const hasUserIntentNodes = userIntentNodes.length > 0;
  const hasRegistryComponentNodes = registryComponentNodes.length > 0;
  const hasBlankComponentNodes = blankComponentNodes.length > 0;
  const hasReturnNodes = returnNodes.length > 0;
  const hasCallFlowNodes = callFlowNodes.length > 0;
  const hasApiCallNodes = apiCallNodes.length > 0;
  const hasTransformNodes = transformNodes.length > 0;
  const hasLinkNodes = linkNodes.length > 0;
  const hasSteps = hasRegistryComponentNodes || hasBlankComponentNodes || hasReturnNodes || hasCallFlowNodes || hasApiCallNodes || hasTransformNodes || hasLinkNodes;
  return { hasUserIntentNodes, hasRegistryComponentNodes, hasBlankComponentNodes, hasReturnNodes, hasCallFlowNodes, hasApiCallNodes, hasTransformNodes, hasLinkNodes, hasSteps, userIntentNodes, registryComponentNodes, blankComponentNodes, returnNodes, callFlowNodes, apiCallNodes, transformNodes, linkNodes };
}

const nodeTypes = {
  viewNode: ViewNode,
  userIntentNode: UserIntentNode,
  addUserIntentNode: AddUserIntentNode,
  returnValueNode: ReturnValueNode,
  callFlowNode: CallFlowNode,
  apiCallNode: ApiCallNode,
  transformNode: TransformNode,
  linkNode: LinkNode,
  registryComponentNode: RegistryComponentNode,
  blankComponentNode: BlankComponentNode,
};

const edgeTypes = {
  deletable: DeletableEdge,
};

// Node types that belong to the 'interface' category (UI nodes)
// Defined outside component for stable reference in dependency arrays
const INTERFACE_NODE_TYPES: NodeType[] = ['RegistryComponent', 'BlankComponent'];

/**
 * Visual diagram of nodes using React Flow
 * Displays UserIntent trigger nodes followed by UI components, Return, CallFlow, or ApiCall nodes
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
  onAddFromNode,
  onDropOnNode,
  onDropOnCanvas,
  onDropRegistryItem,
  onNodeEditCode,
  onFlowUpdate,
  onPaneClick,
}: FlowDiagramProps) {
  // Memoize flow state to prevent recalculation on every render
  // eslint-disable-next-line react-hooks/exhaustive-deps -- Intentionally depend only on flow.nodes to avoid recalculation when other flow properties change
  const flowState = useMemo(() => getFlowState(flow), [flow.nodes]);

  // Create a stable node lookup map (used by callbacks and edge generation)
  const nodeMap = useMemo(() => {
    const map = new Map<string, NodeInstance>();
    (flow.nodes ?? []).forEach(n => map.set(n.id, n));
    return map;
  }, [flow.nodes]);

  // Memoize connections array
  const connections = useMemo(() => flow.connections ?? [], [flow.connections]);

  // Track which nodes have outgoing connections (for hiding "+" button)
  const nodesWithOutgoingConnections = useMemo(() => {
    const nodeIds = new Set<string>();
    connections.forEach(conn => {
      nodeIds.add(conn.sourceNodeId);
    });
    return nodeIds;
  }, [connections]);

  // Track which nodes have incoming connections (for transform node validation)
  const nodesWithIncomingConnections = useMemo(() => {
    const set = new Set<string>();
    connections.forEach(c => set.add(c.targetNodeId));
    return set;
  }, [connections]);

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

  // State for Link node connection error dialog
  const [showLinkConnectionError, setShowLinkConnectionError] = useState(false);
  // Ref to track if last rejected connection was due to Link node constraint
  const linkConnectionRejectedRef = useRef(false);

  // Handle Escape key for Link connection error dialog
  useEffect(() => {
    if (!showLinkConnectionError) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowLinkConnectionError(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [showLinkConnectionError]);

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
  const { fitView, screenToFlowPosition } = useReactFlow();

  // Handle drag over for canvas drops
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const hasNodeType = e.dataTransfer.types.includes('application/x-node-type');
    const hasRegistryItem = e.dataTransfer.types.includes('application/x-registry-item');
    if (hasNodeType || hasRegistryItem) {
      e.dataTransfer.dropEffect = 'copy';
    }
  }, []);

  // Handle drop on canvas
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();

    // Convert screen coordinates to flow coordinates
    const position = screenToFlowPosition({
      x: e.clientX,
      y: e.clientY,
    });

    // Check for registry item first
    const registryItemName = e.dataTransfer.getData('application/x-registry-item');
    if (registryItemName && onDropRegistryItem) {
      onDropRegistryItem(registryItemName, position);
      return;
    }

    // Then check for regular node type
    const nodeType = e.dataTransfer.getData('application/x-node-type') as NodeType;
    if (nodeType && onDropOnCanvas) {
      onDropOnCanvas(nodeType, position);
    }
  }, [onDropOnCanvas, onDropRegistryItem, screenToFlowPosition]);

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
    // Reset the Link rejection ref at the start of each validation
    linkConnectionRejectedRef.current = false;

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

    // Link nodes can only receive connections from interface (UI) nodes
    const targetNode = nodeMap.get(targetId);
    const sourceNode = nodeMap.get(sourceId);
    if (targetNode?.type === 'Link') {
      if (!sourceNode || !INTERFACE_NODE_TYPES.includes(sourceNode.type)) {
        // Mark that this rejection was due to Link node constraint
        linkConnectionRejectedRef.current = true;
        return false;
      }
    }

    // Prevent circular connections
    if (wouldCreateCycle(sourceId, targetId)) return false;

    return true;
  }, [wouldCreateCycle, flowState.userIntentNodes, nodeMap]);

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

  // Handle connection end - show dialog if Link node connection was rejected
  const onConnectEnd: OnConnectEnd = useCallback(() => {
    if (linkConnectionRejectedRef.current) {
      setShowLinkConnectionError(true);
      linkConnectionRejectedRef.current = false;
    }
  }, []);

  // Generate base nodes: UserIntent nodes + UI/Return/CallFlow/ApiCall nodes
  const computedNodes = useMemo<Node[]>(() => {
    const nodeList: Node[] = [];

    // Track horizontal position for nodes without saved positions
    let xPosition = 50;

    // Show AddUserIntentNode placeholder if no UserIntent nodes exist
    if (!flowState.hasUserIntentNodes) {
      // Centered placeholder for adding user intent (only if no other nodes exist)
      if (!flowState.hasSteps) {
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
      }
    } else {
      // Add UserIntent nodes (trigger nodes)
      flowState.userIntentNodes.forEach((node) => {
        const nodePos = node.position || { x: xPosition, y: 80 };
        const hasOutgoingConnections = nodesWithOutgoingConnections.has(node.id);
        nodeList.push({
          id: node.id,
          type: 'userIntentNode',
          position: nodePos,
          data: {
            node,
            canDelete,
            onEdit: () => onNodeEdit(node),
            onDelete: () => onNodeDelete(node),
            onAddFromNode: !hasOutgoingConnections && onAddFromNode ? () => onAddFromNode(node.id, 'main', nodePos) : undefined,
            onDropOnNode: !hasOutgoingConnections && onDropOnNode ? (nodeType: NodeType) => onDropOnNode(nodeType, node.id, 'main', nodePos) : undefined,
          },
        });

        xPosition = Math.max(xPosition, nodePos.x) + 280;
      });
    }

    // Always render UI and other nodes (regardless of whether triggers exist)
    // Add RegistryComponent nodes (dynamic UI components from registry)
    flowState.registryComponentNodes.forEach((node) => {
      const nodePos = node.position || { x: xPosition, y: 130 };

      nodeList.push({
        id: node.id,
        type: 'registryComponentNode',
        position: nodePos,
        data: {
          node,
          canDelete,
          onEdit: () => onNodeEdit(node),
          onDelete: () => onNodeDelete(node),
          onEditCode: onNodeEditCode ? () => onNodeEditCode(node) : undefined,
        },
      });

      xPosition = Math.max(xPosition, nodePos.x) + 280;
    });

    // Add BlankComponent nodes (custom UI components with 4-argument pattern)
    flowState.blankComponentNodes.forEach((node) => {
      const nodePos = node.position || { x: xPosition, y: 130 };

      nodeList.push({
        id: node.id,
        type: 'blankComponentNode',
        position: nodePos,
        data: {
          node,
          canDelete,
          onEdit: () => onNodeEdit(node),
          onDelete: () => onNodeDelete(node),
          onEditCode: onNodeEditCode ? () => onNodeEditCode(node) : undefined,
        },
      });

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
      const hasOutgoingConnections = nodesWithOutgoingConnections.has(node.id);

      nodeList.push({
        id: node.id,
        type: 'apiCallNode',
        position: nodePos,
        data: {
          node,
          canDelete,
          onEdit: () => onNodeEdit(node),
          onDelete: () => onNodeDelete(node),
          onAddFromNode: !hasOutgoingConnections && onAddFromNode ? () => onAddFromNode(node.id, 'output', nodePos) : undefined,
          onDropOnNode: !hasOutgoingConnections && onDropOnNode ? (nodeType: NodeType) => onDropOnNode(nodeType, node.id, 'output', nodePos) : undefined,
        },
      });

      xPosition = Math.max(xPosition, nodePos.x) + 250;
    });

    // Add Transform nodes (JavaScriptCodeTransform)
    flowState.transformNodes.forEach((node) => {
      const nodePos = node.position || { x: xPosition, y: 80 };
      // Check if transform node has an input connection
      const hasInputConnection = nodesWithIncomingConnections.has(node.id);
      const validationError = hasInputConnection ? undefined : 'Transform node requires an input connection';

      nodeList.push({
        id: node.id,
        type: 'transformNode',
        position: nodePos,
        data: {
          node,
          canDelete,
          onEdit: () => onNodeEdit(node),
          onDelete: () => onNodeDelete(node),
          validationError,
        },
      });

      xPosition = Math.max(xPosition, nodePos.x) + 150; // Smaller spacing for transform nodes
    });

    // Add Link nodes
    flowState.linkNodes.forEach((node) => {
      const nodePos = node.position || { x: xPosition, y: 80 };
      nodeList.push({
        id: node.id,
        type: 'linkNode',
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

    return nodeList;
  // Use specific dependencies instead of entire flow object to prevent unnecessary recalculations
  // onAddStep is used for AddUserIntentNode placeholder when no triggers exist
  // nodesWithIncomingConnections is used for transform node validation
  }, [flowState, canDelete, dimensions.width, dimensions.height, onNodeEdit, onNodeDelete, onAddStep, flowNameLookup, onAddFromNode, onDropOnNode, nodesWithOutgoingConnections, nodesWithIncomingConnections, onNodeEditCode]);

  // State for draggable nodes - initialized from computedNodes and updated on drag
  const [nodes, setNodes] = useState<Node[]>(computedNodes);

  // Track if user is currently dragging to avoid sync interference
  const isDraggingRef = useRef(false);

  // Sync nodes state when computed nodes change (e.g., new node added, flow data changed)
  // Skip sync during drag to prevent jerky movement
  useEffect(() => {
    if (!isDraggingRef.current) {
      setNodes(computedNodes);
    }
  }, [computedNodes]);

  // Handle node changes (position updates during drag)
  const onNodesChange = useCallback((changes: NodeChange[]) => {
    setNodes((nds) => applyNodeChanges(changes, nds));
  }, []);

  // Track drag start
  const onNodeDragStart = useCallback(() => {
    isDraggingRef.current = true;
  }, []);

  // Persist node position when drag ends
  const onNodeDragStop = useCallback(async (_event: React.MouseEvent, node: Node) => {
    isDraggingRef.current = false;
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

    // Show user-created connections from flow.connections
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
        } else if (sourceNode.type === 'RegistryComponent' || sourceNode.type === 'BlankComponent') {
          strokeColor = '#60a5fa'; // Blue for interface
        } else if (sourceNode.type === 'Return') {
          strokeColor = '#22c55e'; // Green for return
        } else if (sourceNode.type === 'CallFlow') {
          strokeColor = '#a855f7'; // Purple for call flow
        } else if (sourceNode.type === 'ApiCall') {
          strokeColor = '#f97316'; // Orange for API call
        } else if (sourceNode.type === 'JavaScriptCodeTransform') {
          strokeColor = '#14b8a6'; // Teal for transform
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
  }, [flow.id, nodeMap, connections, handleConnectionDelete, getValidationByConnection, handleShowConnectionDetails]);

  return (
    <>
    <div
      ref={containerRef}
      className="w-full h-full bg-muted/30"
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {dimensions.width > 0 && dimensions.height > 0 && (
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onNodesChange={onNodesChange}
          onNodeDragStart={onNodeDragStart}
          onNodeDragStop={onNodeDragStop}
          onNodeClick={onNodeClick}
          onConnect={onConnect}
          onConnectEnd={onConnectEnd}
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
          onPaneClick={onPaneClick}
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
        flowId={flow.id}
        onTransformerInserted={() => {
          // Close the modal and trigger a refresh of the flow data
          setSelectedConnection(null);
          // Notify parent to refresh flow data so transformer appears immediately
          onFlowUpdate?.();
        }}
      />
    )}

    {/* Link Node Connection Error Dialog */}
    {showLinkConnectionError && (
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <div
          className="absolute inset-0 bg-black/50"
          onClick={() => setShowLinkConnectionError(false)}
          aria-hidden="true"
        />
        <div className="relative bg-white rounded-lg shadow-xl w-full max-w-md overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b bg-gray-50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
              </div>
              <h2 className="text-lg font-semibold text-gray-900">Connection Not Allowed</h2>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowLinkConnectionError(false)}
              aria-label="Close dialog"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>
          <div className="p-6">
            <p className="text-gray-700 mb-4">
              The <strong>Link</strong> node can only be connected after <strong>UI nodes</strong>.
            </p>
            <p className="text-sm text-gray-500">
              Link nodes open external URLs and are designed to work with user interface components that display information before redirecting the user.
            </p>
          </div>
          <div className="px-6 py-4 border-t bg-gray-50 flex justify-end">
            <Button
              onClick={() => setShowLinkConnectionError(false)}
            >
              Got it
            </Button>
          </div>
        </div>
      </div>
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
