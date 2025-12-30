import { useEffect, useState, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import type {
  App,
  Flow,
  UpdateFlowRequest,
  FlowDeletionCheck,
  NodeInstance,
  Connection,
  NodeType,
} from '@chatgpt-app-builder/shared';
import { Hammer, Eye, BarChart3, Plus, Edit, Trash2 } from 'lucide-react';
import { api, ApiClientError } from '../lib/api';
import { FlowActiveToggle } from '../components/flow/FlowActiveToggle';
import { EditFlowForm } from '../components/flow/EditFlowForm';
import { DeleteConfirmDialog } from '../components/common/DeleteConfirmDialog';
import { UserIntentModal } from '../components/flow/UserIntentModal';
import { FlowDiagram } from '../components/flow/FlowDiagram';
import { AddStepModal } from '../components/flow/AddStepModal';
import { NodeEditModal } from '../components/flow/NodeEditModal';
import { Tabs } from '../components/common/Tabs';
import type { FlowDetailTab, TabConfig } from '../types/tabs';

/**
 * Flow detail/editor page - Shows flow info and React Flow canvas
 * Updated to use new unified node architecture
 */
function FlowDetail() {
  const { appId, flowId } = useParams<{ appId: string; flowId: string }>();
  const navigate = useNavigate();
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

  // User intent modal state
  const [showUserIntentModal, setShowUserIntentModal] = useState(false);
  const [isSavingUserIntent, setIsSavingUserIntent] = useState(false);
  const [userIntentError, setUserIntentError] = useState<string | null>(null);

  // Add step modal state
  const [showAddStepModal, setShowAddStepModal] = useState(false);

  // Node edit modal state
  const [showNodeEditModal, setShowNodeEditModal] = useState(false);
  const [nodeToEdit, setNodeToEdit] = useState<NodeInstance | null>(null);
  const [nodeTypeToCreate, setNodeTypeToCreate] = useState<NodeType | null>(null);
  const [isSavingNode, setIsSavingNode] = useState(false);
  const [nodeEditError, setNodeEditError] = useState<string | null>(null);

  // Node delete state
  const [nodeToDelete, setNodeToDelete] = useState<NodeInstance | null>(null);
  const [isDeletingNode, setIsDeletingNode] = useState(false);

  // All flows for CallFlow node selection
  const [allFlows, setAllFlows] = useState<Flow[]>([]);

  // Tab state
  const [activeTab, setActiveTab] = useState<FlowDetailTab>('build');

  // Flow name lookup for CallFlow nodes
  const [flowNameLookup, setFlowNameLookup] = useState<Record<string, string>>({});

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

  const handleUserIntentEdit = () => {
    setShowUserIntentModal(true);
    setUserIntentError(null);
  };

  const handleCloseUserIntentModal = () => {
    if (!isSavingUserIntent) {
      setShowUserIntentModal(false);
      setUserIntentError(null);
    }
  };

  const handleSaveUserIntent = async (data: {
    toolDescription: string;
    whenToUse: string;
    whenNotToUse: string;
  }) => {
    if (!flowId) return;

    setIsSavingUserIntent(true);
    setUserIntentError(null);

    try {
      const updatedFlow = await api.updateFlow(flowId, data);
      setFlow(updatedFlow);
      setShowUserIntentModal(false);
    } catch (err) {
      if (err instanceof ApiClientError) {
        setUserIntentError(err.message);
      } else {
        setUserIntentError('Failed to save user intent');
      }
    } finally {
      setIsSavingUserIntent(false);
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

  const handleMockDataEdit = useCallback((node: NodeInstance) => {
    // Open the node edit modal for the Interface node
    // Mock data is part of the Interface node's parameters
    setNodeToEdit(node);
    setNodeTypeToCreate(null);
    setNodeEditError(null);
    setShowNodeEditModal(true);
  }, []);

  const handleConnectionsChange = useCallback((connections: Connection[]) => {
    if (!flow) return;
    setFlow({ ...flow, connections });
  }, [flow]);

  const handleAddStep = useCallback(() => {
    setShowAddStepModal(true);
  }, []);

  const handleAddStepSelect = (stepType: 'Interface' | 'Return' | 'CallFlow') => {
    // Close the add step modal and open the node edit modal in create mode
    setShowAddStepModal(false);
    setNodeToEdit(null);
    setNodeTypeToCreate(stepType);
    setNodeEditError(null);
    setShowNodeEditModal(true);
  };

  const handleCloseNodeEditModal = () => {
    if (!isSavingNode) {
      setShowNodeEditModal(false);
      setNodeToEdit(null);
      setNodeTypeToCreate(null);
      setNodeEditError(null);
    }
  };

  const handleSaveNode = async (data: { name: string; parameters: Record<string, unknown> }) => {
    if (!flowId || !flow) return;

    setIsSavingNode(true);
    setNodeEditError(null);

    try {
      if (nodeToEdit) {
        // Edit mode - update existing node
        await api.updateNode(flowId, nodeToEdit.id, {
          name: data.name,
          parameters: data.parameters,
        });
      } else if (nodeTypeToCreate) {
        // Create mode - create new node
        const nodes = flow.nodes ?? [];
        const xOffset = nodes.length * 280 + 330;

        await api.createNode(flowId, {
          type: nodeTypeToCreate,
          name: data.name,
          position: { x: xOffset, y: 100 },
          parameters: data.parameters,
        });
      }

      // Refresh flow data
      const updatedFlow = await api.getFlow(flowId);
      setFlow(updatedFlow);
      setShowNodeEditModal(false);
      setNodeToEdit(null);
      setNodeTypeToCreate(null);
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
  const interfaceNodes = nodes.filter(n => n.type === 'Interface');
  const canDeleteNodes = nodes.length > 0;

  const tabs: TabConfig[] = [
    { id: 'build', label: 'Build', icon: Hammer },
    { id: 'preview', label: 'Preview', icon: Eye, disabled: interfaceNodes.length === 0 },
    { id: 'usage', label: 'Usage', icon: BarChart3 },
  ];

  return (
    <div className="h-screen bg-background flex flex-col overflow-hidden">
      {/* Flow Info Sub-header */}
      <div className="border-b bg-card">
        <div className="px-6 py-4">
          {isEditing ? (
            <div className="max-w-4xl mx-auto">
              <Link to={`/app/${appId}`} className="text-sm text-muted-foreground hover:text-foreground">
                &larr; Back to App
              </Link>
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
                <Link to={`/app/${appId}`} className="text-sm text-muted-foreground hover:text-foreground">
                  &larr; Back to App
                </Link>
                <h1 className="text-2xl font-bold mt-1">{flow.name}</h1>
                {flow.description && <p className="text-muted-foreground mt-1">{flow.description}</p>}
              </div>
              <div className="flex items-center gap-6">
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Tool Name</p>
                  <code className="text-sm font-mono">{flow.toolName}</code>
                </div>
                <FlowActiveToggle flowId={flow.id} isActive={flow.isActive} onToggle={handleToggleActive} />
                <div className="flex items-center gap-2 border-l pl-4">
                  <button
                    onClick={() => setIsEditing(true)}
                    className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
                    title="Edit flow"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={handleDeleteClick}
                    disabled={isCheckingDeletion}
                    className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors disabled:opacity-50"
                    title="Delete flow"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          )}
          {toggleError && (
            <div className="mt-4 bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm">
              {toggleError}
              <button onClick={() => setToggleError(null)} className="ml-2 underline hover:no-underline">
                Dismiss
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Tabs and Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <div className="px-6 bg-background flex justify-center">
          <Tabs activeTab={activeTab} onTabChange={setActiveTab} tabs={tabs} />
        </div>

        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Build Tab - React Flow Canvas */}
          {activeTab === 'build' && (
            <div className="flex-1 relative">
              <FlowDiagram
                flow={flow}
                onNodeEdit={handleNodeEdit}
                onNodeDelete={handleNodeDelete}
                onUserIntentEdit={handleUserIntentEdit}
                onMockDataEdit={handleMockDataEdit}
                onAddUserIntent={handleUserIntentEdit}
                onAddStep={handleAddStep}
                canDelete={canDeleteNodes}
                onConnectionsChange={handleConnectionsChange}
                flowNameLookup={flowNameLookup}
              />
              {/* Floating Add Button */}
              <button
                onClick={handleAddStep}
                className="absolute bottom-6 right-6 w-14 h-14 bg-primary text-primary-foreground rounded-full shadow-lg hover:bg-primary/90 flex items-center justify-center transition-colors"
                title="Add node"
              >
                <Plus className="w-6 h-6" />
              </button>
            </div>
          )}

          {/* Preview Tab */}
          {activeTab === 'preview' && (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-muted-foreground">Preview coming soon...</p>
            </div>
          )}

          {/* Usage Tab */}
          {activeTab === 'usage' && (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-muted-foreground">Usage analytics coming soon...</p>
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

      {/* User Intent Modal */}
      <UserIntentModal
        isOpen={showUserIntentModal}
        onClose={handleCloseUserIntentModal}
        onSave={handleSaveUserIntent}
        flow={flow}
        isLoading={isSavingUserIntent}
        error={userIntentError}
      />

      {/* Add Step Modal */}
      <AddStepModal
        isOpen={showAddStepModal}
        onClose={() => setShowAddStepModal(false)}
        onSelect={handleAddStepSelect}
      />

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
      />
    </div>
  );
}

export default FlowDetail;
