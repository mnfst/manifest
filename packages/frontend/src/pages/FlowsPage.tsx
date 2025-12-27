import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { FlowWithApp } from '@chatgpt-app-builder/shared';
import { FlowCardWithApp } from '../components/flow/FlowCardWithApp';
import { api, ApiClientError } from '../lib/api';

/**
 * Flows page - Lists all flows across all apps
 * Accessible from the sidebar "Flows" shortcut
 */
function FlowsPage() {
  const [flows, setFlows] = useState<FlowWithApp[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadFlows() {
      setIsLoading(true);
      setError(null);

      try {
        const loadedFlows = await api.getAllFlows();
        setFlows(loadedFlows);
      } catch (err) {
        if (err instanceof ApiClientError) {
          setError(err.message);
        } else {
          setError('Failed to load flows');
        }
      } finally {
        setIsLoading(false);
      }
    }

    loadFlows();
  }, []);

  return (
    <div className="flex-1 flex flex-col bg-background">
      <main className="flex-1 p-6">
        <div className="space-y-6">
          {/* Page header */}
          <div>
            <h1 className="text-2xl font-bold">All Flows</h1>
            <p className="text-sm text-muted-foreground">
              {flows.length} flow{flows.length !== 1 ? 's' : ''} across all apps
            </p>
          </div>

          {/* Loading state */}
          {isLoading && (
            <div className="flex items-center justify-center py-12">
              <div className="text-center space-y-2">
                <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto" />
                <p className="text-muted-foreground">Loading flows...</p>
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

          {/* Empty state */}
          {!isLoading && !error && flows.length === 0 && (
            <div className="text-center py-12 border rounded-lg bg-card">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8 text-muted-foreground">
                  <path fillRule="evenodd" d="M3 6a3 3 0 013-3h12a3 3 0 013 3v12a3 3 0 01-3 3H6a3 3 0 01-3-3V6zm4.5 7.5a.75.75 0 01.75.75v2.25a.75.75 0 01-1.5 0v-2.25a.75.75 0 01.75-.75zm3.75-1.5a.75.75 0 00-1.5 0v4.5a.75.75 0 001.5 0V12zm2.25-3a.75.75 0 01.75.75v6.75a.75.75 0 01-1.5 0V9.75A.75.75 0 0113.5 9zm3.75-1.5a.75.75 0 00-1.5 0v9a.75.75 0 001.5 0v-9z" clipRule="evenodd" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold mb-2">No flows yet</h3>
              <p className="text-muted-foreground mb-4">
                Create an app and add flows to see them here.
              </p>
              <Link
                to="/"
                className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:opacity-90 transition-opacity"
              >
                Go to Apps
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                  <path fillRule="evenodd" d="M3 10a.75.75 0 01.75-.75h10.638L10.23 5.29a.75.75 0 111.04-1.08l5.5 5.25a.75.75 0 010 1.08l-5.5 5.25a.75.75 0 11-1.04-1.08l4.158-3.96H3.75A.75.75 0 013 10z" clipRule="evenodd" />
                </svg>
              </Link>
            </div>
          )}

          {/* Flows list */}
          {!isLoading && !error && flows.length > 0 && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {flows.map((flow) => (
                <FlowCardWithApp key={flow.id} flow={flow} />
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default FlowsPage;
