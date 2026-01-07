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
  ChatMessage,
} from '@chatgpt-app-builder/shared';
import { Hammer, Eye, BarChart3, Edit, Trash2 } from 'lucide-react';
import { api, ApiClientError } from '../lib/api';
import { FlowActiveToggle } from '../components/flow/FlowActiveToggle';
import { EditFlowForm } from '../components/flow/EditFlowForm';
import { DeleteConfirmDialog } from '../components/common/DeleteConfirmDialog';
import { FlowDiagram } from '../components/flow/FlowDiagram';
import { NodeEditModal } from '../components/flow/NodeEditModal';
import { NodeLibrary } from '../components/flow/NodeLibrary';
import { Tabs } from '../components/common/Tabs';
import { ExecutionList } from '../components/execution/ExecutionList';
import { ExecutionDetail } from '../components/execution/ExecutionDetail';
import { ExecutionDetailPlaceholder } from '../components/execution/ExecutionDetailPlaceholder';
import { PreviewChat } from '../components/chat/PreviewChat';
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

  // Node library state (replaces AddStepModal and floating button)
  const [isNodeLibraryOpen, setIsNodeLibraryOpen] = useState(true);

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

  // Execution tracking state
  const [selectedExecutionId, setSelectedExecutionId] = useState<string | null>(null);

  // Chat preview state (persists across tab switches)
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);

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

  const handleAddStep = useCallback(() => {
    // Directly open the UserIntent node creation modal
    // This is called when clicking the "Add user intent" placeholder on the canvas
    setNodeToEdit(null);
    setNodeTypeToCreate('UserIntent');
    setNodeEditError(null);
    setShowNodeEditModal(true);
  }, []);

  const handleNodeLibrarySelect = useCallback((nodeType: NodeType) => {
    // Open the node edit modal in create mode
    setNodeToEdit(null);
    setNodeTypeToCreate(nodeType);
    setNodeEditError(null);
    setShowNodeEditModal(true);
  }, []);

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
  const canDeleteNodes = nodes.length > 0;

  const tabs: TabConfig[] = [
    { id: 'build', label: 'Build', icon: Hammer },
    { id: 'preview', label: 'Preview', icon: Eye },
    { id: 'usage', label: 'Usage', icon: BarChart3 },
  ];

  return (
    <div className="h-screen bg-background flex flex-col overflow-hidden">
      {/* Flow Info Sub-header */}
      <div className="border-b bg-card">
        <div className="px-6 py-4">
          {isEditing ? (
            <div className="max-w-4xl mx-auto">
              <button
                type="button"
                onClick={() => navigate(`/app/${appId}`)}
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                ← Back to App
              </button>
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
                <button
                  type="button"
                  onClick={() => navigate(`/app/${appId}`)}
                  className="text-sm text-muted-foreground hover:text-foreground"
                >
                  ← Back to App
                </button>
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
                onClose={() => setIsNodeLibraryOpen(false)}
                onSelectNode={handleNodeLibrarySelect}
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
                />
              </div>
            </div>
          )}

          {/* Preview Tab - Chat with LLM */}
          {activeTab === 'preview' && flowId && (
            <div className="flex-1 overflow-hidden">
              <PreviewChat
                flowId={flowId}
                messages={chatMessages}
                onMessagesChange={setChatMessages}
              />
            </div>
          )}

          {/* Usage Tab - Two column layout */}
          {activeTab === 'usage' && flowId && (
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
