import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Pencil, Users } from 'lucide-react';
import type { App, Flow, AppStatus } from '@chatgpt-app-builder/shared';
import { api, ApiClientError, resolveIconUrl } from '../lib/api';
import { FlowList } from '../components/flow/FlowList';
import { CreateFlowModal } from '../components/flow/CreateFlowModal';
import { DeleteFlowModal } from '../components/flow/DeleteFlowModal';
import { PublishButton } from '../components/app/PublishButton';
import { ShareModal } from '../components/app/ShareModal';
import { AppIconUpload } from '../components/app/AppIconUpload';
import { EditAppModal } from '../components/app/EditAppModal';
import { CollaboratorManagement } from '../components/app/CollaboratorManagement';
import { AnalyticsDashboard } from '../components/analytics/AnalyticsDashboard';
import { AnalyticsPreview } from '../components/analytics/AnalyticsPreview';

type AppDetailTab = 'flows' | 'collaborators' | 'analytics';

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
  const [flowToDelete, setFlowToDelete] = useState<Flow | null>(null);
  const [isDeletingFlow, setIsDeletingFlow] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [isFlowModalOpen, setIsFlowModalOpen] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isUploadingIcon, setIsUploadingIcon] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isEditingApp, setIsEditingApp] = useState(false);
  const [editAppError, setEditAppError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<AppDetailTab>('flows');

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

  const handleCreateFlow = async (data: { name: string; description?: string }) => {
    if (!appId) return;

    setIsCreatingFlow(true);
    setFlowError(null);

    try {
      const result = await api.createFlow(appId, data);
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

  const handleFlowDelete = (flow: Flow) => {
    setFlowToDelete(flow);
  };

  const confirmFlowDelete = async () => {
    if (!flowToDelete) return;

    setIsDeletingFlow(true);
    try {
      await api.deleteFlow(flowToDelete.id);
      setFlows((prev) => prev.filter((f) => f.id !== flowToDelete.id));
      setFlowToDelete(null);
    } catch (err) {
      console.error('Failed to delete flow:', err);
    } finally {
      setIsDeletingFlow(false);
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

  const handleIconUpload = async (file: File) => {
    if (!appId) return;

    setIsUploadingIcon(true);
    try {
      const result = await api.uploadAppIcon(appId, file);
      // Update local app state with new icon URL
      setApp((prev) => prev ? { ...prev, logoUrl: result.iconUrl } : prev);
    } finally {
      setIsUploadingIcon(false);
    }
  };

  const handleEditApp = async (appId: string, data: { name: string; description?: string }) => {
    setIsEditingApp(true);
    setEditAppError(null);
    try {
      const updatedApp = await api.updateApp(appId, data);
      setApp(updatedApp);
      setIsEditModalOpen(false);
    } catch (err) {
      if (err instanceof ApiClientError) {
        setEditAppError(err.message);
      } else {
        setEditAppError('Failed to update app');
      }
    } finally {
      setIsEditingApp(false);
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
      {/* App Info Sub-header */}
      <div className="border-b bg-card">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {/* App Icon with Upload */}
              <AppIconUpload
                currentIconUrl={resolveIconUrl(app.logoUrl)}
                appName={app.name}
                onUpload={handleIconUpload}
                isLoading={isUploadingIcon}
              />
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-bold">{app.name}</h1>
                  <button
                    onClick={() => setIsEditModalOpen(true)}
                    className="p-2 text-muted-foreground hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    title="Edit app"
                  >
                    <Pencil className="w-5 h-5" />
                  </button>
                </div>
                {app.description && (
                  <p className="text-muted-foreground mt-1">{app.description}</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3">
              {/* Share button - only visible when published */}
              {app.status === 'published' && (
                <button
                  onClick={() => setIsShareModalOpen(true)}
                  className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
                  title="Share app"
                  aria-label="Share app"
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
                    />
                  </svg>
                </button>
              )}
              <PublishButton
                appId={app.id}
                status={app.status}
                onPublish={handlePublish}
                flowCount={flows.length}
              />
            </div>
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
          </div>
        </div>
      </div>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Tab Navigation */}
        <div className="border-b mb-6">
          <nav className="flex gap-6" aria-label="App sections">
            <button
              onClick={() => setActiveTab('flows')}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'flows'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-gray-300'
              }`}
            >
              Flows
              <span className="ml-2 text-xs text-muted-foreground">
                ({flows.length})
              </span>
            </button>
            <button
              onClick={() => setActiveTab('analytics')}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'analytics'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-gray-300'
              }`}
            >
              Analytics
            </button>
            <button
              onClick={() => setActiveTab('collaborators')}
              className={`flex items-center gap-2 pb-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'collaborators'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-gray-300'
              }`}
            >
              <Users className="w-4 h-4" />
              Collaborators
            </button>
          </nav>
        </div>

        {/* Flows Section */}
        {activeTab === 'flows' && (
          <section className="space-y-6">
            {/* Analytics Preview */}
            {appId && (
              <AnalyticsPreview
                appId={appId}
                onViewMore={() => setActiveTab('analytics')}
              />
            )}

            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">Flows</h2>
                <p className="text-sm text-muted-foreground">
                  {flows.length} flow{flows.length !== 1 ? 's' : ''}
                </p>
              </div>
              <button
                onClick={() => setIsFlowModalOpen(true)}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                  <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" />
                </svg>
                Create New Flow
              </button>
            </div>

            {/* Existing flows list */}
            <FlowList
              flows={flows}
              onFlowClick={handleFlowClick}
              onFlowDelete={handleFlowDelete}
              onCreateFlow={() => setIsFlowModalOpen(true)}
            />
          </section>
        )}

        {/* Analytics Section */}
        {activeTab === 'analytics' && appId && (
          <AnalyticsDashboard appId={appId} />
        )}

        {/* Collaborators Section */}
        {activeTab === 'collaborators' && appId && (
          <section>
            <div className="mb-6">
              <h2 className="text-lg font-semibold">Collaborator Management</h2>
              <p className="text-sm text-muted-foreground">
                Manage who can work on this app
              </p>
            </div>
            <CollaboratorManagement appId={appId} />
          </section>
        )}
      </main>

      {/* Create Flow Modal */}
      <CreateFlowModal
        isOpen={isFlowModalOpen}
        onClose={() => setIsFlowModalOpen(false)}
        onSubmit={handleCreateFlow}
        isLoading={isCreatingFlow}
        error={flowError}
      />

      {/* Share Modal */}
      <ShareModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        appSlug={app.slug}
      />

      {/* Edit App Modal */}
      <EditAppModal
        isOpen={isEditModalOpen}
        app={app}
        onClose={() => {
          setIsEditModalOpen(false);
          setEditAppError(null);
        }}
        onSubmit={handleEditApp}
        isLoading={isEditingApp}
        error={editAppError}
      />

      {/* Delete Flow Modal */}
      <DeleteFlowModal
        isOpen={!!flowToDelete}
        flow={flowToDelete}
        onClose={() => setFlowToDelete(null)}
        onConfirm={confirmFlowDelete}
        isLoading={isDeletingFlow}
      />
    </div>
  );
}

export default AppDetail;
