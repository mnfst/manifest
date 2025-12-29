import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import type { App, Flow, View, UpdateFlowRequest, FlowDeletionCheck, ReturnValue, CallFlow, ActionConnection } from '@chatgpt-app-builder/shared';
import { Hammer, Eye, BarChart3 } from 'lucide-react';
import { api, ApiClientError } from '../lib/api';
import { FlowDiagram } from '../components/flow/FlowDiagram';
import { FlowActiveToggle } from '../components/flow/FlowActiveToggle';
import { EditFlowForm } from '../components/flow/EditFlowForm';
import { DeleteConfirmDialog } from '../components/common/DeleteConfirmDialog';
import { UserIntentModal } from '../components/flow/UserIntentModal';
import { MockDataModal } from '../components/flow/MockDataModal';
import { StepTypeDrawer, type StepType } from '../components/flow/StepTypeDrawer';
import { ReturnValueEditor } from '../components/flow/ReturnValueEditor';
import { CallFlowEditor } from '../components/flow/CallFlowEditor';
import { Tabs } from '../components/common/Tabs';
import { FlowPreview } from '../components/preview/FlowPreview';
import type { FlowDetailTab, TabConfig } from '../types/tabs';

/**
 * Flow detail/editor page - Shows flow info and views list
 * Users can view and navigate to individual view editors
 */
