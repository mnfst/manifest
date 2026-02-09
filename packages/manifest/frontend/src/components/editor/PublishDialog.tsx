import { X, Check } from 'lucide-react';
import type { PublishResult } from '@manifest/shared';
import { Button } from '../ui/shadcn/button';
import { Alert, AlertDescription } from '../ui/shadcn/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/shadcn/dialog';

interface PublishDialogProps {
  result: PublishResult | null;
  error: string | null;
  onClose: () => void;
}

/**
 * Dialog showing publish result or error
 * Uses shadcn Dialog with automatic backdrop click, escape key, and focus trapping
 */
export function PublishDialog({ result, error, onClose }: PublishDialogProps) {
  const isOpen = Boolean(result || error);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        {error ? (
          <>
            <DialogHeader>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center">
                  <X className="w-6 h-6 text-destructive" />
                </div>
                <div>
                  <DialogTitle>Publication Failed</DialogTitle>
                  <DialogDescription>
                    Please fix the following issues
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          </>
        ) : result ? (
          <>
            <DialogHeader>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                  <Check className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <DialogTitle>Published Successfully!</DialogTitle>
                  <DialogDescription>
                    Your app is now available on the MCP server
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <div className="space-y-3">
              <div className="bg-muted rounded-lg p-3">
                <p className="text-xs font-medium text-muted-foreground mb-1">
                  MCP Endpoint
                </p>
                <code className="text-sm font-mono block break-all">
                  {window.location.origin}{result.endpointUrl}
                </code>
              </div>

            </div>

            <div className="text-xs text-muted-foreground">
              <p>
                Connect your AI assistant to this MCP endpoint to use your app as a tool.
              </p>
            </div>
          </>
        ) : null}

        <DialogFooter>
          <Button onClick={onClose}>
            {error ? 'Try Again' : 'Done'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
