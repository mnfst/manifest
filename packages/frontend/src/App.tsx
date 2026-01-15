import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import AppDetail from './pages/AppDetail';
import FlowDetail from './pages/FlowDetail';
import { SettingsPage } from './pages/SettingsPage';
import { VerifyEmailChangePage } from './pages/VerifyEmailChangePage';
import { Sidebar } from './components/layout/Sidebar';
import { AuthPage } from './pages/AuthPage';
import { AcceptInvitePage } from './pages/AcceptInvitePage';
import { AuthProvider } from './components/auth/AuthProvider';
import { api } from './lib/api';
import type { App } from '@chatgpt-app-builder/shared';

/**
 * Home redirect component
 * Redirects to the first app if any exist, otherwise shows prompt
 */
function HomeRedirect() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [hasApps, setHasApps] = useState<boolean | null>(null);

  useEffect(() => {
    api.listApps()
      .then((apps: App[]) => {
        if (apps.length > 0) {
          // Redirect to first app
          navigate(`/app/${apps[0].id}`, { replace: true });
        } else {
          setHasApps(false);
        }
      })
      .catch(() => {
        setHasApps(false);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [navigate]);

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (hasApps === false) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="text-lg text-muted-foreground">No apps yet</div>
          <p className="text-sm text-muted-foreground">
            Use the app selector in the sidebar to create your first app.
          </p>
        </div>
      </div>
    );
  }

  return null;
}

/**
 * Protected routes wrapper - requires authentication
 */
function ProtectedRoutes() {
  return (
    <AuthProvider>
      <div className="flex min-h-screen bg-background">
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <Routes>
            <Route path="/" element={<HomeRedirect />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/verify-email-change" element={<VerifyEmailChangePage />} />
            <Route path="/app/:appId" element={<AppDetail />} />
            <Route path="/app/:appId/flows" element={<AppDetail />} />
            <Route path="/app/:appId/analytics" element={<AppDetail />} />
            <Route path="/app/:appId/collaborators" element={<AppDetail />} />
            <Route path="/app/:appId/theme" element={<AppDetail />} />
            <Route path="/app/:appId/flow/:flowId" element={<FlowDetail />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </div>
    </AuthProvider>
  );
}

/**
 * Root application component with routing
 * Routes follow App → Flow → View hierarchy
 * Sidebar provides persistent navigation across all pages
 * Auth page is public, all other routes require authentication
 */
/**
 * Accept invite page wrapped with AuthProvider but without sidebar
 * Needs auth context to check if user is logged in
 */
function AcceptInviteWrapper() {
  return (
    <AuthProvider>
      <AcceptInvitePage />
    </AuthProvider>
  );
}

/**
 * Root application component with routing
 * Routes follow App -> Flow -> View hierarchy
 * Sidebar provides persistent navigation across all pages
 * Auth page is public, all other routes require authentication
 */
function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/auth" element={<AuthPage />} />
        <Route path="/accept-invite" element={<AcceptInviteWrapper />} />
        <Route path="/*" element={<ProtectedRoutes />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
