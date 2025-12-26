import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppForm } from '../components/app/AppForm';
import { api, ApiClientError } from '../lib/api';

/**
 * Home page - App creation entry point
 * Users create an app with name and description
 */
function Home() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (data: { name: string; description?: string }) => {
    setIsLoading(true);
    setError(null);

    try {
      const app = await api.createApp(data);
      navigate(`/app/${app.id}`);
    } catch (err) {
      if (err instanceof ApiClientError) {
        setError(err.message);
      } else {
        setError('An unexpected error occurred. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="max-w-2xl w-full space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold tracking-tight">
            Manifest
          </h1>
          <p className="text-muted-foreground text-lg">
            Create MCP servers for ChatGPT apps
          </p>
        </div>

        <div className="bg-card border rounded-lg p-6 space-y-4">
          <AppForm onSubmit={handleSubmit} isLoading={isLoading} />

          {error && (
            <div className="p-3 bg-destructive/10 text-destructive rounded-lg text-sm">
              {error}
            </div>
          )}
        </div>

        <div className="text-center text-sm text-muted-foreground space-y-2">
          <p>
            <strong>Tip:</strong> Start by naming your app, then add flows (MCP tools) with AI assistance.
          </p>
          <div className="flex flex-wrap gap-2 justify-center">
            <span className="px-2 py-1 bg-muted rounded text-xs">Product catalog</span>
            <span className="px-2 py-1 bg-muted rounded text-xs">Order tracking</span>
            <span className="px-2 py-1 bg-muted rounded text-xs">Blog posts</span>
            <span className="px-2 py-1 bg-muted rounded text-xs">Support tickets</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Home;
