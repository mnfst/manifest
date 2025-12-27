import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { App, AppWithFlowCount } from '@chatgpt-app-builder/shared';
import { AppList } from '../components/app/AppList';
import { CreateAppModal } from '../components/app/CreateAppModal';
import { EditAppModal } from '../components/app/EditAppModal';
import { DeleteConfirmDialog } from '../components/common/DeleteConfirmDialog';
import { api, ApiClientError } from '../lib/api';

/**
 * Home page - App list and creation
 * Users see all existing apps and can create new ones
 */
function Home() {
  const navigate = useNavigate();
  const [apps, setApps] = useState<AppWithFlowCount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Edit app state
  const [editingApp, setEditingApp] = useState<App | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Delete app state
  const [deletingApp, setDeletingApp] = useState<AppWithFlowCount | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    async function loadApps() {
      setIsLoading(true);
      setError(null);

      try {
        const loadedApps = await api.listApps();
        setApps(loadedApps);
      } catch (err) {
        if (err instanceof ApiClientError) {
          setError(err.message);
        } else {
          setError('Failed to load apps');
        }
      } finally {
        setIsLoading(false);
      }
    }

    loadApps();
  }, []);

  const handleAppClick = (app: App) => {
    navigate(`/app/${app.id}`);
  };

  const handleOpenModal = () => {
    setIsModalOpen(true);
    setCreateError(null);
  };

  const handleCloseModal = () => {
    if (!isCreating) {
      setIsModalOpen(false);
      setCreateError(null);
    }
  };

  const handleCreateApp = async (data: { name: string; description?: string }) => {
    setIsCreating(true);
    setCreateError(null);

    try {
      const newApp = await api.createApp(data);
      // New apps have 0 flows
      setApps((prev) => [{ ...newApp, flowCount: 0 }, ...prev]);
      setIsModalOpen(false);
      navigate(`/app/${newApp.id}`);
    } catch (err) {
      if (err instanceof ApiClientError) {
        setCreateError(err.message);
      } else {
        setCreateError('Failed to create app');
      }
    } finally {
      setIsCreating(false);
    }
  };

  const handleEditApp = (app: App) => {
    setEditingApp(app);
    setEditError(null);
  };

  const handleCloseEditModal = () => {
    if (!isEditing) {
      setEditingApp(null);
      setEditError(null);
    }
  };

  const handleUpdateApp = async (appId: string, data: { name: string; description?: string }) => {
    setIsEditing(true);
    setEditError(null);

    try {
      const updatedApp = await api.updateApp(appId, data);
      setApps((prev) =>
        prev.map((app) => (app.id === appId ? { ...updatedApp, flowCount: app.flowCount } : app))
      );
      setEditingApp(null);
    } catch (err) {
      if (err instanceof ApiClientError) {
        setEditError(err.message);
      } else {
        setEditError('Failed to update app');
      }
    } finally {
      setIsEditing(false);
    }
  };

  const handleDeleteApp = (app: App) => {
    // Find the app with flow count from our apps array
    const appWithCount = apps.find((a) => a.id === app.id);
    if (appWithCount) {
      setDeletingApp(appWithCount);
    }
  };

  const handleCloseDeleteDialog = () => {
    if (!isDeleting) {
      setDeletingApp(null);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingApp) return;

    setIsDeleting(true);

    try {
      await api.deleteApp(deletingApp.id);
      setApps((prev) => prev.filter((app) => app.id !== deletingApp.id));
      setDeletingApp(null);
    } catch (err) {
      // Error is handled in the dialog via the error state
      // For now we just close the dialog on error
      setDeletingApp(null);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-background">
      {/* Content */}
      <main className="flex-1 p-6">
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Your Apps</h2>
              <p className="text-sm text-muted-foreground">
                {apps.length} app{apps.length !== 1 ? 's' : ''}
              </p>
            </div>
            <button
              onClick={handleOpenModal}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:opacity-90 transition-opacity"
            >
              Create new app
            </button>
          </div>

          {/* Loading state */}
          {isLoading && (
            <div className="flex items-center justify-center py-12">
              <div className="text-center space-y-2">
                <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto" />
                <p className="text-muted-foreground">Loading apps...</p>
              </div>
            </div>
          )}

          {/* Error state */}
          {error && !isLoading && (
            <div className="p-4 bg-destructive/10 text-destructive rounded-lg">
              <p>{error}</p>
              <button
                onClick={() => window.location.reload()}
                className="mt-2 text-sm underline hover:no-underline"
              >
                Try again
              </button>
            </div>
          )}

          {/* App list */}
          {!isLoading && !error && (
            <AppList apps={apps} onAppClick={handleAppClick} onAppEdit={handleEditApp} onAppDelete={handleDeleteApp} />
          )}
        </div>
      </main>

      {/* Create App Modal */}
      <CreateAppModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onSubmit={handleCreateApp}
        isLoading={isCreating}
        error={createError}
      />

      {/* Edit App Modal */}
      <EditAppModal
        isOpen={!!editingApp}
        app={editingApp}
        onClose={handleCloseEditModal}
        onSubmit={handleUpdateApp}
        isLoading={isEditing}
        error={editError}
      />

      {/* Delete App Confirmation */}
      <DeleteConfirmDialog
        isOpen={!!deletingApp}
        onClose={handleCloseDeleteDialog}
        onConfirm={handleConfirmDelete}
        title="Delete App"
        message={`Are you sure you want to delete "${deletingApp?.name}"? This action cannot be undone.`}
        warningMessage={
          deletingApp && deletingApp.flowCount > 0
            ? `This will also delete ${deletingApp.flowCount} flow${deletingApp.flowCount !== 1 ? 's' : ''} and all associated views.`
            : undefined
        }
        isLoading={isDeleting}
      />
    </div>
  );
}

export default Home;
