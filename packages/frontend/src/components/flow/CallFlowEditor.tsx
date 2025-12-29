import { useEffect, useRef, useState } from 'react';
import { PhoneForwarded, X, AlertCircle } from 'lucide-react';
import type { CallFlow, Flow } from '@chatgpt-app-builder/shared';

interface CallFlowEditorProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (targetFlowId: string) => void;
  callFlow?: CallFlow | null;
  currentFlowId: string;
  availableFlows: Flow[];
  isLoading?: boolean;
  error?: string | null;
}

/**
 * Modal for creating/editing a call flow
 * Allows selecting a target flow from the same app to call
 */
export function CallFlowEditor({
  isOpen,
  onClose,
  onSave,
  callFlow,
  currentFlowId,
  availableFlows,
  isLoading = false,
  error,
}: CallFlowEditorProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const [targetFlowId, setTargetFlowId] = useState(callFlow?.targetFlowId || '');

  const isEditing = Boolean(callFlow);

  // Filter out current flow from available flows
  const selectableFlows = availableFlows.filter(f => f.id !== currentFlowId);

  // Reset form when callFlow changes or modal opens
  useEffect(() => {
    if (isOpen) {
      setTargetFlowId(callFlow?.targetFlowId || '');
    }
  }, [isOpen, callFlow]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isLoading) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, isLoading, onClose]);

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

  if (!isOpen) return null;

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && !isLoading) {
      onClose();
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetFlowId) return;
    onSave(targetFlowId);
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
        aria-labelledby="call-flow-title"
      >
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-md bg-purple-100 flex items-center justify-center">
              <PhoneForwarded className="w-4 h-4 text-purple-600" />
            </div>
            <h2 id="call-flow-title" className="text-lg font-semibold">
              {isEditing ? 'Edit Call Flow' : 'Add Call Flow'}
            </h2>
          </div>
          <button
            onClick={onClose}
            disabled={isLoading}
            className="p-1 text-muted-foreground hover:text-foreground rounded transition-colors disabled:opacity-50"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <p className="text-sm text-muted-foreground">
            Select a flow to call when this action executes. The target flow will be triggered
            using the ChatGPT SDK's callTool API.
          </p>

          {selectableFlows.length === 0 ? (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-amber-800">No other flows available</p>
                <p className="text-xs text-amber-600 mt-1">
                  Create another flow in this app first to use the Call Flow action.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <label htmlFor="targetFlow" className="block text-sm font-medium">
                Target Flow <span className="text-red-500">*</span>
              </label>
              <select
                id="targetFlow"
                value={targetFlowId}
                onChange={(e) => setTargetFlowId(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                required
                disabled={isLoading}
              >
                <option value="">Select a flow to call...</option>
                {selectableFlows.map((flow) => (
                  <option key={flow.id} value={flow.id}>
                    {flow.name}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">
                The selected flow will be invoked when this end action executes.
              </p>
            </div>
          )}

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="px-4 py-2 text-sm font-medium border rounded-lg hover:bg-muted transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading || !targetFlowId || selectableFlows.length === 0}
              className="px-4 py-2 text-sm font-medium bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {isLoading && (
                <svg
                  className="w-4 h-4 animate-spin"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
              )}
              {isEditing ? 'Save' : 'Add'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
