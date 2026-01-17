import { useEffect, useState, useCallback } from 'react';
import { useParams, Link, useNavigate, useSearchParams } from 'react-router-dom';
import type {
  App,
  Flow,
  UpdateFlowRequest,
  FlowDeletionCheck,
  NodeInstance,
  Connection,
  NodeType,
  ChatMessage,
  StatCardNodeParameters,
  RegistryNodeParameters,
} from '@chatgpt-app-builder/shared';
import { Hammer, Eye, ScrollText, BarChart3, Edit, Trash2, Share2, Plus } from 'lucide-react';
import { api, ApiClientError } from '../lib/api';
import { Button } from '@/components/ui/shadcn/button';
import { FlowActiveToggle } from '../components/flow/FlowActiveToggle';
import { EditFlowForm } from '../components/flow/EditFlowForm';
import { DeleteConfirmDialog } from '../components/common/DeleteConfirmDialog';
import { FlowDiagram } from '../components/flow/FlowDiagram';
import { NodeEditModal } from '../components/flow/NodeEditModal';
import { NodeLibrary } from '../components/flow/NodeLibrary';
import { FlowValidationSummary } from '../components/flow/FlowValidationSummary';
import { Tabs } from '../components/common/Tabs';
import { ExecutionList } from '../components/execution/ExecutionList';
import { ExecutionDetail } from '../components/execution/ExecutionDetail';
import { ExecutionDetailPlaceholder } from '../components/execution/ExecutionDetailPlaceholder';
import { PreviewChat } from '../components/chat/PreviewChat';
import { InterfaceEditor } from '../components/editor/InterfaceEditor';
import { fetchComponentDetail, transformToNodeParameters, parseAppearanceOptions } from '../services/registry';
import type { FlowDetailTab, TabConfig } from '../types/tabs';
import { ShareModal } from '../components/app/ShareModal';

/**
 * Generate a unique name for a node based on existing nodes.
 * If "Event List" exists, returns "Event List 2", then "Event List 3", etc.
 */
function generateUniqueName(baseName: string, existingNodes: NodeInstance[]): string {
  const existingNames = new Set(existingNodes.map(n => n.name));

  // If base name is available, use it
  if (!existingNames.has(baseName)) {
    return baseName;
  }

  // Find the next available number
  let counter = 2;
  while (existingNames.has(`${baseName} ${counter}`)) {
    counter++;
  }
  return `${baseName} ${counter}`;
}

/**
 * Flow detail/editor page - Shows flow info and React Flow canvas
 * Updated to use new unified node architecture
 */
