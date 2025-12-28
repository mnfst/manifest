import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import type { App, Flow, View } from '@chatgpt-app-builder/shared';
import { DEFAULT_TABLE_MOCK_DATA, DEFAULT_POST_LIST_MOCK_DATA } from '@chatgpt-app-builder/shared';
import { api, ApiClientError } from '../lib/api';
import { ViewChatPanel } from '../components/view/ViewChatPanel';
import { ThemeProvider } from '../components/editor/ThemeProvider';
import { LayoutRenderer } from '../components/editor/LayoutRenderer';
import { Header } from '../components/layout/Header';
import { ChatStyleWrapper } from '../components/preview/ChatStyleWrapper';
import { PlatformStyleSelector } from '../components/preview/PlatformStyleSelector';
import { usePreviewPreferences } from '../hooks/usePreviewPreferences';

type DeviceSize = 'phone' | 'tablet' | 'desktop';

const DEVICE_SIZES: Record<DeviceSize, { width: number; height: number; label: string }> = {
  phone: { width: 430, height: 932, label: 'Phone' },
  tablet: { width: 820, height: 1180, label: 'Tablet' },
  desktop: { width: 1280, height: 800, label: 'Desktop' },
};

/**
 * View editor page - Edit a specific view with chat interface
 * Layout: Chat panel left, component preview right
 */
function ViewEditor() {
  const { appId, flowId, viewId } = useParams<{ appId: string; flowId: string; viewId: string }>();
  const navigate = useNavigate();
  const [app, setApp] = useState<App | null>(null);
  const [flow, setFlow] = useState<Flow | null>(null);
  const [view, setView] = useState<View | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deviceSize, setDeviceSize] = useState<DeviceSize>('desktop');
  const [notification, setNotification] = useState<string | null>(null);
  const { platformStyle, themeMode, setPlatformStyle, toggleThemeMode } = usePreviewPreferences();
  const isDarkMode = themeMode === 'dark';

  // Fetch app, flow, and view on mount
  useEffect(() => {
    const fetchData = async () => {
      if (!appId || !flowId || !viewId) {
        setError('Missing required parameters');
        setIsLoading(false);
        return;
      }

      try {
        const [appData, flowData, viewData] = await Promise.all([
          api.getApp(appId),
          api.getFlow(flowId),
          api.getView(viewId),
        ]);
        setApp(appData);
        setFlow(flowData);
        setView(viewData);
      } catch (err) {
        if (err instanceof ApiClientError) {
          setError(err.message);
        } else {
          setError('Failed to load view data');
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [appId, flowId, viewId]);

  const handleViewUpdate = (updatedView: View) => {
    setView(updatedView);
    setNotification('View updated!');
    setTimeout(() => setNotification(null), 3000);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-2">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto" />
          <p className="text-muted-foreground">Loading view...</p>
        </div>
      </div>
    );
  }

  if (error || !app || !flow || !view) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-destructive">{error || 'View not found'}</p>
          <button
            onClick={() => navigate(`/app/${appId}`)}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg"
          >
            Back to App
          </button>
        </div>
      </div>
    );
  }

  const currentSize = DEVICE_SIZES[deviceSize];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Global Header with App Switcher */}
      <Header currentApp={app} />

      {/* View Sub-header with Breadcrumb */}
      <div className="bg-muted/50 border-b px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* Breadcrumb */}
          <nav className="flex items-center gap-2 text-sm">
            <Link to={`/app/${appId}`} className="text-muted-foreground hover:text-foreground">
              {app.name}
            </Link>
            <span className="text-muted-foreground">/</span>
            <Link to={`/app/${appId}/flow/${flowId}`} className="text-muted-foreground hover:text-foreground">
              {flow.name}
            </Link>
            <span className="text-muted-foreground">/</span>
            <span className="font-medium">{view.name || 'View'}</span>
          </nav>
          {notification && (
            <span className="px-2 py-1 bg-primary/20 text-primary rounded text-xs font-medium animate-pulse">
              {notification}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Link
            to={`/app/${appId}/flow/${flowId}`}
            className="px-3 py-1.5 text-sm border rounded-lg hover:bg-muted transition-colors"
          >
            Back to Flow
          </Link>
        </div>
      </div>

      {/* Main content - Split view */}
      <div className="flex flex-1 h-[calc(100vh-100px)]">
        {/* Chat Panel (left) */}
        <div className="w-80 flex flex-col border-r bg-gray-50">
          <div className="p-4 border-b bg-white">
            <h2 className="font-semibold text-gray-800">Customize View</h2>
            <p className="text-xs text-gray-500">
              Ask me to modify this view's layout and data
            </p>
          </div>
          <div className="flex-1 overflow-hidden">
            <ViewChatPanel view={view} onViewUpdate={handleViewUpdate} />
          </div>
        </div>

        {/* Visual Display Panel (right) */}
        <div className="flex-1 overflow-hidden bg-gray-100 flex flex-col">
          {/* Toolbar */}
          <div className="bg-white border-b px-4 py-2 flex items-center justify-between">
            {/* Left: Device Size + Platform Style */}
            <div className="flex items-center gap-4">
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

              {/* Platform Style Selector */}
              <div className="border-l pl-4">
                <PlatformStyleSelector
                  value={platformStyle}
                  onChange={setPlatformStyle}
                />
              </div>
            </div>

            {/* Right: Template Badge + Dark Mode Toggle */}
            <div className="flex items-center gap-4">
              {/* Template Badge */}
              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                {view.layoutTemplate}
              </span>

              {/* Dark Mode Toggle */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">Dark</span>
                <button
                  onClick={toggleThemeMode}
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
          </div>

          {/* Preview Container */}
          <div className="flex-1 overflow-auto p-6 flex items-start justify-center">
            <div
              className="rounded-lg shadow-lg overflow-hidden transition-all"
              style={{
                width: currentSize.width,
                height: currentSize.height,
                maxWidth: '100%',
                maxHeight: 'calc(100vh - 180px)',
              }}
            >
              <ChatStyleWrapper
                platformStyle={platformStyle}
                themeMode={themeMode}
                app={{ name: app.name, logoUrl: app.logoUrl }}
              >
                <ThemeProvider themeVariables={app.themeVariables} isDarkMode={isDarkMode}>
                  <LayoutRenderer
                    layoutTemplate={view.layoutTemplate}
                    mockData={view.mockData?.data || (view.layoutTemplate === 'table' ? DEFAULT_TABLE_MOCK_DATA : DEFAULT_POST_LIST_MOCK_DATA)}
                    isDarkMode={isDarkMode}
                  />
                </ThemeProvider>
              </ChatStyleWrapper>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ViewEditor;
