import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { App } from '@chatgpt-app-builder/shared';
import { AppList } from '../components/app/AppList';
import { CreateAppModal } from '../components/app/CreateAppModal';
import { api, ApiClientError } from '../lib/api';

/**
 * Home page - App list and creation
 * Users see all existing apps and can create new ones
 */
function Home() {
  const navigate = useNavigate();
  const [apps, setApps] = useState<App[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

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
      setApps((prev) => [newApp, ...prev]);
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

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Manifest</h1>
              <p className="text-sm text-muted-foreground">
                Create MCP servers for ChatGPT apps
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-6xl mx-auto px-4 py-8">
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
            <AppList apps={apps} onAppClick={handleAppClick} />
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
    </div>
  );
}

export default Home;
