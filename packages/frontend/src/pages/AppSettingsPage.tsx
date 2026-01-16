import { useState, useEffect } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import { KeyRound } from 'lucide-react';
import type { App } from '@chatgpt-app-builder/shared';
import { api, ApiClientError, resolveIconUrl } from '../lib/api';
import { Tabs } from '../components/common/Tabs';
import { SecretsTab } from '../components/settings/SecretsTab';
import type { AppSettingsTab, AppSettingsTabConfig } from '../types/tabs';

/**
 * App Settings page - Manage app-specific settings like secrets
 * Route: /app/:appId/settings
 */
export function AppSettingsPage() {
  const { appId } = useParams<{ appId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabFromUrl = searchParams.get('tab') as AppSettingsTab | null;
  const [activeTab, setActiveTab] = useState<AppSettingsTab>(tabFromUrl || 'secrets');
  const [app, setApp] = useState<App | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Sync tab state with URL
  useEffect(() => {
    if (tabFromUrl && ['secrets'].includes(tabFromUrl)) {
      setActiveTab(tabFromUrl);
    }
  }, [tabFromUrl]);

  // Load app data
  useEffect(() => {
    async function loadApp() {
      if (!appId) return;

      setIsLoading(true);
      setError(null);

      try {
        const loadedApp = await api.getApp(appId);
        setApp(loadedApp);
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

    loadApp();
  }, [appId]);

  const handleTabChange = (tab: AppSettingsTab) => {
    setActiveTab(tab);
    setSearchParams({ tab });
  };

  const tabs: AppSettingsTabConfig[] = [
    { id: 'secrets', label: 'Secrets', icon: KeyRound },
  ];

  if (isLoading) {
    return (
      <div className="h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="text-destructive">{error}</div>
          <Link to="/" className="text-primary hover:underline">
            Go back home
          </Link>
        </div>
      </div>
    );
  }

  if (!app || !appId) {
    return (
      <div className="h-screen bg-background flex items-center justify-center">
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
    <div className="h-screen bg-background flex flex-col overflow-hidden">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="px-6 py-4">
          <div className="flex items-center gap-3">
            {/* App Icon */}
            {app.logoUrl && (
              <img
                src={resolveIconUrl(app.logoUrl)}
                alt={app.name}
                className="w-8 h-8 rounded-lg object-cover"
              />
            )}
            <div>
              <h1 className="text-2xl font-bold">{app.name} Settings</h1>
              <p className="text-muted-foreground mt-1">
                Configure settings for this app
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs and Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <div className="px-6 bg-white flex justify-center border-b">
          <Tabs activeTab={activeTab} onTabChange={handleTabChange} tabs={tabs} />
        </div>

        <div className="flex-1 overflow-auto p-6">
          {activeTab === 'secrets' && (
            <div className="max-w-4xl mx-auto">
              <SecretsTab appId={appId} />
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default AppSettingsPage;
