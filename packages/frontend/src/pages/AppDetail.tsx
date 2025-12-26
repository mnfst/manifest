import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import type { App, Flow } from '@chatgpt-app-builder/shared';
import { api, ApiClientError } from '../lib/api';
import { PromptInput } from '../components/flow/PromptInput';
import { FlowList } from '../components/flow/FlowList';

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
      // Navigate to the flow editor
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
      {/* Header */}
      <header className="border-b bg-card">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">
                &larr; Back
              </Link>
              <h1 className="text-2xl font-bold mt-1">{app.name}</h1>
              {app.description && (
                <p className="text-muted-foreground mt-1">{app.description}</p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                app.status === 'published'
                  ? 'bg-green-500/20 text-green-600'
                  : 'bg-amber-500/20 text-amber-600'
              }`}>
                {app.status}
              </span>
            </div>
          </div>
        </div>
      </header>

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

          {/* Create new flow section */}
          <div className="border rounded-lg p-6 bg-card space-y-4">
            <div>
              <h3 className="font-medium text-lg">
                {flows.length > 0 ? 'Add Another Flow' : 'Create Your First Flow'}
              </h3>
              <p className="text-muted-foreground text-sm mt-1">
                Describe the MCP tool you want to create and we'll generate it for you.
              </p>
            </div>

            <PromptInput
              onSubmit={handleCreateFlow}
              isLoading={isCreatingFlow}
              placeholder="Example: A product catalog that shows items with name, price, and availability status"
            />

            {flowError && (
              <div className="p-3 bg-destructive/10 text-destructive rounded-lg text-sm">
                {flowError}
              </div>
            )}
          </div>
        </section>

        {/* App Info Section */}
        <section className="mt-8 space-y-4">
          <h2 className="text-lg font-semibold">App Info</h2>
          <div className="border rounded-lg p-4 bg-card space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Slug:</span>
              <code className="bg-muted px-2 py-0.5 rounded">{app.slug}</code>
            </div>
            {app.createdAt && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Created:</span>
                <span>{new Date(app.createdAt).toLocaleDateString()}</span>
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

export default AppDetail;
