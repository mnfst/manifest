import { useState, useCallback, useMemo } from 'react';
import { Copy, Check, ChevronDown, AlertCircle, RefreshCw } from 'lucide-react';
import { Spinner } from '@/components/ui/shadcn/spinner';
import type { UpstreamNodeInfo } from '../../types/schema';
import { getTypeColor } from '../../lib/schemaUtils';
import { Button } from '@/components/ui/shadcn/button';

interface UsePreviousOutputsProps {
  /** List of upstream nodes with their output schemas */
  upstreamNodes: UpstreamNodeInfo[];
  /** Loading state */
  isLoading?: boolean;
  /** Error message */
  error?: string | null;
  /** Called when a reference is copied */
  onCopy?: (reference: string) => void;
  /** Called to refresh upstream node data (T039) */
  onRefresh?: () => void;
}

/**
 * Component for selecting and copying references to upstream node outputs.
 * Used in node configuration modals to help users reference data from previous steps.
 *
 * Generates references in the format: {{ nodeSlug.fieldPath }}
 */
export function UsePreviousOutputs({
  upstreamNodes,
  isLoading = false,
  error = null,
  onCopy,
  onRefresh,
}: UsePreviousOutputsProps) {
  const [selectedNodeId, setSelectedNodeId] = useState<string>('');
  const [selectedFieldPath, setSelectedFieldPath] = useState<string>('');
  const [copied, setCopied] = useState(false);

  // Get the currently selected node
  const selectedNode = useMemo(() => {
    return upstreamNodes.find((n) => n.id === selectedNodeId) ?? null;
  }, [upstreamNodes, selectedNodeId]);

  // Get fields for the selected node
  const availableFields = useMemo(() => {
    return selectedNode?.fields ?? [];
  }, [selectedNode]);

  // Get the currently selected field
  const selectedField = useMemo(() => {
    return availableFields.find((f) => f.path === selectedFieldPath) ?? null;
  }, [availableFields, selectedFieldPath]);

  // Handle node selection change
  const handleNodeChange = useCallback((nodeId: string) => {
    setSelectedNodeId(nodeId);
    setSelectedFieldPath(''); // Reset field when node changes
  }, []);

  // Handle field selection change
  const handleFieldChange = useCallback((fieldPath: string) => {
    setSelectedFieldPath(fieldPath);
  }, []);

  // Generate the reference string
  const generateReference = useCallback((): string | null => {
    if (!selectedNode || !selectedFieldPath) return null;
    return `{{ ${selectedNode.slug}.${selectedFieldPath} }}`;
  }, [selectedNode, selectedFieldPath]);

  // Copy reference to clipboard
  const handleCopy = useCallback(async () => {
    const reference = generateReference();
    if (!reference) return;

    try {
      await navigator.clipboard.writeText(reference);
      setCopied(true);
      onCopy?.(reference);

      // Reset copied state after 2 seconds
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
    }
  }, [generateReference, onCopy]);

  // Loading state
  if (isLoading) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <div className="flex items-center gap-2 text-gray-500">
          <Spinner className="w-4 h-4" />
          <span className="text-sm">Loading upstream nodes...</span>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex items-center gap-2 text-red-600">
          <AlertCircle className="w-4 h-4" />
          <span className="text-sm">{error}</span>
        </div>
      </div>
    );
  }

  // No upstream nodes (T023)
  if (upstreamNodes.length === 0) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <p className="text-sm text-gray-500">
          No upstream nodes available. Connect this node to other nodes to reference their outputs.
        </p>
      </div>
    );
  }

  const reference = generateReference();
  const canCopy = reference !== null;

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-sm font-medium text-blue-800">Use Previous Outputs</span>
      </div>

      {/* Node Selector */}
      <div>
        <label htmlFor="upstream-node" className="block text-xs font-medium text-gray-600 mb-1">
          Source Node
        </label>
        <div className="relative">
          <select
            id="upstream-node"
            value={selectedNodeId}
            onChange={(e) => handleNodeChange(e.target.value)}
            className="w-full pl-3 pr-8 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none"
          >
            <option value="">Select a node...</option>
            {upstreamNodes.map((node) => (
              <option key={node.id} value={node.id}>
                {node.name} ({node.type})
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        </div>
      </div>

      {/* Field Selector (T020, T024) */}
      {selectedNode && (
        <div>
          <label htmlFor="output-field" className="block text-xs font-medium text-gray-600 mb-1">
            Output Field
          </label>
          {availableFields.length === 0 ? (
            // T024, T039: Handle no outputs or unknown schema with refresh option
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-2">
              <div className="flex items-center justify-between">
                <p className="text-xs text-yellow-700">
                  No output fields available. Schema may be pending.
                </p>
                {onRefresh && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onRefresh}
                    className="text-yellow-700 hover:text-yellow-800 hover:bg-yellow-100"
                    title="Refresh upstream node schemas"
                  >
                    <RefreshCw className="w-3 h-3" />
                    Refresh
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <div className="relative">
              <select
                id="output-field"
                value={selectedFieldPath}
                onChange={(e) => handleFieldChange(e.target.value)}
                className="w-full pl-3 pr-8 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none"
              >
                <option value="">Select a field...</option>
                {availableFields.map((field) => (
                  <option key={field.path} value={field.path}>
                    {field.path} ({field.type})
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>
          )}

          {/* Field Description */}
          {selectedField?.description && (
            <p className="text-xs text-gray-500 mt-1">{selectedField.description}</p>
          )}

          {/* Field Type Badge */}
          {selectedField && (
            <div className="flex items-center gap-2 mt-2">
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${getTypeColor(selectedField.type)}`}>
                {selectedField.type}
              </span>
              {selectedField.source && (
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                  selectedField.source === 'static'
                    ? 'bg-gray-100 text-gray-600'
                    : 'bg-blue-100 text-blue-700'
                }`}>
                  {selectedField.source === 'static' ? 'Static' : 'Dynamic'}
                </span>
              )}
              {selectedField.required && (
                <span className="px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700">
                  Required
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Copy Button (T021) */}
      {selectedNode && (
        <div className="flex items-center gap-2">
          <code className="flex-1 px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm font-mono text-gray-700 truncate">
            {reference || '{{ ... }}'}
          </code>
          <Button
            onClick={handleCopy}
            disabled={!canCopy}
            className={copied ? 'bg-green-100 text-green-700 hover:bg-green-100' : ''}
          >
            {copied ? (
              <>
                <Check className="w-4 h-4" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                Copy
              </>
            )}
          </Button>
        </div>
      )}

      <p className="text-xs text-blue-600">
        Paste this reference in URL or text fields to use the output value.
      </p>

      {/* Secrets hint */}
      <div className="border-t border-blue-200 pt-3 mt-1">
        <p className="text-xs text-blue-700">
          You can also use secrets from your app settings:{' '}
          <code className="px-1.5 py-0.5 bg-blue-100 rounded font-mono text-xs">
            {'{{ secrets.YOUR_KEY }}'}
          </code>
        </p>
      </div>
    </div>
  );
}
