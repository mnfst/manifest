import { useState } from 'react';
import { Shuffle } from 'lucide-react';
import type { Connection, NodeType } from '@manifest/shared';
import { Button } from '@/components/ui/shadcn/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/shadcn/dialog';
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
 * Modal for viewing detailed compatibility information.
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

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      onClose();
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Connection Compatibility</DialogTitle>
            <DialogDescription>
              {sourceName || 'Source'} → {targetName || 'Target'}
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto py-4">
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

          <DialogFooter>
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