function FlowDetail() {
  const { appId, flowId } = useParams<{ appId: string; flowId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [app, setApp] = useState<App | null>(null);
  const [flow, setFlow] = useState<Flow | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toggleError, setToggleError] = useState<string | null>(null);

  // Edit flow state
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Delete flow state
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deletionCheck, setDeletionCheck] = useState<FlowDeletionCheck | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isCheckingDeletion, setIsCheckingDeletion] = useState(false);

  // Share modal state
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);

  // Node library state (replaces AddStepModal and floating button)
  const [isNodeLibraryOpen, setIsNodeLibraryOpen] = useState(false);

  // Node edit modal state
  const [showNodeEditModal, setShowNodeEditModal] = useState(false);
  const [nodeToEdit, setNodeToEdit] = useState<NodeInstance | null>(null);
  const [nodeTypeToCreate, setNodeTypeToCreate] = useState<NodeType | null>(null);
  const [registryParamsToCreate, setRegistryParamsToCreate] = useState<RegistryNodeParameters | null>(null);
  const [isSavingNode, setIsSavingNode] = useState(false);
  const [nodeEditError, setNodeEditError] = useState<string | null>(null);

  // Node delete state
  const [nodeToDelete, setNodeToDelete] = useState<NodeInstance | null>(null);
  const [isDeletingNode, setIsDeletingNode] = useState(false);

  // All flows for CallFlow node selection
  const [allFlows, setAllFlows] = useState<Flow[]>([]);

  // Tab state - read initial tab from URL query param (?tab=analytics)
  const initialTab = searchParams.get('tab') as FlowDetailTab | null;
  const [activeTab, setActiveTab] = useState<FlowDetailTab>(
    initialTab && ['build', 'preview', 'logs', 'analytics'].includes(initialTab) ? initialTab : 'build'
  );

  // Flow name lookup for CallFlow nodes
  const [flowNameLookup, setFlowNameLookup] = useState<Record<string, string>>({});

  // Execution tracking state
  const [selectedExecutionId, setSelectedExecutionId] = useState<string | null>(null);

  // Chat preview state (persists across tab switches)
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);

  // Track recently saved node for schema re-validation
  const [savedNodeId, setSavedNodeId] = useState<string | null>(null);

  // Pending connection state - tracks when a node should be connected after creation
  const [pendingConnection, setPendingConnection] = useState<{
    sourceNodeId: string;
    sourceHandle: string;
    sourcePosition: { x: number; y: number };
  } | null>(null);

  // Interface code editor state
  const [editingCodeNodeId, setEditingCodeNodeId] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      if (!appId || !flowId) return;

      setIsLoading(true);
      setError(null);

      try {
        const [loadedApp, loadedFlow] = await Promise.all([
          api.getApp(appId),
          api.getFlow(flowId),
        ]);
        setApp(loadedApp);
        setFlow(loadedFlow);

        // Load all flows for the app to build the flowNameLookup and for CallFlow selection
        const flows = await api.listFlows(appId);
        setAllFlows(flows);
        const lookup: Record<string, string> = {};
        flows.forEach((f: Flow) => {
          lookup[f.id] = f.name;
        });
        setFlowNameLookup(lookup);
      } catch (err) {
        if (err instanceof ApiClientError) {
          setError(err.message);
        } else {
          setError('Failed to load flow');
        }
      } finally {
        setIsLoading(false);
      }
    }

    loadData();
  }, [appId, flowId]);

  const handleToggleActive = async (flowId: string, isActive: boolean) => {
    setToggleError(null);
    try {
      const updatedFlow = await api.updateFlow(flowId, { isActive });
      setFlow(updatedFlow);
    } catch (err) {
      if (err instanceof ApiClientError) {
        setToggleError(err.message);
      } else {
        setToggleError('Failed to update flow status');
      }
      throw err;
    }
  };

  const handleEditFlow = async (data: UpdateFlowRequest) => {
    if (!flowId) return;

    setIsSaving(true);
    setEditError(null);

    try {
      const updatedFlow = await api.updateFlow(flowId, data);
      setFlow(updatedFlow);
      setIsEditing(false);
    } catch (err) {
      if (err instanceof ApiClientError) {
        setEditError(err.message);
      } else {
        setEditError('Failed to update flow');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditError(null);
  };

  const handleDeleteClick = async () => {
    if (!flowId) return;

    setIsCheckingDeletion(true);
    try {
      const check = await api.checkFlowDeletion(flowId);
      setDeletionCheck(check);
      setShowDeleteDialog(true);
    } catch (err) {
      console.error('Failed to check flow deletion:', err);
      setDeletionCheck(null);
      setShowDeleteDialog(true);
    } finally {
      setIsCheckingDeletion(false);
    }
  };

  const handleCloseDeleteDialog = () => {
    if (!isDeleting) {
      setShowDeleteDialog(false);
      setDeletionCheck(null);
    }
  };

  const handleConfirmDeleteFlow = async () => {
    if (!flowId || !appId) return;

    setIsDeleting(true);
    try {
      await api.deleteFlow(flowId);
      navigate(`/app/${appId}`);
    } catch (err) {
      console.error('Failed to delete flow:', err);
      setShowDeleteDialog(false);
    } finally {
      setIsDeleting(false);
    }
  };

  // Node handlers
  const handleNodeEdit = useCallback((node: NodeInstance) => {
    setNodeToEdit(node);
    setNodeTypeToCreate(null);
    setNodeEditError(null);
    setShowNodeEditModal(true);
  }, []);

  const handleNodeDelete = useCallback((node: NodeInstance) => {
    setNodeToDelete(node);
  }, []);

  const handleConfirmDeleteNode = async () => {
    if (!nodeToDelete || !flowId) return;

    setIsDeletingNode(true);
    try {
      await api.deleteNode(flowId, nodeToDelete.id);
      const updatedFlow = await api.getFlow(flowId);
      setFlow(updatedFlow);
      setNodeToDelete(null);
    } catch (err) {
      console.error('Failed to delete node:', err);
    } finally {
      setIsDeletingNode(false);
    }
  };

  const handleConnectionsChange = useCallback((connections: Connection[]) => {
    // Use functional update to avoid depending on flow object (prevents callback instability)
    setFlow(prevFlow => prevFlow ? { ...prevFlow, connections } : null);
  }, []);

  // Handler to refresh flow data (e.g., after transformer insertion)
  const handleFlowUpdate = useCallback(async () => {
    if (!flowId) return;
    try {
      const updatedFlow = await api.getFlow(flowId);
      setFlow(updatedFlow);
    } catch (err) {
      console.error('Failed to refresh flow:', err);
    }
  }, [flowId]);

  const handleAddStep = useCallback(() => {
    // Directly open the UserIntent node creation modal
    // This is called when clicking the "Add user intent" placeholder on the canvas
    setNodeToEdit(null);
    setNodeTypeToCreate('UserIntent');
    setNodeEditError(null);
    setShowNodeEditModal(true);
  }, []);

  const handleNodeLibrarySelect = useCallback(async (nodeType: NodeType) => {
    // For StatCard, PostList, and BlankComponent, skip the modal and create directly with defaults
    if ((nodeType === 'StatCard' || nodeType === 'PostList' || nodeType === 'BlankComponent') && flowId && flow) {
      const nodes = flow.nodes ?? [];
      const position = {
        x: nodes.length * 280 + 330,
        y: 100,
      };
      const displayName = nodeType === 'StatCard' ? 'Stat Card' : nodeType === 'PostList' ? 'Post List' : 'Blank Component';
      try {
        await api.createNode(flowId, {
          type: nodeType,
          name: displayName,
          position,
          parameters: {},
        });
        const updatedFlow = await api.getFlow(flowId);
        setFlow(updatedFlow);
        // Node is added to canvas without opening editor (US3: non-disruptive add)
      } catch (err) {
        console.error(`Failed to create ${nodeType}:`, err);
        setError(`Failed to create ${displayName} node. Please try again.`);
      }
      return;
    }
    // Open the node edit modal in create mode for other node types
    setNodeToEdit(null);
    setNodeTypeToCreate(nodeType);
    setNodeEditError(null);
    setShowNodeEditModal(true);
  }, [flowId, flow]);

  // Handler for "+" button click on nodes - opens node library with pending connection
  const handleAddFromNode = useCallback((sourceNodeId: string, sourceHandle: string, sourcePosition: { x: number; y: number }) => {
    setPendingConnection({ sourceNodeId, sourceHandle, sourcePosition });
    setIsNodeLibraryOpen(true);
  }, []);

  // Handler for node type selection (from "+" button click + library selection)
  const handleNodeLibrarySelectWithConnection = useCallback(async (nodeType: NodeType) => {
    // For StatCard, PostList, and BlankComponent, skip the modal and create directly with defaults
    if ((nodeType === 'StatCard' || nodeType === 'PostList' || nodeType === 'BlankComponent') && flowId && pendingConnection) {
      const position = {
        x: pendingConnection.sourcePosition.x + 280,
        y: pendingConnection.sourcePosition.y,
      };
      const displayName = nodeType === 'StatCard' ? 'Stat Card' : nodeType === 'PostList' ? 'Post List' : 'Blank Component';
      try {
        const newNode = await api.createNode(flowId, {
          type: nodeType,
          name: displayName,
          position,
          parameters: {},
        });
        // Create the connection
        await api.createConnection(flowId, {
          sourceNodeId: pendingConnection.sourceNodeId,
          sourceHandle: pendingConnection.sourceHandle,
          targetNodeId: newNode.id,
          targetHandle: 'input',
        });
        const updatedFlow = await api.getFlow(flowId);
        setFlow(updatedFlow);
        setPendingConnection(null);
        // Node is added to canvas without opening editor (US3: non-disruptive add)
      } catch (err) {
        console.error(`Failed to create ${nodeType}:`, err);
        setError(`Failed to create ${displayName} node. Please try again.`);
      }
      return;
    }
    setNodeToEdit(null);
    setNodeTypeToCreate(nodeType);
    setNodeEditError(null);
    setShowNodeEditModal(true);
    // pendingConnection is kept - it will be used during save
  }, [flowId, pendingConnection]);

  // Handler for dropping node on a "+" button - creates node with connection
  const handleDropOnNode = useCallback(async (nodeType: NodeType, sourceNodeId: string, sourceHandle: string, sourcePosition: { x: number; y: number }) => {
    // For StatCard, PostList, and BlankComponent, skip the modal and create directly with defaults
    if ((nodeType === 'StatCard' || nodeType === 'PostList' || nodeType === 'BlankComponent') && flowId) {
      const position = {
        x: sourcePosition.x + 280,
        y: sourcePosition.y,
      };
      const displayName = nodeType === 'StatCard' ? 'Stat Card' : nodeType === 'PostList' ? 'Post List' : 'Blank Component';
      try {
        const newNode = await api.createNode(flowId, {
          type: nodeType,
          name: displayName,
          position,
          parameters: {},
        });
        // Create the connection
        await api.createConnection(flowId, {
          sourceNodeId,
          sourceHandle,
          targetNodeId: newNode.id,
          targetHandle: 'input',
        });
        const updatedFlow = await api.getFlow(flowId);
        setFlow(updatedFlow);
        // Node is added to canvas without opening editor (US3: non-disruptive add)
      } catch (err) {
        console.error(`Failed to create ${nodeType}:`, err);
        setError(`Failed to create ${displayName} node. Please try again.`);
      }
      return;
    }
    setPendingConnection({ sourceNodeId, sourceHandle, sourcePosition });
    setNodeToEdit(null);
    setNodeTypeToCreate(nodeType);
    setNodeEditError(null);
    setShowNodeEditModal(true);
  }, [flowId]);

  // Handler for dropping node on canvas (no connection)
  // Position is used to place the node at the drop location
  const [dropPosition, setDropPosition] = useState<{ x: number; y: number } | null>(null);

  const handleDropOnCanvas = useCallback(async (nodeType: NodeType, position: { x: number; y: number }) => {
    // For StatCard, PostList, and BlankComponent, skip the modal and create directly with defaults
    if ((nodeType === 'StatCard' || nodeType === 'PostList' || nodeType === 'BlankComponent') && flowId) {
      const displayName = nodeType === 'StatCard' ? 'Stat Card' : nodeType === 'PostList' ? 'Post List' : 'Blank Component';
      try {
        await api.createNode(flowId, {
          type: nodeType,
          name: displayName,
          position,
          parameters: {},
        });
        const updatedFlow = await api.getFlow(flowId);
        setFlow(updatedFlow);
        // Node is added to canvas without opening editor (US3: non-disruptive add)
      } catch (err) {
        console.error(`Failed to create ${nodeType}:`, err);
      }
      return;
    }
    setPendingConnection(null); // No connection for canvas drops
    setDropPosition(position); // Store drop position for node creation
    setNodeToEdit(null);
    setNodeTypeToCreate(nodeType);
    setNodeEditError(null);
    setShowNodeEditModal(true);
  }, [flowId]);

  const handleCloseNodeEditModal = () => {
    if (!isSavingNode) {
      setShowNodeEditModal(false);
      setNodeToEdit(null);
      setNodeTypeToCreate(null);
      setRegistryParamsToCreate(null); // Clear registry params on close
      setNodeEditError(null);
      setPendingConnection(null); // Clear pending connection on close
      setDropPosition(null); // Clear drop position on close
    }
  };

  const handleSaveNode = async (data: { name: string; parameters: Record<string, unknown> }) => {
    if (!flowId || !flow) return;

    setIsSavingNode(true);
    setNodeEditError(null);

    try {
      let savedId: string | null = null;

      if (nodeToEdit) {
        // Edit mode - update existing node
        await api.updateNode(flowId, nodeToEdit.id, {
          name: data.name,
          parameters: data.parameters,
        });
        savedId = nodeToEdit.id;
      } else if (nodeTypeToCreate) {
        // Create mode - create new node
        // Calculate position based on pending connection, drop position, or default
        let position = { x: 100, y: 100 };
        if (pendingConnection) {
          // Position to the right of the source node
          position = {
            x: pendingConnection.sourcePosition.x + 280,
            y: pendingConnection.sourcePosition.y,
          };
        } else if (dropPosition) {
          // Use the drop position from drag-and-drop
          position = dropPosition;
        } else {
          // Default positioning
          const nodes = flow.nodes ?? [];
          position = {
            x: nodes.length * 280 + 330,
            y: 100,
          };
        }

        // For RegistryComponent, merge registry params with form parameters
        const finalParameters = nodeTypeToCreate === 'RegistryComponent' && registryParamsToCreate
          ? { ...registryParamsToCreate, ...data.parameters }
          : data.parameters;

        const newNode = await api.createNode(flowId, {
          type: nodeTypeToCreate,
          name: data.name,
          position,
          parameters: finalParameters,
        });
        savedId = newNode.id;

        // If there's a pending connection, create it
        if (pendingConnection) {
          try {
            await api.createConnection(flowId, {
              sourceNodeId: pendingConnection.sourceNodeId,
              sourceHandle: pendingConnection.sourceHandle,
              targetNodeId: newNode.id,
              targetHandle: 'input',
            });
          } catch (connErr) {
            console.error('Failed to create connection:', connErr);
            // Node was created, connection failed - not blocking
          }
        }
      }

      // Refresh flow data
      const updatedFlow = await api.getFlow(flowId);
      setFlow(updatedFlow);
      setShowNodeEditModal(false);
      setNodeToEdit(null);
      setNodeTypeToCreate(null);
      setRegistryParamsToCreate(null); // Clear registry params after save
      setPendingConnection(null); // Clear pending connection after save
      setDropPosition(null); // Clear drop position after save

      // Trigger re-validation for the saved node
      if (savedId) {
        setSavedNodeId(savedId);
        // Clear after a short delay to allow effect to run
        setTimeout(() => setSavedNodeId(null), 100);
      }
    } catch (err) {
      if (err instanceof ApiClientError) {
        setNodeEditError(err.message);
      } else {
        setNodeEditError('Failed to save node');
      }
    } finally {
      setIsSavingNode(false);
    }
  };

  // Interface node code editor handlers (StatCard, PostList, RegistryComponent, and BlankComponent)
  const handleNodeEditCode = useCallback((node: NodeInstance) => {
    if (node.type === 'StatCard' || node.type === 'PostList' || node.type === 'RegistryComponent' || node.type === 'BlankComponent') {
      setEditingCodeNodeId(node.id);
    }
  }, []);

  // Handler for registry component selection (click) - creates node directly without modal
  const handleSelectRegistryComponent = useCallback(async (params: RegistryNodeParameters) => {
    if (!flowId || !flow) return;

    const nodes = flow.nodes ?? [];
    const baseName = params.title || 'UI Component';
    const uniqueName = generateUniqueName(baseName, nodes);

    // Calculate position - if pending connection, place next to source; otherwise at end
    const position = pendingConnection
      ? { x: pendingConnection.sourcePosition.x + 280, y: pendingConnection.sourcePosition.y }
      : { x: nodes.length * 280 + 330, y: 100 };

    try {
      const newNode = await api.createNode(flowId, {
        type: 'RegistryComponent',
        name: uniqueName,
        position,
        parameters: params as unknown as Record<string, unknown>,
      });

      // If there's a pending connection, create it
      if (pendingConnection) {
        await api.createConnection(flowId, {
          sourceNodeId: pendingConnection.sourceNodeId,
          sourceHandle: pendingConnection.sourceHandle,
          targetNodeId: newNode.id,
          targetHandle: 'input',
        });
        setPendingConnection(null);
      }

      const updatedFlow = await api.getFlow(flowId);
      setFlow(updatedFlow);
    } catch (err) {
      console.error('Failed to create registry component:', err);
      setError(`Failed to create ${baseName}. Please try again.`);
    }
  }, [flowId, flow, pendingConnection]);

  // Handler for registry item drop on canvas - creates node directly without modal
  const handleDropRegistryItem = useCallback(async (registryItemName: string, position: { x: number; y: number }) => {
    if (!flowId || !flow) return;

    try {
      // Fetch component detail
      const detail = await fetchComponentDetail(registryItemName);
      const params = transformToNodeParameters(detail);

      const nodes = flow.nodes ?? [];
      const baseName = params.title || 'UI Component';
      const uniqueName = generateUniqueName(baseName, nodes);

      await api.createNode(flowId, {
        type: 'RegistryComponent',
        name: uniqueName,
        position,
        parameters: params as unknown as Record<string, unknown>,
      });

      const updatedFlow = await api.getFlow(flowId);
      setFlow(updatedFlow);
    } catch (err) {
      console.error('Failed to fetch registry component:', err);
      setError(`Failed to load component "${registryItemName}". Please try again.`);
    }
  }, [flowId, flow]);

  const handleCloseCodeEditor = useCallback(() => {
    setEditingCodeNodeId(null);
  }, []);

  const handleSaveCode = useCallback(async (data: { name: string; code: string; appearanceConfig: Record<string, string | number | boolean> }) => {
    if (!flowId || !editingCodeNodeId) return;

    const nodeToUpdate = (flow?.nodes ?? []).find(n => n.id === editingCodeNodeId);
    if (!nodeToUpdate) return;

    let updatedParameters: Record<string, unknown>;

    if (nodeToUpdate.type === 'RegistryComponent') {
      // For RegistryComponent, update the code in files[0].content
      const existingParams = nodeToUpdate.parameters as unknown as RegistryNodeParameters;
      const updatedFiles = existingParams?.files ? [...existingParams.files] : [];
      if (updatedFiles.length > 0) {
        updatedFiles[0] = { ...updatedFiles[0], content: data.code };
      }
      updatedParameters = {
        ...nodeToUpdate.parameters,
        files: updatedFiles,
        appearanceConfig: data.appearanceConfig,
      };
    } else {
      // For StatCard/PostList/BlankComponent, use customCode
      updatedParameters = {
        ...nodeToUpdate.parameters,
        customCode: data.code,
        appearanceConfig: data.appearanceConfig,
      };
    }

    await api.updateNode(flowId, editingCodeNodeId, {
      name: data.name,
      parameters: updatedParameters,
    });

    // Refresh flow data
    const updatedFlow = await api.getFlow(flowId);
    setFlow(updatedFlow);
  }, [flowId, editingCodeNodeId, flow?.nodes]);

  // Get the node being edited for code (if any)
  const editingCodeNode = editingCodeNodeId
    ? (flow?.nodes ?? []).find(n => n.id === editingCodeNodeId)
    : null;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="text-destructive">{error}</div>
          <Link to={`/app/${appId}`} className="text-primary hover:underline">
            Go back to app
          </Link>
        </div>
      </div>
    );
  }

  if (!app || !flow) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="text-muted-foreground">Flow not found</div>
          <Link to={`/app/${appId}`} className="text-primary hover:underline">
            Go back to app
          </Link>
        </div>
      </div>
    );
  }

  const nodes = flow.nodes ?? [];
  const canDeleteNodes = nodes.length > 0;

  const tabs: TabConfig[] = [
    { id: 'build', label: 'Build', icon: Hammer },
    { id: 'preview', label: 'Preview', icon: Eye, disabled: nodes.length === 0 },
    { id: 'logs', label: 'Logs', icon: ScrollText },
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
  ];

  return (
    <div className="h-screen bg-background flex flex-col overflow-hidden">
      {/* Flow Info Sub-header */}
      <div className="border-b bg-card">
        <div className="px-6 py-4">
          {isEditing ? (
            <div className="max-w-4xl mx-auto">
              <Button
                variant="link"
                onClick={() => navigate(`/app/${appId}`)}
                className="p-0 h-auto text-muted-foreground hover:text-foreground"
              >
                ← Back to App
              </Button>
              <h1 className="text-2xl font-bold mt-1 mb-4">{flow.name}</h1>
              <EditFlowForm
                flow={flow}
                onSave={handleEditFlow}
                onCancel={handleCancelEdit}
                isLoading={isSaving}
                error={editError}
              />
            </div>
          ) : (
            <div className="flex items-start justify-between gap-8">
              <div className="flex-1">
                <Button
                  variant="link"
                  onClick={() => navigate(`/app/${appId}`)}
                  className="p-0 h-auto text-muted-foreground hover:text-foreground"
                >
                  ← Back to App
                </Button>
                <h1 className="text-2xl font-bold mt-1">{flow.name}</h1>
                {flow.description && <p className="text-muted-foreground mt-1">{flow.description}</p>}
              </div>
              <div className="flex items-center gap-6">
                {(() => {
                  const triggerNodes = (flow.nodes ?? []).filter(n => n.type === 'UserIntent');
                  const hasTriggers = triggerNodes.length > 0;
                  // Extract tool names from trigger nodes
                  const toolNames = triggerNodes
                    .map(n => {
                      const params = n.parameters as unknown as { toolName?: string; isActive?: boolean } | undefined;
                      return params?.isActive !== false ? params?.toolName : null;
                    })
                    .filter((name): name is string => !!name);

                  return hasTriggers ? (
                    <div className="text-right max-w-[200px]">
                      <p className="text-xs text-muted-foreground">MCP Tools</p>
                      {toolNames.length > 0 ? (
                        <code className="text-xs font-mono text-gray-600 truncate block" title={toolNames.join(', ')}>
                          {toolNames.length <= 2 ? toolNames.join(', ') : `${toolNames.slice(0, 2).join(', ')}...`}
                        </code>
                      ) : (
                        <span className="text-sm font-medium">{triggerNodes.length} trigger{triggerNodes.length !== 1 ? 's' : ''}</span>
                      )}
                    </div>
                  ) : (
                    <div className="text-right flex items-center gap-2 text-amber-600" title="No triggers configured - this flow won't be exposed as MCP tools">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                        <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                      </svg>
                      <span className="text-sm">No triggers</span>
                    </div>
                  );
                })()}
                <FlowActiveToggle flowId={flow.id} isActive={flow.isActive} onToggle={handleToggleActive} />
                <div className="flex items-center gap-2 border-l pl-4">
                  {app?.status === 'published' && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setIsShareModalOpen(true)}
                      title="Share app"
                    >
                      <Share2 className="w-4 h-4" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setIsEditing(true)}
                    title="Edit flow"
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleDeleteClick}
                    disabled={isCheckingDeletion}
                    className="hover:text-destructive hover:bg-destructive/10"
                    title="Delete flow"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}
          {toggleError && (
            <div className="mt-4 bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm">
              {toggleError}
              <Button variant="link" onClick={() => setToggleError(null)} className="ml-2 p-0 h-auto text-red-700">
                Dismiss
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Tabs and Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <div className="px-6 bg-white flex justify-center border-b">
          <Tabs activeTab={activeTab} onTabChange={setActiveTab} tabs={tabs} />
        </div>

        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Build Tab - React Flow Canvas with Node Library */}
          {activeTab === 'build' && (
            <div className="flex-1 flex relative">
              {/* Node Library Sidedrawer */}
              <NodeLibrary
                isOpen={isNodeLibraryOpen}
                onToggle={() => setIsNodeLibraryOpen(!isNodeLibraryOpen)}
                onClose={() => {
                  setIsNodeLibraryOpen(false);
                  setPendingConnection(null); // Clear pending connection when library closes
                }}
                onSelectNode={pendingConnection ? handleNodeLibrarySelectWithConnection : handleNodeLibrarySelect}
                onSelectRegistryComponent={handleSelectRegistryComponent}
              />
              {/* Canvas */}
              <div className="flex-1 relative">
                <FlowDiagram
                  flow={flow}
                  onNodeEdit={handleNodeEdit}
                  onNodeDelete={handleNodeDelete}
                  onAddStep={handleAddStep}
                  canDelete={canDeleteNodes}
                  onConnectionsChange={handleConnectionsChange}
                  flowNameLookup={flowNameLookup}
                  savedNodeId={savedNodeId}
                  onAddFromNode={handleAddFromNode}
                  onDropOnNode={handleDropOnNode}
                  onDropOnCanvas={handleDropOnCanvas}
                  onDropRegistryItem={handleDropRegistryItem}
                  onNodeEditCode={handleNodeEditCode}
                  onFlowUpdate={handleFlowUpdate}
                  onPaneClick={() => setIsNodeLibraryOpen(false)}
                />
                {/* Add Node Button - top right of canvas */}
                {!isNodeLibraryOpen && (
                  <button
                    onClick={() => setIsNodeLibraryOpen(true)}
                    className="absolute top-4 right-4 z-10 w-10 h-10 bg-primary text-primary-foreground rounded-lg shadow-md hover:bg-primary/90 flex items-center justify-center transition-colors"
                    title="Add node"
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                )}
                {/* Flow Validation Summary - positioned at bottom-right of canvas */}
                {flowId && (
                  <div className="absolute bottom-4 right-4 w-80 z-10">
                    <FlowValidationSummary
                      flowId={flowId}
                      nodeNames={new Map(nodes.map(n => [n.id, n.name]))}
                    />
                  </div>
                )}
              </div>

              {/* UI Node Editor - covers canvas and node library */}
              {editingCodeNode && flowId && (() => {
                const params = editingCodeNode.parameters as unknown as StatCardNodeParameters;

                // For RegistryComponent, get code from files[0].content and pass all files
                // For BlankComponent/StatCard/PostList, use customCode
                let initialCode: string | undefined;
                let componentType: string = editingCodeNode.type;
                let appearanceOptions: RegistryNodeParameters['appearanceOptions'] = undefined;
                let files: Array<{ path: string; content: string }> | undefined;

                if (editingCodeNode.type === 'RegistryComponent') {
                  const registryParams = editingCodeNode.parameters as unknown as RegistryNodeParameters;
                  initialCode = registryParams?.files?.[0]?.content;
                  files = registryParams?.files;
                  // Use the registry component name for appearance lookup (e.g., 'TicketTierSelect')
                  componentType = registryParams?.registryName ?? editingCodeNode.type;
                  // Get appearance options from registry params if available,
                  // otherwise parse from the stored component code (for existing nodes)
                  appearanceOptions = registryParams?.appearanceOptions;
                  if (!appearanceOptions && initialCode) {
                    const parsedOptions = parseAppearanceOptions(initialCode);
                    if (parsedOptions.length > 0) {
                      appearanceOptions = parsedOptions;
                    }
                  }
                } else if (editingCodeNode.type === 'BlankComponent') {
                  // BlankComponent uses customCode, with auto-parsing for appearance options
                  initialCode = params.customCode;
                  componentType = 'BlankComponent';
                  if (initialCode) {
                    const parsedOptions = parseAppearanceOptions(initialCode);
                    if (parsedOptions.length > 0) {
                      appearanceOptions = parsedOptions;
                    }
                  }
                } else {
                  initialCode = params.customCode;
                }

                return (
                  <InterfaceEditor
                    flowId={flowId}
                    nodeId={editingCodeNode.id}
                    nodeName={editingCodeNode.name}
                    componentType={componentType}
                    initialCode={initialCode}
                    initialAppearanceConfig={params.appearanceConfig}
                    appearanceOptions={appearanceOptions}
                    files={files}
                    themeVariables={app?.themeVariables}
                    onClose={handleCloseCodeEditor}
                    onSave={handleSaveCode}
                  />
                );
              })()}
            </div>
          )}

          {/* Preview Tab - Chat with LLM */}
          {activeTab === 'preview' && flowId && (
            <div className="flex-1 overflow-hidden">
              <PreviewChat
                flowId={flowId}
                messages={chatMessages}
                onMessagesChange={setChatMessages}
                themeVariables={app?.themeVariables}
              />
            </div>
          )}

          {/* Logs Tab - Two column layout */}
          {activeTab === 'logs' && flowId && (
            <div className="flex-1 flex overflow-hidden">
              {/* Left panel - Execution list */}
              <div className="w-1/3 border-r border-gray-200 flex flex-col overflow-hidden">
                <ExecutionList
                  flowId={flowId}
                  selectedId={selectedExecutionId}
                  onSelect={setSelectedExecutionId}
                />
              </div>
              {/* Right panel - Execution details */}
              <div className="flex-1 bg-white overflow-hidden">
                {selectedExecutionId ? (
                  <ExecutionDetail flowId={flowId} executionId={selectedExecutionId} />
                ) : (
                  <ExecutionDetailPlaceholder />
                )}
              </div>
            </div>
          )}

          {/* Analytics Tab - Coming Soon */}
          {activeTab === 'analytics' && (
            <div className="flex-1 flex items-center justify-center bg-gray-50">
              <div className="text-center">
                <BarChart3 className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-700 mb-2">Analytics Coming Soon</h3>
                <p className="text-gray-500 max-w-md">
                  Track product usage metrics, user engagement, and flow performance insights.
                </p>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Delete Flow Confirmation */}
      <DeleteConfirmDialog
        isOpen={showDeleteDialog}
        onClose={handleCloseDeleteDialog}
        onConfirm={handleConfirmDeleteFlow}
        title="Delete Flow"
        message={`Are you sure you want to delete "${flow?.name}"? This action cannot be undone.`}
        warningMessage={deletionCheck?.warningMessage}
        isLoading={isDeleting}
      />

      {/* Delete Node Confirmation */}
      <DeleteConfirmDialog
        isOpen={!!nodeToDelete}
        onClose={() => !isDeletingNode && setNodeToDelete(null)}
        onConfirm={handleConfirmDeleteNode}
        title="Delete Node"
        message={`Are you sure you want to delete "${nodeToDelete?.name}"? This will also remove any connections to this node.`}
        isLoading={isDeletingNode}
      />

      {/* Share App Modal */}
      {app && (
        <ShareModal
          isOpen={isShareModalOpen}
          onClose={() => setIsShareModalOpen(false)}
          appSlug={app.slug}
        />
      )}

      {/* Node Edit Modal */}
      <NodeEditModal
        isOpen={showNodeEditModal}
        onClose={handleCloseNodeEditModal}
        onSave={handleSaveNode}
        node={nodeToEdit}
        nodeType={nodeTypeToCreate}
        flows={allFlows}
        currentFlowId={flowId || ''}
        isLoading={isSavingNode}
        error={nodeEditError}
        registryComponentTitle={
          registryParamsToCreate?.title ||
          (nodeToEdit?.type === 'RegistryComponent'
            ? (nodeToEdit.parameters as unknown as RegistryNodeParameters)?.title
            : undefined)
        }
      />
    </div>
  );
}

export default FlowDetail;
