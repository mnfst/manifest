import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import type { Flow, View } from '@chatgpt-app-builder/shared';
import { api, ApiClientError } from '../lib/api';
import { ViewList } from '../components/view/ViewList';

/**
 * Flow detail/editor page - Shows flow info and views list
 * Users can view and navigate to individual view editors
 */
function FlowDetail() {
  const { appId, flowId } = useParams<{ appId: string; flowId: string }>();
  const navigate = useNavigate();
  const [flow, setFlow] = useState<Flow | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCreatingView, setIsCreatingView] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  useEffect(() => {
    async function loadFlow() {
      if (!flowId) return;

      setIsLoading(true);
      setError(null);

      try {
        const loadedFlow = await api.getFlow(flowId);
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

    loadFlow();
  }, [flowId]);

  const handleViewClick = (view: View) => {
    navigate(`/app/${appId}/flow/${flowId}/view/${view.id}`);
  };

  const handleViewDelete = async (view: View) => {
    if (deleteConfirm !== view.id) {
      setDeleteConfirm(view.id);
      return;
    }

    try {
      await api.deleteView(view.id);
      // Reload flow to get updated views list
      if (flowId) {
        const updatedFlow = await api.getFlow(flowId);
        setFlow(updatedFlow);
      }
    } catch (err) {
      console.error('Failed to delete view:', err);
    } finally {
      setDeleteConfirm(null);
    }
  };

  const handleReorder = async (viewIds: string[]) => {
    if (!flowId) return;

    try {
      const reorderedViews = await api.reorderViews(flowId, viewIds);
      setFlow((prev) => prev ? { ...prev, views: reorderedViews } : prev);
    } catch (err) {
      console.error('Failed to reorder views:', err);
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

  if (!flow) {
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
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
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
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Flow Info */}
        <section className="space-y-4 mb-8">
          <h2 className="text-lg font-semibold">MCP Tool Info</h2>
          <div className="border rounded-lg p-4 bg-card space-y-3">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm text-muted-foreground">Tool Name</p>
                <code className="text-lg font-mono">{flow.toolName}</code>
              </div>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Tool Description</p>
              <p className="text-sm mt-1">{flow.toolDescription}</p>
            </div>
          </div>
        </section>

        {/* Views Section */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
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

          <ViewList
            views={views}
            onViewClick={handleViewClick}
            onViewDelete={handleViewDelete}
            onReorder={handleReorder}
            canDelete={views.length > 1}
          />

          {/* Delete confirmation message */}
          {deleteConfirm && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm">
              Click delete again to confirm removal of this view.
              <button
                onClick={() => setDeleteConfirm(null)}
                className="ml-2 underline hover:no-underline"
              >
                Cancel
              </button>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

export default FlowDetail;
