import { X } from 'lucide-react';
import type { Connection } from '@chatgpt-app-builder/shared';
import type { ConnectionValidationState } from '../../types/schema';
import { ConnectionValidator } from './ConnectionValidator';

interface CompatibilityDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  connection: Connection;
  validation: ConnectionValidationState;
  sourceName?: string;
  targetName?: string;
}

/**
 * Full-screen modal for viewing detailed compatibility information.
 * Shows the ConnectionValidator with all its details in a modal dialog.
 */
export function CompatibilityDetailModal({
  isOpen,
  onClose,
  connection: _connection,
  validation,
  sourceName,
  targetName,
}: CompatibilityDetailModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              Connection Compatibility
            </h2>
            <p className="text-sm text-gray-500">
              {sourceName || 'Source'} → {targetName || 'Target'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <ConnectionValidator
            validation={validation}
            sourceName={sourceName}
            targetName={targetName}
          />
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t bg-gray-50 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
