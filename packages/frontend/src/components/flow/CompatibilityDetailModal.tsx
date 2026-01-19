import { useState, useEffect, useCallback } from 'react';
import { X, Shuffle } from 'lucide-react';
import type { Connection, NodeType } from '@manifest/shared';
import { Button } from '@/components/ui/shadcn/button';
import type { ConnectionValidationState } from '../../types/schema';
import { ConnectionValidator } from './ConnectionValidator';
import { AddTransformerModal } from './AddTransformerModal';
import { useInsertTransformer } from '../../hooks/useInsertTransformer';

interface CompatibilityDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  connection: Connection;
  validation: ConnectionValidationState;
  sourceName?: string;
  targetName?: string;
  flowId: string;
  onTransformerInserted?: () => void;
}

/**
 * Full-screen modal for viewing detailed compatibility information.
 * Shows the ConnectionValidator with all its details in a modal dialog.
 * Allows adding a transformer when there are compatibility issues.
 */
export function CompatibilityDetailModal({
  isOpen,
  onClose,
  connection,
  validation,
  sourceName,
  targetName,
  flowId,
  onTransformerInserted,
}: CompatibilityDetailModalProps) {
  const [showAddTransformer, setShowAddTransformer] = useState(false);
  const { insertTransformer, isLoading, error, reset } = useInsertTransformer(flowId);

  // Handle Escape key to close modal
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  }, [onClose]);

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  // Show "Add a transformer" button for error or warning status
  const showTransformerButton =
    validation.status === 'error' || validation.status === 'warning';

  const handleAddTransformerClick = () => {
    reset();
    setShowAddTransformer(true);
  };

  const handleTransformerSelect = async (transformerType: NodeType) => {
    const result = await insertTransformer(
      connection.sourceNodeId,
      connection.targetNodeId,
      transformerType
    );

    if (result) {
      setShowAddTransformer(false);
      onClose();
      onTransformerInserted?.();
    }
  };

  const handleCloseAddTransformer = () => {
    setShowAddTransformer(false);
    reset();
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        {/* Backdrop */}
        <div
          className="absolute inset-0 bg-black/50"
          onClick={onClose}
          aria-hidden="true"
        />

        {/* Modal */}
        <div className="relative bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
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
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              aria-label="Close modal"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            <ConnectionValidator
              validation={validation}
              sourceName={sourceName}
              targetName={targetName}
            />

            {/* Add Transformer suggestion */}
            {showTransformerButton && (
              <div className="mt-6 p-4 bg-teal-50 border border-teal-200 rounded-lg">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-teal-100 flex items-center justify-center flex-shrink-0">
                    <Shuffle className="w-5 h-5 text-teal-600" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-medium text-gray-900">
                      Resolve with a Transformer
                    </h4>
                    <p className="text-sm text-gray-600 mt-1">
                      Add a transformer node between these two nodes to convert
                      the data format and resolve the compatibility issues.
                    </p>
                    <Button
                      onClick={handleAddTransformerClick}
                      className="mt-3 bg-teal-600 hover:bg-teal-700"
                    >
                      Add a Transformer
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t bg-gray-50 flex justify-end">
            <Button
              variant="outline"
              onClick={onClose}
            >
              Close
            </Button>
          </div>
        </div>
      </div>

      {/* Add Transformer Modal */}
      <AddTransformerModal
        isOpen={showAddTransformer}
        onClose={handleCloseAddTransformer}
        onSelect={handleTransformerSelect}
        suggestedTransformers={validation.suggestedTransformers}
        isInserting={isLoading}
        insertError={error}
      />
    </>
  );
}
