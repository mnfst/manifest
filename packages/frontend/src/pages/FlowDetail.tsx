import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import type { App, Flow, View, UpdateFlowRequest, FlowDeletionCheck } from '@chatgpt-app-builder/shared';
import { api, ApiClientError } from '../lib/api';
import { FlowDiagram } from '../components/flow/FlowDiagram';
import { Header } from '../components/layout/Header';
import { FlowActiveToggle } from '../components/flow/FlowActiveToggle';
import { EditFlowForm } from '../components/flow/EditFlowForm';
import { DeleteConfirmDialog } from '../components/common/DeleteConfirmDialog';

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
  const [isCreatingView, setIsCreatingView] = useState(false);
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

  return (
    <div className="h-screen bg-background flex flex-col overflow-hidden">
      {/* Global Header with App Switcher */}
      <Header currentApp={app} />

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

      {/* Views Section - Full Width, fills remaining height */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <div className="px-6 py-4 flex items-center justify-between border-b bg-background">
          <div>
            <h2 className="text-lg font-semibold">Views</h2>
            <p className="text-sm text-muted-foreground">
              {views.length} view{views.length !== 1 ? 's' : ''}
            </p>
          </div>
          <button
            onClick={handleAddView}
            disabled={isCreatingView}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2"
          >
            {isCreatingView ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                  <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" />
                </svg>
                Add View
              </>
            )}
          </button>
        </div>

        {/* Full-width Flow Diagram - fills remaining viewport height */}
        <div className="flex-1 overflow-hidden">
          <FlowDiagram
            views={views}
            onViewEdit={handleViewClick}
            onViewDelete={handleViewDelete}
            canDelete={views.length > 1}
          />
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
    </div>
  );
}

export default FlowDetail;
