import { useState, useEffect } from 'react';
import { Loader2, Shuffle, AlertCircle } from 'lucide-react';
import type { NodeType, SuggestedTransformer } from '@manifest/shared';
import { api, type NodeTypeInfo } from '../../lib/api';
import { Button } from '@/components/ui/shadcn/button';
import { Badge } from '@/components/ui/shadcn/badge';
import { Alert, AlertDescription } from '@/components/ui/shadcn/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/shadcn/dialog';

interface AddTransformerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (transformerType: NodeType) => void;
  suggestedTransformers?: SuggestedTransformer[];
  isInserting?: boolean;
  insertError?: string | null;
}

/**
 * Modal for selecting a transformer node to insert between incompatible nodes.
 * Shows suggested transformers from the validation result and allows browsing all transform nodes.
 */
export function AddTransformerModal({
  isOpen,
  onClose,
  onSelect,
  suggestedTransformers,
  isInserting = false,
  insertError = null,
}: AddTransformerModalProps) {
  const [transformNodes, setTransformNodes] = useState<NodeTypeInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch transform category nodes
  useEffect(() => {
    if (!isOpen) return;

    const fetchTransformNodes = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await api.getNodeTypes();
        // Filter to only transform category nodes
        const transforms = response.nodeTypes.filter(
          (n) => n.category === 'transform'
        );
        setTransformNodes(transforms);
      } catch (err) {
        setError('Failed to load transformer types');
        console.error('Error fetching transform nodes:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchTransformNodes();
  }, [isOpen]);

  const handleOpenChange = (open: boolean) => {
    if (!open && !isInserting) {
      onClose();
    }
  };

  // Get confidence badge styling
  const getConfidenceBadgeClass = (confidence: 'high' | 'medium' | 'low') => {
    switch (confidence) {
      case 'high':
        return 'bg-green-100 text-green-700 hover:bg-green-100';
      case 'medium':
        return 'bg-yellow-100 text-yellow-700 hover:bg-yellow-100';
      case 'low':
        return 'bg-gray-100 text-gray-600 hover:bg-gray-100';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Add Transformer</DialogTitle>
          <DialogDescription>
            Select a transformer to convert data between nodes
          </DialogDescription>
        </DialogHeader>

        <div className="overflow-y-auto flex-1 py-4">
          {/* Error from insertion */}
          {insertError && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{insertError}</AlertDescription>
            </Alert>
          )}

          {/* Loading state */}
          {loading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
              <span className="ml-2 text-sm text-gray-500">
                Loading transformers...
              </span>
            </div>
          )}

          {/* Error state */}
          {!loading && error && (
            <div className="text-center py-8">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {/* Transformer list */}
          {!loading && !error && (
            <div className="space-y-4">
              {/* Suggested transformers section */}
              {suggestedTransformers && suggestedTransformers.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                    Recommended
                  </h3>
                  <div className="space-y-2">
                    {suggestedTransformers.map((transformer) => (
                      <button
                        key={transformer.nodeType}
                        onClick={() =>
                          onSelect(transformer.nodeType as NodeType)
                        }
                        disabled={isInserting}
                        className="w-full flex items-start gap-4 p-3 rounded-lg border-2 border-teal-200 hover:border-teal-400 transition-colors transition-shadow hover:shadow-md text-left disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <div className="w-10 h-10 rounded-lg bg-teal-50 flex items-center justify-center flex-shrink-0">
                          <Shuffle className="w-5 h-5 text-teal-600" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium text-gray-900 text-sm">
                              {transformer.displayName}
                            </h4>
                            <Badge className={getConfidenceBadgeClass(transformer.confidence)}>
                              {transformer.confidence} confidence
                            </Badge>
                          </div>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {transformer.description}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* All transform nodes section */}
              {transformNodes.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                    {suggestedTransformers && suggestedTransformers.length > 0
                      ? 'All Transformers'
                      : 'Available Transformers'}
                  </h3>
                  <div className="space-y-2">
                    {transformNodes
                      .filter(
                        (n) =>
                          !suggestedTransformers?.some(
                            (s) => s.nodeType === n.name
                          )
                      )
                      .map((node) => (
                        <button
                          key={node.name}
                          onClick={() => onSelect(node.name as NodeType)}
                          disabled={isInserting}
                          className="w-full flex items-start gap-4 p-3 rounded-lg border-2 border-gray-200 hover:border-teal-400 transition-colors transition-shadow hover:shadow-md text-left disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <div className="w-10 h-10 rounded-lg bg-teal-50 flex items-center justify-center flex-shrink-0">
                            <Shuffle className="w-5 h-5 text-teal-600" />
                          </div>
                          <div className="flex-1">
                            <h4 className="font-medium text-gray-900 text-sm">
                              {node.displayName}
                            </h4>
                            <p className="text-xs text-gray-500 mt-0.5">
                              {node.description}
                            </p>
                          </div>
                        </button>
                      ))}
                  </div>
                </div>
              )}

              {/* No transformers available */}
              {transformNodes.length === 0 && (
                <div className="text-center py-8">
                  <p className="text-sm text-gray-500">
                    No transformer nodes available
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={isInserting}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
