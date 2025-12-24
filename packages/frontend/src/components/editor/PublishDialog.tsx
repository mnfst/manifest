import type { PublishResult } from '@chatgpt-app-builder/shared';

interface PublishDialogProps {
  result: PublishResult | null;
  error: string | null;
  onClose: () => void;
}

/**
 * Dialog showing publish result or error
 */
export function PublishDialog({ result, error, onClose }: PublishDialogProps) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-background rounded-lg shadow-lg max-w-md w-full p-6 space-y-4">
        {error ? (
          <>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center">
                <svg
                  className="w-6 h-6 text-destructive"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-lg">Publication Failed</h3>
                <p className="text-sm text-muted-foreground">
                  Please fix the following issues
                </p>
              </div>
            </div>
            <div className="bg-destructive/10 text-destructive rounded-lg p-3 text-sm">
              {error}
            </div>
          </>
        ) : result ? (
          <>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                <svg
                  className="w-6 h-6 text-green-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-lg">Published Successfully!</h3>
                <p className="text-sm text-muted-foreground">
                  Your app is now available on the MCP server
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="bg-muted rounded-lg p-3">
                <p className="text-xs font-medium text-muted-foreground mb-1">
                  MCP Endpoint
                </p>
                <code className="text-sm font-mono block break-all">
                  {window.location.origin}{result.endpointUrl}
                </code>
              </div>

              <div className="bg-muted rounded-lg p-3">
                <p className="text-xs font-medium text-muted-foreground mb-1">
                  UI Component URL
                </p>
                <code className="text-sm font-mono block break-all">
                  {window.location.origin}{result.uiUrl}
                </code>
              </div>

              {result.app.toolName && (
                <div className="bg-muted rounded-lg p-3">
                  <p className="text-xs font-medium text-muted-foreground mb-1">
                    Tool Name
                  </p>
                  <code className="text-sm font-mono">{result.app.toolName}</code>
                </div>
              )}
            </div>

            <div className="text-xs text-muted-foreground">
              <p>
                Connect your AI assistant to this MCP endpoint to use your app as a tool.
              </p>
            </div>
          </>
        ) : null}

        <div className="flex justify-end pt-2">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90"
          >
            {error ? 'Try Again' : 'Done'}
          </button>
        </div>
      </div>
    </div>
  );
}
