import { useState } from 'react';
import type { App, PublishResult } from '@chatgpt-app-builder/shared';
import { api, ApiClientError } from '../../lib/api';
import { PublishDialog } from './PublishDialog';

interface PublishButtonProps {
  app: App;
  onPublish: (app: App) => void;
}

/**
 * Button to publish the current app to MCP server
 */
export function PublishButton({ app, onPublish }: PublishButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [result, setResult] = useState<PublishResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handlePublish = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const publishResult = await api.publishApp();
      setResult(publishResult);
      onPublish(publishResult.app);
      setShowDialog(true);
    } catch (err) {
      if (err instanceof ApiClientError) {
        setError(err.message);
      } else {
        setError('Failed to publish app');
      }
      setShowDialog(true);
    } finally {
      setIsLoading(false);
    }
  };

  const isPublished = app.status === 'published';

  return (
    <>
      <button
        onClick={handlePublish}
        disabled={isLoading}
        className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-colors ${
          isPublished
            ? 'bg-green-500 text-white hover:bg-green-400'
            : 'bg-white text-blue-600 hover:bg-blue-50'
        } disabled:opacity-50 disabled:cursor-not-allowed`}
      >
        {isLoading ? (
          <span className="flex items-center gap-2">
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
                fill="none"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            Publishing...
          </span>
        ) : isPublished ? (
          'Republish'
        ) : (
          'Publish'
        )}
      </button>

      {showDialog && (
        <PublishDialog
          result={result}
          error={error}
          onClose={() => {
            setShowDialog(false);
            setResult(null);
            setError(null);
          }}
        />
      )}
    </>
  );
}
