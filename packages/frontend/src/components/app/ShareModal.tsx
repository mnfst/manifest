import { useEffect, useRef, useState } from 'react';
import { BACKEND_URL } from '../../lib/api';
import { Button } from '@/components/ui/shadcn/button';

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
  const modalRef = useRef<HTMLDivElement>(null);
  const [copiedMcp, setCopiedMcp] = useState(false);

  const landingPageUrl = getAbsoluteUrl(`/servers/${appSlug}`);
  const mcpEndpointUrl = getAbsoluteUrl(`/servers/${appSlug}/mcp`);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Reset copied state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setCopiedMcp(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={handleBackdropClick}
    >
      <div
        ref={modalRef}
        className="bg-card border rounded-lg shadow-lg w-full max-w-lg animate-in fade-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-modal-title"
      >
        <div className="flex items-center justify-between p-4 border-b">
          <h2 id="share-modal-title" className="text-lg font-semibold">
            Share Your App
          </h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label="Close modal"
          >
            <svg
              className="w-5 h-5"
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
          </Button>
        </div>

        <div className="p-4 space-y-4">
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

          <p className="text-xs text-muted-foreground">
            Your app is published and ready to be shared. Users can access it via the landing page or connect directly through the MCP endpoint.
          </p>
        </div>
      </div>
    </div>
  );
}
