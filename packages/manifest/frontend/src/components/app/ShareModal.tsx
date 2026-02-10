import { useState, useEffect } from 'react';
import { BACKEND_URL } from '../../lib/api';
import { Button } from '@/components/ui/shadcn/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/shadcn/dialog';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  appSlug: string;
}

/**
 * Creates an absolute URL for sharing, using window.location.origin when BACKEND_URL is empty or relative.
 * This ensures share URLs work when copied and shared externally.
 */
function getAbsoluteUrl(path: string): string {
  // If BACKEND_URL is empty or relative (starts with /), use the current origin
  if (!BACKEND_URL || BACKEND_URL.startsWith('/')) {
    return `${window.location.origin}${path}`;
  }
  // If BACKEND_URL is already absolute (starts with http), use it directly
  return `${BACKEND_URL}${path}`;
}

/**
 * Modal for sharing app URLs (landing page and MCP endpoint)
 * Only shown when app is published
 */
export function ShareModal({ isOpen, onClose, appSlug }: ShareModalProps) {
  const [copiedMcp, setCopiedMcp] = useState(false);

  const landingPageUrl = getAbsoluteUrl(`/servers/${appSlug}`);
  const mcpEndpointUrl = getAbsoluteUrl(`/servers/${appSlug}/mcp`);

  // Reset copied state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setCopiedMcp(false);
    }
  }, [isOpen]);

  const copyMcpEndpoint = async () => {
    try {
      await navigator.clipboard.writeText(mcpEndpointUrl);
      setCopiedMcp(true);
      setTimeout(() => setCopiedMcp(false), 2000);
    } catch {
      // Clipboard API failed - the URL is still visible and selectable
      console.warn('Clipboard API not available');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Share Your App</DialogTitle>
          <DialogDescription>
            Your app is published and ready to be shared. Users can access it via the landing page or connect directly through the MCP endpoint.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* MCP Endpoint */}
          <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-sm text-green-800 font-medium mb-2">
              MCP Server Endpoint
            </p>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={mcpEndpointUrl}
                className="flex-1 text-sm bg-white px-3 py-2 rounded border font-mono text-green-700 truncate"
                onClick={(e) => (e.target as HTMLInputElement).select()}
              />
              <Button
                onClick={copyMcpEndpoint}
                className="bg-green-600 hover:bg-green-700 min-w-[70px]"
              >
                {copiedMcp ? 'Copied!' : 'Copy'}
              </Button>
            </div>
          </div>

          {/* Landing Page Link */}
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800 font-medium mb-2">
              Landing Page
            </p>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={landingPageUrl}
                className="flex-1 text-sm bg-white px-3 py-2 rounded border text-blue-600 truncate"
                onClick={(e) => (e.target as HTMLInputElement).select()}
              />
              <Button
                asChild
                className="bg-blue-600 hover:bg-blue-700 min-w-[70px]"
              >
                <a
                  href={landingPageUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Open
                </a>
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
