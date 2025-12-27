import { useState } from 'react';
import type { AppStatus } from '@chatgpt-app-builder/shared';

interface PublishButtonProps {
  appId: string;
  status: AppStatus;
  onPublish: (appId: string, status: AppStatus) => Promise<void>;
  disabled?: boolean;
  flowCount?: number;
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
  flowCount,
}: PublishButtonProps) {
  const [isUpdating, setIsUpdating] = useState(false);

  const isPublished = status === 'published';
  const hasNoFlows = flowCount !== undefined && flowCount === 0;
  const cannotPublish = hasNoFlows && !isPublished;
  const isDisabled = disabled || cannotPublish;

  const handleClick = async () => {
    if (isDisabled || isUpdating) return;

    setIsUpdating(true);
    try {
      await onPublish(appId, isPublished ? 'draft' : 'published');
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="flex items-center gap-4">
      <div className="relative group">
        <button
          type="button"
          onClick={handleClick}
          disabled={isDisabled || isUpdating}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            isPublished
              ? 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              : 'bg-primary text-primary-foreground hover:bg-primary/90'
          } ${isDisabled || isUpdating ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
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
        {cannotPublish && (
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
            Add at least one flow to publish
            <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
          </div>
        )}
      </div>
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