function FlowDetail() {
  const { appId, flowId } = useParams<{ appId: string; flowId: string }>();
  const navigate = useNavigate();
  const [app, setApp] = useState<App | null>(null);
  const [flow, setFlow] = useState<Flow | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [, setIsCreatingView] = useState(false);
  const [toggleError, setToggleError] = useState<string | null>(null);

  // Delete view state
  const [viewToDelete, setViewToDelete] = useState<View | null>(null);
  const [isDeletingView, setIsDeletingView] = useState(false);

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

  // Mock data modal state
  const [showMockDataModal, setShowMockDataModal] = useState(false);
  const [mockDataView, setMockDataView] = useState<View | null>(null);

  // Step type drawer state
  const [showStepTypeDrawer, setShowStepTypeDrawer] = useState(false);

  // Return value state
  const [showReturnValueEditor, setShowReturnValueEditor] = useState(false);
  const [returnValueToEdit, setReturnValueToEdit] = useState<ReturnValue | null>(null);
  const [returnValueToDelete, setReturnValueToDelete] = useState<ReturnValue | null>(null);
  const [isSavingReturnValue, setIsSavingReturnValue] = useState(false);
  const [returnValueError, setReturnValueError] = useState<string | null>(null);
  const [isDeletingReturnValue, setIsDeletingReturnValue] = useState(false);

  // Call flow state
  const [showCallFlowEditor, setShowCallFlowEditor] = useState(false);
  const [callFlowToEdit, setCallFlowToEdit] = useState<CallFlow | null>(null);
  const [callFlowToDelete, setCallFlowToDelete] = useState<CallFlow | null>(null);
  const [isSavingCallFlow, setIsSavingCallFlow] = useState(false);
  const [callFlowError, setCallFlowError] = useState<string | null>(null);
  const [isDeletingCallFlow, setIsDeletingCallFlow] = useState(false);
  const [availableFlows, setAvailableFlows] = useState<Flow[]>([]);

  // Action connections state
  const [actionConnections, setActionConnections] = useState<ActionConnection[]>([]);

  // Tab state
  const [activeTab, setActiveTab] = useState<FlowDetailTab>('build');
  const [previewKey, setPreviewKey] = useState(0);

  // Handle tab changes with animation restart
  const handleTabChange = (tab: FlowDetailTab) => {
    setActiveTab(tab);
    if (tab === 'preview') {
      // Increment key to restart animation when switching to preview
      setPreviewKey(prev => prev + 1);
    }
  };

  useEffect(() => {
    async function loadData() {
      if (!appId || !flowId) return;

      setIsLoading(true);
      setError(null);

      try {
        const [loadedApp, loadedFlow, loadedFlows, loadedActionConnections] = await Promise.all([
          api.getApp(appId),
          api.getFlow(flowId),
          api.listFlows(appId),
          api.listActionConnectionsByFlow(flowId),
        ]);
        setApp(loadedApp);
        setFlow(loadedFlow);
        setAvailableFlows(loadedFlows);
        setActionConnections(loadedActionConnections);
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

  const handleViewClick = (view: View) => {
    navigate(`/app/${appId}/flow/${flowId}/view/${view.id}`);
  };

  const handleViewDelete = (view: View) => {
    setViewToDelete(view);
  };

  const handleCloseViewDeleteDialog = () => {
    if (!isDeletingView) {
      setViewToDelete(null);
    }
  };

  const handleConfirmDeleteView = async () => {
    if (!viewToDelete || !flowId) return;

    setIsDeletingView(true);
    try {
      await api.deleteView(viewToDelete.id);
      // Reload flow to get updated views list
      const updatedFlow = await api.getFlow(flowId);
      setFlow(updatedFlow);
      setViewToDelete(null);
    } catch (err) {
      console.error('Failed to delete view:', err);
    } finally {
      setIsDeletingView(false);
    }
  };

  const handleAddView = async () => {
    if (!flowId) return;

    setIsCreatingView(true);
    try {
      const newView = await api.createView(flowId, {
        name: `View ${(flow?.views?.length ?? 0) + 1}`,
        layoutTemplate: 'table',
      });
      // Reload flow to get updated views list
      const updatedFlow = await api.getFlow(flowId);
      setFlow(updatedFlow);
      // Navigate to the new view editor
      navigate(`/app/${appId}/flow/${flowId}/view/${newView.id}`);
    } catch (err) {
      console.error('Failed to create view:', err);
    } finally {
      setIsCreatingView(false);
    }
  };

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
      throw err; // Re-throw so the toggle component knows it failed
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
      // Show dialog anyway without warning
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
      // Navigate back to app detail
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
      // updateFlow returns the complete flow with views included
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

  const handleMockDataEdit = (view: View) => {
    setMockDataView(view);
    setShowMockDataModal(true);
  };

  const handleCloseMockDataModal = () => {
    setShowMockDataModal(false);
    setMockDataView(null);
  };

  const handleMockDataUpdated = async () => {
    // Reload flow to get updated mock data
    if (flowId) {
      try {
        const updatedFlow = await api.getFlow(flowId);
        setFlow(updatedFlow);
      } catch (err) {
        console.error('Failed to reload flow:', err);
      }
    }
  };

  // Step type drawer handlers
  const handleAddStep = () => {
    setShowStepTypeDrawer(true);
  };

  const handleCloseStepTypeDrawer = () => {
    setShowStepTypeDrawer(false);
  };

  const handleStepTypeSelect = async (type: StepType) => {
    if (type === 'view') {
      await handleAddView();
    } else if (type === 'returnValue') {
      // Open return value editor for creating new
      setReturnValueToEdit(null);
      setReturnValueError(null);
      setShowReturnValueEditor(true);
    } else if (type === 'callFlow') {
      // Open call flow editor for creating new
      setCallFlowToEdit(null);
      setCallFlowError(null);
      setShowCallFlowEditor(true);
    }
  };

  // Return value handlers
  const handleReturnValueEdit = (returnValue: ReturnValue) => {
    setReturnValueToEdit(returnValue);
    setReturnValueError(null);
    setShowReturnValueEditor(true);
  };

  const handleCloseReturnValueEditor = () => {
    if (!isSavingReturnValue) {
      setShowReturnValueEditor(false);
      setReturnValueToEdit(null);
      setReturnValueError(null);
    }
  };

  const handleSaveReturnValue = async (text: string) => {
    if (!flowId) return;

    setIsSavingReturnValue(true);
    setReturnValueError(null);

    try {
      if (returnValueToEdit) {
        // Update existing
        await api.updateReturnValue(returnValueToEdit.id, { text });
      } else {
        // Create new
        await api.createReturnValue(flowId, { text });
      }
      // Reload flow to get updated return values
      const updatedFlow = await api.getFlow(flowId);
      setFlow(updatedFlow);
      setShowReturnValueEditor(false);
      setReturnValueToEdit(null);
    } catch (err) {
      if (err instanceof ApiClientError) {
        setReturnValueError(err.message);
      } else {
        setReturnValueError('Failed to save return value');
      }
    } finally {
      setIsSavingReturnValue(false);
    }
  };

  const handleReturnValueDelete = (returnValue: ReturnValue) => {
    setReturnValueToDelete(returnValue);
  };

  const handleCloseReturnValueDeleteDialog = () => {
    if (!isDeletingReturnValue) {
      setReturnValueToDelete(null);
    }
  };

  const handleConfirmDeleteReturnValue = async () => {
    if (!returnValueToDelete || !flowId) return;

    setIsDeletingReturnValue(true);
    try {
      await api.deleteReturnValue(returnValueToDelete.id);
      // Reload flow to get updated return values
      const updatedFlow = await api.getFlow(flowId);
      setFlow(updatedFlow);
      setReturnValueToDelete(null);
    } catch (err) {
      console.error('Failed to delete return value:', err);
    } finally {
      setIsDeletingReturnValue(false);
    }
  };

  // Call flow handlers
  const handleCallFlowEdit = (callFlow: CallFlow) => {
    setCallFlowToEdit(callFlow);
    setCallFlowError(null);
    setShowCallFlowEditor(true);
  };

  const handleCloseCallFlowEditor = () => {
    if (!isSavingCallFlow) {
      setShowCallFlowEditor(false);
      setCallFlowToEdit(null);
      setCallFlowError(null);
    }
  };

  const handleSaveCallFlow = async (targetFlowId: string) => {
    if (!flowId) return;

    setIsSavingCallFlow(true);
    setCallFlowError(null);

    try {
      if (callFlowToEdit) {
        // Update existing
        await api.updateCallFlow(callFlowToEdit.id, { targetFlowId });
      } else {
        // Create new
        await api.createCallFlow(flowId, { targetFlowId });
      }
      // Reload flow to get updated call flows
      const updatedFlow = await api.getFlow(flowId);
      setFlow(updatedFlow);
      setShowCallFlowEditor(false);
      setCallFlowToEdit(null);
    } catch (err) {
      if (err instanceof ApiClientError) {
        setCallFlowError(err.message);
      } else {
        setCallFlowError('Failed to save call flow');
      }
    } finally {
      setIsSavingCallFlow(false);
    }
  };

  const handleCallFlowDelete = (callFlow: CallFlow) => {
    setCallFlowToDelete(callFlow);
  };

  const handleCloseCallFlowDeleteDialog = () => {
    if (!isDeletingCallFlow) {
      setCallFlowToDelete(null);
    }
  };

  const handleConfirmDeleteCallFlow = async () => {
    if (!callFlowToDelete || !flowId) return;

    setIsDeletingCallFlow(true);
    try {
      await api.deleteCallFlow(callFlowToDelete.id);
      // Reload flow to get updated call flows
      const updatedFlow = await api.getFlow(flowId);
      setFlow(updatedFlow);
      setCallFlowToDelete(null);
    } catch (err) {
      console.error('Failed to delete call flow:', err);
    } finally {
      setIsDeletingCallFlow(false);
    }
  };

  // Action connection handlers
  const handleActionConnectionChange = async (connections: ActionConnection[]) => {
    setActionConnections(connections);
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

  const views = flow.views || [];
  const returnValues = flow.returnValues || [];
  const callFlows = flow.callFlows || [];

  // Determine step counts for display
  const stepCount = views.length + returnValues.length + callFlows.length;
  const hasViews = views.length > 0;
  const hasReturnValues = returnValues.length > 0;
  const hasCallFlows = callFlows.length > 0;

  // Views can now coexist with return values and call flows
  // Only return values and call flows are mutually exclusive
  const disabledStepTypes: StepType[] = [];
  if (hasReturnValues) {
    disabledStepTypes.push('callFlow');
  }
  if (hasCallFlows) {
    disabledStepTypes.push('returnValue');
  }

  // Tab configuration with disabled state for Preview when no views
  const tabs: TabConfig[] = [
    { id: 'build', label: 'Build', icon: Hammer },
    { id: 'preview', label: 'Preview', icon: Eye, disabled: !hasViews },
    { id: 'usage', label: 'Usage', icon: BarChart3 },
  ];

  return (
    <div className="h-screen bg-background flex flex-col overflow-hidden">
      {/* Flow Info Sub-header */}
      <div className="border-b bg-card">
        <div className="px-6 py-4">
          {isEditing ? (
            <div className="max-w-4xl mx-auto">
              <Link
                to={`/app/${appId}`}
                className="text-sm text-muted-foreground hover:text-foreground"
              >
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
                <Link
                  to={`/app/${appId}`}
                  className="text-sm text-muted-foreground hover:text-foreground"
                >
                  &larr; Back to App
                </Link>
                <h1 className="text-2xl font-bold mt-1">{flow.name}</h1>
                {flow.description && (
                  <p className="text-muted-foreground mt-1">{flow.description}</p>
                )}
              </div>
              <div className="flex items-center gap-6">
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Tool Name</p>
                  <code className="text-sm font-mono">{flow.toolName}</code>
                </div>
                <div className="text-right max-w-xs">
                  <p className="text-xs text-muted-foreground">Tool Description</p>
                  <p className="text-sm truncate">{flow.toolDescription}</p>
                </div>
                <FlowActiveToggle
                  flowId={flow.id}
                  isActive={flow.isActive}
                  onToggle={handleToggleActive}
                />
                <div className="flex items-center gap-2 border-l pl-4">
                  <button
                    onClick={() => setIsEditing(true)}
                    className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
                    title="Edit flow"
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                      />
                    </svg>
                  </button>
                  <button
                    onClick={handleDeleteClick}
                    disabled={isCheckingDeletion}
                    className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors disabled:opacity-50"
                    title="Delete flow"
                  >
                    {isCheckingDeletion ? (
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                    ) : (
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
          {toggleError && (
            <div className="mt-4 bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm">
              {toggleError}
              <button
                onClick={() => setToggleError(null)}
                className="ml-2 underline hover:no-underline"
              >
                Dismiss
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Tabs and Main Content - Full Width, fills remaining height */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Tab bar - centered */}
        <div className="px-6 bg-background flex justify-center">
          <Tabs
            activeTab={activeTab}
            onTabChange={handleTabChange}
            tabs={tabs}
          />
        </div>

        {/* Tab Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Build Tab - Flow Diagram Editor */}
          {activeTab === 'build' && (
            <>
              {/* Full-width Flow Diagram - fills remaining viewport height */}
              <div className="flex-1 overflow-hidden">
                <FlowDiagram
                  key={`flow-${flow.id}-${Boolean(flow.toolDescription?.trim())}`}
                  flow={flow}
                  views={views}
                  returnValues={returnValues}
                  callFlows={callFlows}
                  actionConnections={actionConnections}
                  onViewEdit={handleViewClick}
                  onViewDelete={handleViewDelete}
                  onReturnValueEdit={handleReturnValueEdit}
                  onReturnValueDelete={handleReturnValueDelete}
                  onCallFlowEdit={handleCallFlowEdit}
                  onCallFlowDelete={handleCallFlowDelete}
                  onUserIntentEdit={handleUserIntentEdit}
                  onMockDataEdit={handleMockDataEdit}
                  onAddUserIntent={handleUserIntentEdit}
                  onAddStep={handleAddStep}
                  canDelete={stepCount > 1}
                  onActionConnectionsChange={handleActionConnectionChange}
                />
              </div>
            </>
          )}

          {/* Preview Tab - ChatGPT Conversation Simulation */}
          {activeTab === 'preview' && hasViews && (
            <div className="flex-1 overflow-hidden">
              <FlowPreview key={previewKey} flow={flow} app={app} />
            </div>
          )}

          {/* Usage Tab - Coming Soon Placeholder */}
          {activeTab === 'usage' && (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-muted-foreground text-lg">Coming Soon...</p>
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

      {/* Delete View Confirmation */}
      <DeleteConfirmDialog
        isOpen={!!viewToDelete}
        onClose={handleCloseViewDeleteDialog}
        onConfirm={handleConfirmDeleteView}
        title="Delete View"
        message={`Are you sure you want to delete "${viewToDelete?.name || 'this view'}"? This action cannot be undone.`}
        isLoading={isDeletingView}
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

      {/* Mock Data Modal */}
      <MockDataModal
        isOpen={showMockDataModal}
        onClose={handleCloseMockDataModal}
        view={mockDataView}
        onMockDataUpdated={handleMockDataUpdated}
      />

      {/* Step Type Drawer */}
      <StepTypeDrawer
        isOpen={showStepTypeDrawer}
        onClose={handleCloseStepTypeDrawer}
        onSelect={handleStepTypeSelect}
        disabledTypes={disabledStepTypes}
      />

      {/* Return Value Editor */}
      <ReturnValueEditor
        isOpen={showReturnValueEditor}
        onClose={handleCloseReturnValueEditor}
        onSave={handleSaveReturnValue}
        returnValue={returnValueToEdit}
        isLoading={isSavingReturnValue}
        error={returnValueError}
      />

      {/* Delete Return Value Confirmation */}
      <DeleteConfirmDialog
        isOpen={!!returnValueToDelete}
        onClose={handleCloseReturnValueDeleteDialog}
        onConfirm={handleConfirmDeleteReturnValue}
        title="Delete Return Value"
        message="Are you sure you want to delete this return value? This action cannot be undone."
        isLoading={isDeletingReturnValue}
      />

      {/* Call Flow Editor */}
      <CallFlowEditor
        isOpen={showCallFlowEditor}
        onClose={handleCloseCallFlowEditor}
        onSave={handleSaveCallFlow}
        callFlow={callFlowToEdit}
        currentFlowId={flowId || ''}
        availableFlows={availableFlows}
        isLoading={isSavingCallFlow}
        error={callFlowError}
      />

      {/* Delete Call Flow Confirmation */}
      <DeleteConfirmDialog
        isOpen={!!callFlowToDelete}
        onClose={handleCloseCallFlowDeleteDialog}
        onConfirm={handleConfirmDeleteCallFlow}
        title="Delete Call Flow"
        message="Are you sure you want to delete this call flow? This action cannot be undone."
        isLoading={isDeletingCallFlow}
      />
    </div>
  );
}

export default FlowDetail;
