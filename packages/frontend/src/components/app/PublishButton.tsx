import { useState } from 'react';
import type { AppStatus } from '@chatgpt-app-builder/shared';

interface PublishButtonProps {
  appId: string;
  status: AppStatus;
  onPublish: (appId: string, status: AppStatus) => Promise<void>;
  disabled?: boolean;
}

/**
 * Button to publish/unpublish an app
 * Shows different states and MCP endpoint URL when published
 */
export function PublishButton({
  appId,
  status,
  onPublish,
  disabled = false,
}: PublishButtonProps) {
  const [isUpdating, setIsUpdating] = useState(false);

  const isPublished = status === 'published';

  const handleClick = async () => {
    if (disabled || isUpdating) return;

    setIsUpdating(true);
    try {
      await onPublish(appId, isPublished ? 'draft' : 'published');
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="flex items-center gap-4">
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled || isUpdating}
        className={`px-4 py-2 rounded-lg font-medium transition-colors ${
          isPublished
            ? 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            : 'bg-primary text-primary-foreground hover:bg-primary/90'
        } ${disabled || isUpdating ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
      >
        {isUpdating ? (
          <span className="flex items-center gap-2">
            <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
            {isPublished ? 'Unpublishing...' : 'Publishing...'}
          </span>
        ) : isPublished ? (
          'Unpublish'
        ) : (
          'Publish'
        )}
      </button>
      {isPublished && (
        <div className="flex items-center gap-2 text-sm">
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
            <span className="w-2 h-2 bg-green-500 rounded-full" />
            Published
          </span>
        </div>
      )}
    </div>
  );
}
