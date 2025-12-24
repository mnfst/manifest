import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { App } from '@chatgpt-app-builder/shared';
import { api, ApiClientError } from '../lib/api';
import { VisualDisplay } from '../components/editor/VisualDisplay';
import { ChatPanel } from '../components/chat/ChatPanel';
import { PublishButton } from '../components/editor/PublishButton';

type DeviceSize = 'phone' | 'tablet' | 'desktop' | 'custom';

const DEVICE_SIZES: Record<DeviceSize, { width: number; height: number; label: string }> = {
  phone: { width: 430, height: 932, label: 'Phone' },
  tablet: { width: 820, height: 1180, label: 'Tablet' },
  desktop: { width: 1280, height: 800, label: 'Desktop' },
  custom: { width: 800, height: 600, label: 'Custom' },
};

/**
 * Editor page - Hybrid view with visual display and chat panel
 * Users can see their app configuration and customize via chat
 */
function Editor() {
  const navigate = useNavigate();
  const [app, setApp] = useState<App | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notification, setNotification] = useState<string | null>(null);
  const [deviceSize, setDeviceSize] = useState<DeviceSize>('desktop');
  const [isDarkMode, setIsDarkMode] = useState(false);

  // Fetch current app on mount
  useEffect(() => {
    const fetchApp = async () => {
      try {
        const currentApp = await api.getCurrentApp();
        setApp(currentApp);
      } catch (err) {
        if (err instanceof ApiClientError && err.status === 404) {
          // No app in session, redirect to home
          navigate('/');
        } else {
          setError('Failed to load app');
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchApp();
  }, [navigate]);

  const handleStartOver = () => {
    navigate('/');
  };

  const handleAppUpdate = (updatedApp: App) => {
    setApp(updatedApp);
    setNotification('App updated!');
    setTimeout(() => setNotification(null), 3000);
  };

  const handlePublish = (publishedApp: App) => {
    setApp(publishedApp);
    setNotification('Published successfully!');
    setTimeout(() => setNotification(null), 3000);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-2">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto" />
          <p className="text-muted-foreground">Loading your app...</p>
        </div>
      </div>
    );
  }

  if (error || !app) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-destructive">{error || 'App not found'}</p>
          <button
            onClick={handleStartOver}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg"
          >
            Start Over
          </button>
        </div>
      </div>
    );
  }

  const currentSize = DEVICE_SIZES[deviceSize];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header - Blue background */}
      <header className="bg-blue-600 text-white px-4 py-3 flex items-center justify-between shadow-md">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold">Manifest</h1>
          {notification && (
            <span className="px-2 py-1 bg-white/20 text-white rounded text-xs font-medium animate-pulse">
              {notification}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <PublishButton app={app} onPublish={handlePublish} />
          <button
            onClick={handleStartOver}
            className="px-3 py-1.5 text-sm bg-white/10 border border-white/30 rounded-lg hover:bg-white/20 transition-colors text-white"
          >
            Start Over
          </button>
        </div>
      </header>

      {/* Main content - Split view */}
      <div className="flex flex-1 h-[calc(100vh-57px)]">
        {/* Chat Panel (left) */}
        <div className="w-80 flex flex-col border-r bg-gray-50">
          <div className="p-4 border-b bg-white">
            <h2 className="font-semibold text-gray-800">Chat</h2>
            <p className="text-xs text-gray-500">
              Ask me to customize your app
            </p>
          </div>
          <div className="flex-1 overflow-hidden">
            <ChatPanel app={app} onAppUpdate={handleAppUpdate} />
          </div>
        </div>

        {/* Visual Display Panel (right - main content area) */}
        <div className="flex-1 overflow-hidden bg-gray-100 flex flex-col">
          {/* Toolbar */}
          <div className="bg-white border-b px-4 py-2 flex items-center justify-between">
            {/* Device Size Selector */}
            <div className="flex items-center gap-1">
              {(Object.keys(DEVICE_SIZES) as DeviceSize[]).map((size) => (
                <button
                  key={size}
                  onClick={() => setDeviceSize(size)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                    deviceSize === size
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {DEVICE_SIZES[size].label}
                </button>
              ))}
              <span className="ml-2 text-xs text-gray-400">
                {currentSize.width} × {currentSize.height}
              </span>
            </div>

            {/* Dark Mode Toggle */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">Dark Mode</span>
              <button
                onClick={() => setIsDarkMode(!isDarkMode)}
                className={`relative w-11 h-6 rounded-full transition-colors ${
                  isDarkMode ? 'bg-blue-600' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                    isDarkMode ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Preview Container */}
          <div className="flex-1 overflow-auto p-6 flex items-start justify-center">
            <div
              className={`bg-white rounded-lg shadow-lg overflow-hidden border transition-all ${
                isDarkMode ? 'dark' : ''
              }`}
              style={{
                width: currentSize.width,
                height: currentSize.height,
                maxWidth: '100%',
                maxHeight: 'calc(100vh - 180px)',
              }}
            >
              <div className={`h-full overflow-auto ${isDarkMode ? 'bg-gray-900' : 'bg-white'}`}>
                <VisualDisplay app={app} isDarkMode={isDarkMode} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Editor;
