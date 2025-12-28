import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import type { App, Flow, AppStatus } from '@chatgpt-app-builder/shared';
import { api, ApiClientError, BACKEND_URL } from '../lib/api';
import { FlowList } from '../components/flow/FlowList';
import { CreateFlowModal } from '../components/flow/CreateFlowModal';
import { Header } from '../components/layout/Header';
import { PublishButton } from '../components/app/PublishButton';

/**
 * App detail page - Shows app info and flows list
 * This is the app dashboard where users can manage flows
 */
function AppDetail() {
  const { appId } = useParams<{ appId: string }>();
  const navigate = useNavigate();
  const [app, setApp] = useState<App | null>(null);
  const [flows, setFlows] = useState<Flow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreatingFlow, setIsCreatingFlow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flowError, setFlowError] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [deletingFlowId, setDeletingFlowId] = useState<string | null>(null);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [isFlowModalOpen, setIsFlowModalOpen] = useState(false);

  useEffect(() => {
    async function loadData() {
      if (!appId) return;

      setIsLoading(true);
      setError(null);

      try {
        const [loadedApp, loadedFlows] = await Promise.all([
          api.getApp(appId),
          api.listFlows(appId),
        ]);
        setApp(loadedApp);
        setFlows(loadedFlows);
      } catch (err) {
        if (err instanceof ApiClientError) {
          setError(err.message);
        } else {
          setError('Failed to load app');
        }
      } finally {
        setIsLoading(false);
      }
    }

    loadData();
  }, [appId]);

  const handleCreateFlow = async (prompt: string) => {
    if (!appId) return;

    setIsCreatingFlow(true);
    setFlowError(null);

    try {
      const result = await api.createFlow(appId, { prompt });
      // Close modal and navigate to the flow editor
      setIsFlowModalOpen(false);
      navigate(result.redirectTo);
    } catch (err) {
      if (err instanceof ApiClientError) {
        setFlowError(err.message);
      } else {
        setFlowError('Failed to create flow');
      }
    } finally {
      setIsCreatingFlow(false);
    }
  };

  const handleFlowClick = (flow: Flow) => {
    navigate(`/app/${appId}/flow/${flow.id}`);
  };

  const handleFlowDelete = async (flow: Flow) => {
    // Two-click confirmation
    if (deleteConfirm !== flow.id) {
      setDeleteConfirm(flow.id);
      // Auto-clear confirmation after 3 seconds
      setTimeout(() => setDeleteConfirm(null), 3000);
      return;
    }

    setDeletingFlowId(flow.id);
    setDeleteConfirm(null);

    try {
      await api.deleteFlow(flow.id);
      setFlows((prev) => prev.filter((f) => f.id !== flow.id));
    } catch (err) {
      console.error('Failed to delete flow:', err);
    } finally {
      setDeletingFlowId(null);
    }
  };

  const handlePublish = async (appId: string, status: AppStatus) => {
    setPublishError(null);
    try {
      const updatedApp = await api.updateApp(appId, { status });
      setApp(updatedApp);
    } catch (err) {
      if (err instanceof ApiClientError) {
        setPublishError(err.message);
      } else {
        setPublishError('Failed to update app status');
      }
      throw err;
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
          <Link to="/" className="text-primary hover:underline">
            Go back home
          </Link>
        </div>
      </div>
    );
  }

  if (!app) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="text-muted-foreground">App not found</div>
          <Link to="/" className="text-primary hover:underline">
            Go back home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Global Header with App Switcher */}
      <Header currentApp={app} />

      {/* App Info Sub-header */}
      <div className="border-b bg-card">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">{app.name}</h1>
              {app.description && (
                <p className="text-muted-foreground mt-1">{app.description}</p>
              )}
            </div>
            <PublishButton
              appId={app.id}
              status={app.status}
              onPublish={handlePublish}
              flowCount={flows.length}
            />
          </div>
          {publishError && (
            <div className="mt-3 bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm">
              {publishError}
              <button
                onClick={() => setPublishError(null)}
                className="ml-2 underline hover:no-underline"
              >
                Dismiss
              </button>
            </div>
          )}
        </div>
      </div>

      {/* App Info Section - Moved below sub-header */}
      <div className="border-b bg-muted/30">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="space-y-4">
            {/* Basic App Info */}
            <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Slug:</span>
                <code className="bg-muted px-2 py-0.5 rounded">{app.slug}</code>
              </div>
              {app.createdAt && (
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Created:</span>
                  <span>{new Date(app.createdAt).toLocaleDateString()}</span>
                </div>
              )}
            </div>

            {/* Published Links - shown only when app is published */}
            {app.status === 'published' && (
              <div className="space-y-3">
                {/* Landing Page Link */}
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm text-blue-800 font-medium">Share with your users</p>
                  <div className="flex items-center gap-2 mt-1">
                    <a
                      href={`${BACKEND_URL}/servers/${app.slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600 hover:text-blue-800 underline flex-1 truncate"
                    >
                      {BACKEND_URL}/servers/{app.slug}
                    </a>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(`${BACKEND_URL}/servers/${app.slug}`);
                      }}
                      className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                    >
                      Copy
                    </button>
                  </div>
                </div>

                {/* MCP Endpoint */}
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                  <p className="text-sm text-green-800 font-medium">MCP Server Endpoint</p>
                  <div className="flex items-center gap-2 mt-1">
                    <code className="text-sm bg-white px-2 py-1 rounded border flex-1">
                      {BACKEND_URL}/servers/{app.slug}/mcp
                    </code>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(`${BACKEND_URL}/servers/${app.slug}/mcp`);
                      }}
                      className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                    >
                      Copy
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Flows Section */}
        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Flows (MCP Tools)</h2>
              <p className="text-sm text-muted-foreground">
                {flows.length} flow{flows.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>

          {/* Existing flows list */}
          <FlowList
            flows={flows}
            onFlowClick={handleFlowClick}
            onFlowDelete={handleFlowDelete}
            deletingFlowId={deletingFlowId}
            onCreateFlow={() => setIsFlowModalOpen(true)}
          />

          {/* Delete confirmation message */}
          {deleteConfirm && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm">
              Click delete again to confirm removal of this flow and all its views.
              <button
                onClick={() => setDeleteConfirm(null)}
                className="ml-2 underline hover:no-underline"
              >
                Cancel
              </button>
            </div>
          )}

          {/* Create new flow button */}
          <button
            onClick={() => setIsFlowModalOpen(true)}
            className="w-full px-6 py-4 border-2 border-dashed border-muted-foreground/25 rounded-lg text-muted-foreground hover:border-primary hover:text-primary transition-colors"
          >
            + Create New Flow
          </button>
        </section>
      </main>

      {/* Create Flow Modal */}
      <CreateFlowModal
        isOpen={isFlowModalOpen}
        onClose={() => setIsFlowModalOpen(false)}
        onSubmit={handleCreateFlow}
        isLoading={isCreatingFlow}
        error={flowError}
      />
    </div>
  );
}

export default AppDetail;
