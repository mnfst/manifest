import { useState, useEffect } from 'react';
import { X, Loader2, Shuffle, AlertCircle } from 'lucide-react';
import type { NodeType, SuggestedTransformer } from '@chatgpt-app-builder/shared';
import { api, type NodeTypeInfo } from '../../lib/api';

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

  if (!isOpen) return null;

  // Get confidence badge color
  const getConfidenceBadge = (confidence: 'high' | 'medium' | 'low') => {
    switch (confidence) {
      case 'high':
        return 'bg-green-100 text-green-700';
      case 'medium':
        return 'bg-yellow-100 text-yellow-700';
      case 'low':
        return 'bg-gray-100 text-gray-600';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div>
            <h2 className="text-lg font-semibold">Add Transformer</h2>
            <p className="text-sm text-gray-500">
              Select a transformer to convert data between nodes
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={isInserting}
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto flex-1">
          {/* Error from insertion */}
          {insertError && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{insertError}</p>
            </div>
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
                        className="w-full flex items-start gap-4 p-3 rounded-lg border-2 border-teal-200 hover:border-teal-400 transition-all hover:shadow-md text-left disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <div className="w-10 h-10 rounded-lg bg-teal-50 flex items-center justify-center flex-shrink-0">
                          <Shuffle className="w-5 h-5 text-teal-600" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium text-gray-900 text-sm">
                              {transformer.displayName}
                            </h4>
                            <span
                              className={`text-xs px-2 py-0.5 rounded-full ${getConfidenceBadge(
                                transformer.confidence
                              )}`}
                            >
                              {transformer.confidence} confidence
                            </span>
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
                          className="w-full flex items-start gap-4 p-3 rounded-lg border-2 border-gray-200 hover:border-teal-400 transition-all hover:shadow-md text-left disabled:opacity-50 disabled:cursor-not-allowed"
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

        {/* Footer */}
        <div className="flex justify-end gap-3 p-4 border-t">
          <button
            onClick={onClose}
            disabled={isInserting}
            className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
