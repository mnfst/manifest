import { useEffect, useState, useCallback } from 'react';
import { ArrowRight, ArrowDown, AlertCircle, Wand2, X, Check } from 'lucide-react';
import { Spinner } from '@/components/ui/shadcn/spinner';
import type { NodeSchemaInfo } from '@manifest/shared';
import { api } from '../../lib/api';
import { SchemaViewer } from './SchemaViewer';
import { SchemaErrorBoundary } from '../common/SchemaErrorBoundary';
import { getSchemaStateLabel, getSchemaStateColor } from '../../lib/schemaUtils';
import { Button } from '@/components/ui/shadcn/button';

interface NodeSchemaPanelProps {
  flowId: string;
  nodeId: string;
  nodeType: string;
  onSchemaResolved?: () => void;
}

export function NodeSchemaPanel({ flowId, nodeId, nodeType, onSchemaResolved }: NodeSchemaPanelProps) {
  const [schemaInfo, setSchemaInfo] = useState<NodeSchemaInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Schema discovery state
  const [showDiscoveryPanel, setShowDiscoveryPanel] = useState(false);
  const [sampleJson, setSampleJson] = useState('');
  const [resolving, setResolving] = useState(false);
  const [resolveError, setResolveError] = useState<string | null>(null);

  const fetchSchema = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await api.getNodeSchema(flowId, nodeId);
      setSchemaInfo(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load schema');
    } finally {
      setLoading(false);
    }
  }, [flowId, nodeId]);

  useEffect(() => {
    fetchSchema();
  }, [fetchSchema]);

  const handleDiscoverSchema = useCallback(async () => {
    if (!sampleJson.trim()) {
      setResolveError('Please enter sample JSON response');
      return;
    }

    setResolving(true);
    setResolveError(null);

    try {
      // Validate JSON first
      JSON.parse(sampleJson);

      const response = await api.resolveNodeSchema(flowId, nodeId, {
        sampleResponse: sampleJson,
      });

      if (response.resolved) {
        // Refresh schema info
        await fetchSchema();
        setShowDiscoveryPanel(false);
        setSampleJson('');
        onSchemaResolved?.();
      } else {
        setResolveError(response.error || 'Failed to resolve schema');
      }
    } catch (err) {
      if (err instanceof SyntaxError) {
        setResolveError('Invalid JSON format');
      } else {
        setResolveError(err instanceof Error ? err.message : 'Failed to resolve schema');
      }
    } finally {
      setResolving(false);
    }
  }, [flowId, nodeId, sampleJson, fetchSchema, onSchemaResolved]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Spinner className="w-5 h-5 text-gray-400" />
        <span className="ml-2 text-sm text-gray-500">Loading schema...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 py-4 px-3 bg-red-50 rounded-lg text-red-700">
        <AlertCircle className="w-4 h-4 flex-shrink-0" />
        <span className="text-sm">{error}</span>
      </div>
    );
  }

  if (!schemaInfo) {
    return (
      <div className="text-sm text-gray-400 italic py-4">
        No schema information available
      </div>
    );
  }

  const isTriggerNode = schemaInfo.inputSchema === null && schemaInfo.inputState === 'defined';
  const isTerminalNode = schemaInfo.outputSchema === null && schemaInfo.outputState === 'defined';
  const isPendingOutput = schemaInfo.outputState === 'pending';
  const isApiCallNode = nodeType === 'ApiCall';

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-xs text-gray-500">
        <span className="font-medium">{nodeType}</span>
        <span className="text-gray-400">|</span>
        <span>Node Schema Information</span>
      </div>

      {/* Input Schema */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <ArrowRight className="w-4 h-4 text-blue-500" />
          <span className="text-sm font-medium text-gray-700">Input</span>
          <span
            className={`px-2 py-0.5 text-xs rounded-full ${getSchemaStateColor(schemaInfo.inputState)}`}
          >
            {getSchemaStateLabel(schemaInfo.inputState)}
          </span>
        </div>

        {isTriggerNode ? (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 ml-6">
            <p className="text-sm text-blue-700 font-medium">No input - triggers start the flow</p>
            <p className="text-xs text-blue-600 mt-1">
              Trigger nodes initiate flow execution. They receive no input from other nodes.
            </p>
          </div>
        ) : (
          <div className="pl-6">
            <SchemaErrorBoundary fallbackMessage="Failed to parse input schema">
              <SchemaViewer
                schema={schemaInfo.inputSchema}
                emptyMessage="Input schema not defined"
              />
            </SchemaErrorBoundary>
          </div>
        )}
      </div>

      {/* Output Schema */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <ArrowDown className="w-4 h-4 text-green-500" />
          <span className="text-sm font-medium text-gray-700">Output</span>
          <span
            className={`px-2 py-0.5 text-xs rounded-full ${getSchemaStateColor(schemaInfo.outputState)}`}
          >
            {getSchemaStateLabel(schemaInfo.outputState)}
          </span>

          {/* Paste Sample Button for ApiCall nodes - always visible for re-discovery */}
          {isApiCallNode && !showDiscoveryPanel && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowDiscoveryPanel(true)}
              className="ml-auto h-7 px-2 text-xs bg-blue-50 text-blue-600 hover:bg-blue-100 hover:text-blue-600"
            >
              <Wand2 className="w-3 h-3 mr-1.5" />
              Paste Sample
            </Button>
          )}
        </div>

        {isTerminalNode ? (
          <div className="text-sm text-gray-400 italic py-2 pl-6">
            Terminal node - no output (this node ends the flow)
          </div>
        ) : isPendingOutput && !showDiscoveryPanel ? (
          <div className="text-sm text-yellow-600 py-2 pl-6">
            {isApiCallNode ? (
              <>Output schema pending - use "Test Request" in the Configuration tab to auto-discover, or "Paste Sample" to provide sample JSON</>
            ) : (
              <>Output schema pending - click "Paste Sample" to infer from a sample response</>
            )}
          </div>
        ) : (
          <div className="pl-6">
            <SchemaErrorBoundary fallbackMessage="Failed to parse output schema">
              <SchemaViewer
                schema={schemaInfo.outputSchema}
                emptyMessage="Output schema not defined"
              />
            </SchemaErrorBoundary>
          </div>
        )}
      </div>

      {/* Schema Discovery Panel */}
      {showDiscoveryPanel && (
        <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Wand2 className="w-4 h-4 text-blue-600" />
              <h4 className="text-sm font-medium text-blue-800">Paste Sample JSON</h4>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                setShowDiscoveryPanel(false);
                setSampleJson('');
                setResolveError(null);
              }}
              className="h-6 w-6 hover:bg-blue-100"
            >
              <X className="w-4 h-4 text-blue-600" />
            </Button>
          </div>

          <p className="text-xs text-blue-700 mb-3">
            Paste a sample JSON response from the API to automatically infer the output schema.
          </p>

          <textarea
            value={sampleJson}
            onChange={(e) => {
              setSampleJson(e.target.value);
              setResolveError(null);
            }}
            placeholder={'{\n  "id": 123,\n  "name": "Example",\n  "items": []\n}'}
            className="w-full h-32 p-2 text-sm font-mono bg-white border border-blue-200 rounded resize-none focus:outline-none focus:ring-2 focus:ring-blue-300"
          />

          {resolveError && (
            <div className="flex items-center gap-2 mt-2 text-red-600 text-xs">
              <AlertCircle className="w-3 h-3" />
              {resolveError}
            </div>
          )}

          <div className="flex justify-end gap-2 mt-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setShowDiscoveryPanel(false);
                setSampleJson('');
                setResolveError(null);
              }}
              disabled={resolving}
              className="text-gray-600 hover:bg-blue-100"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleDiscoverSchema}
              disabled={resolving || !sampleJson.trim()}
              className="bg-blue-600 text-white hover:bg-blue-700"
            >
              {resolving ? (
                <Spinner className="w-3 h-3 mr-1.5" />
              ) : (
                <Check className="w-3 h-3 mr-1.5" />
              )}
              {resolving ? 'Discovering...' : 'Discover'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
