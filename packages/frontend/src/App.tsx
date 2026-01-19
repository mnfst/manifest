import { useEffect, useState, Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { Sidebar } from './components/layout/Sidebar';
import { AuthPage } from './pages/AuthPage';
import { AuthProvider } from './components/auth/AuthProvider';
import { api } from './lib/api';
import type { App } from '@manifest/shared';

// Lazy-loaded page components for better initial bundle size
const AppDetail = lazy(() => import('./pages/AppDetail'));
const FlowDetail = lazy(() => import('./pages/FlowDetail'));
const SettingsPage = lazy(() => import('./pages/SettingsPage').then(m => ({ default: m.SettingsPage })));
const VerifyEmailChangePage = lazy(() => import('./pages/VerifyEmailChangePage').then(m => ({ default: m.VerifyEmailChangePage })));
const AcceptInvitePage = lazy(() => import('./pages/AcceptInvitePage').then(m => ({ default: m.AcceptInvitePage })));
const AppSettingsPage = lazy(() => import('./pages/AppSettingsPage').then(m => ({ default: m.AppSettingsPage })));

/**
 * Loading fallback component for lazy-loaded routes
 */
function PageLoader() {
  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary" />
        <span className="text-sm text-muted-foreground">Loading…</span>
      </div>
    </div>
  );
}

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
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/" element={<HomeRedirect />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/verify-email-change" element={<VerifyEmailChangePage />} />
              <Route path="/app/:appId" element={<AppDetail />} />
              <Route path="/app/:appId/flows" element={<AppDetail />} />
              <Route path="/app/:appId/analytics" element={<AppDetail />} />
              <Route path="/app/:appId/collaborators" element={<AppDetail />} />
              <Route path="/app/:appId/theme" element={<AppDetail />} />
              <Route path="/app/:appId/settings" element={<AppSettingsPage />} />
              <Route path="/app/:appId/flow/:flowId" element={<FlowDetail />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
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
      <Suspense fallback={<PageLoader />}>
        <AcceptInvitePage />
      </Suspense>
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
