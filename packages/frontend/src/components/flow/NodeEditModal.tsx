import { useState, useEffect, useCallback } from 'react';
import type {
  NodeInstance,
  NodeType,
  Flow,
  Connection,
  ReturnNodeParameters,
  CallFlowNodeParameters,
  UserIntentNodeParameters,
  ApiCallNodeParameters,
  JavaScriptCodeTransformParameters,
  LinkNodeParameters,
  HttpMethod,
  HeaderEntry,
  FlowParameter,
  ParameterType,
  JSONSchema,
} from '@chatgpt-app-builder/shared';
import { X, Loader2, LayoutGrid, FileText, PhoneForwarded, Zap, Globe, Plus, Trash2, Wrench, Code, Shuffle, Play, CheckCircle, AlertCircle, ExternalLink } from 'lucide-react';
import { NodeSchemaPanel } from '../node/NodeSchemaPanel';
import { UsePreviousOutputs } from '../common/UsePreviousOutputs';
import { TemplateReferencesDisplay } from '../common/TemplateReferencesDisplay';
import { useUpstreamNodes } from '../../hooks/useUpstreamNodes';
import { CodeEditor } from '../common/CodeEditor';
import { JSONEditor } from '../common/JSONEditor';
import { SchemaPreview } from '../common/SchemaPreview';
import { useCodeValidation } from '../../hooks/useCodeValidation';
import { useTestTransform } from '../../hooks/useTestTransform';

interface NodeEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: { name: string; parameters: Record<string, unknown> }) => Promise<void>;
  node: NodeInstance | null; // null for create mode
  nodeType: NodeType | null; // Required for create mode, derived from node for edit mode
  flows: Flow[]; // Available flows for CallFlow node
  currentFlowId: string; // Current flow ID (to exclude from CallFlow targets)
  /** All nodes in the flow (for upstream node reference) */
  nodes?: NodeInstance[];
  /** All connections in the flow (for upstream node reference) */
  connections?: Connection[];
  isLoading?: boolean;
  error?: string | null;
  /** Optional title for RegistryComponent nodes (shown in modal header) */
  registryComponentTitle?: string;
}

type TabType = 'config' | 'schema';

const HTTP_METHODS: { value: HttpMethod; label: string }[] = [
  { value: 'GET', label: 'GET' },
  { value: 'POST', label: 'POST' },
  { value: 'PUT', label: 'PUT' },
  { value: 'DELETE', label: 'DELETE' },
  { value: 'PATCH', label: 'PATCH' },
];

const PARAMETER_TYPES: { value: ParameterType; label: string }[] = [
  { value: 'string', label: 'String' },
  { value: 'number', label: 'Number' },
  { value: 'integer', label: 'Integer' },
  { value: 'boolean', label: 'Boolean' },
];

// Default transform code for JavaScriptCodeTransform nodes
const DEFAULT_TRANSFORM_CODE = `function transform(input: Input) {
  return input;
}`;


/**
 * Modal for creating and editing nodes (StatCard, Return, CallFlow, UserIntent, ApiCall)
 */
export function NodeEditModal({
  isOpen,
  onClose,
  onSave,
  node,
  nodeType,
  flows,
  currentFlowId,
  nodes,
  connections,
  isLoading = false,
  error = null,
  registryComponentTitle,
}: NodeEditModalProps) {
  const isEditMode = node !== null;
  const effectiveNodeType = node?.type ?? nodeType;

  // Get upstream nodes for "Use Previous Outputs" component
  const { upstreamNodes, isLoading: upstreamLoading, error: upstreamError, refresh: refreshUpstream } = useUpstreamNodes({
    flowId: currentFlowId,
    nodeId: node?.id ?? '',
    nodes,
    connections,
  });

  // Tab state - only show schema tab in edit mode
  const [activeTab, setActiveTab] = useState<TabType>('config');

  // Common fields
  const [name, setName] = useState('');

  // Return node fields
  const [text, setText] = useState('');

  // CallFlow node fields
  const [targetFlowId, setTargetFlowId] = useState<string | null>(null);

  // UserIntent node fields
  const [whenToUse, setWhenToUse] = useState('');
  const [whenNotToUse, setWhenNotToUse] = useState('');
  const [toolName, setToolName] = useState(''); // Read-only, auto-generated
  const [toolDescription, setToolDescription] = useState('');
  const [toolParameters, setToolParameters] = useState<FlowParameter[]>([]);
  const [isToolActive, setIsToolActive] = useState(true);

  // ApiCall node fields
  const [apiMethod, setApiMethod] = useState<HttpMethod>('GET');
  const [apiUrl, setApiUrl] = useState('');
  const [apiHeaders, setApiHeaders] = useState<HeaderEntry[]>([]);
  const [apiTimeout, setApiTimeout] = useState(30000);

  // JavaScriptCodeTransform node fields
  const [transformCode, setTransformCode] = useState(DEFAULT_TRANSFORM_CODE);
  const [resolvedOutputSchema, setResolvedOutputSchema] = useState<JSONSchema | null>(null);
  const [testInput, setTestInput] = useState('{}');

  // Link node fields
  const [linkHref, setLinkHref] = useState('');

  // Code validation for JavaScriptCodeTransform
  const { isValid: isCodeValid, error: codeValidationError } = useCodeValidation(transformCode);

  // Test transform hook
  const {
    testTransform,
    isLoading: isTestLoading,
    result: testResult,
    outputSchema: testedOutputSchema,
    reset: resetTest,
  } = useTestTransform(currentFlowId);

  /**
   * Generate sample input data from upstream node fields.
   * Creates example values based on field types.
   */
  const generateSampleInput = useCallback((nodes: typeof upstreamNodes): string => {
    if (nodes.length === 0) return '{}';

    const sampleData: Record<string, unknown> = {};

    for (const node of nodes) {
      for (const field of node.fields) {
        // Use field path (e.g., "monsterName") as key
        // Generate sample value based on type
        let sampleValue: unknown;
        switch (field.type) {
          case 'string':
            sampleValue = `example_${field.path}`;
            break;
          case 'number':
          case 'integer':
            sampleValue = 42;
            break;
          case 'boolean':
            sampleValue = true;
            break;
          case 'array':
            sampleValue = [];
            break;
          case 'object':
            sampleValue = {};
            break;
          default:
            sampleValue = `example_${field.path}`;
        }
        sampleData[field.path] = sampleValue;
      }
    }

    return JSON.stringify(sampleData, null, 2);
  }, []);

  // Auto-populate test input when upstream nodes are loaded for transform nodes
  useEffect(() => {
    if (isOpen && effectiveNodeType === 'JavaScriptCodeTransform' && upstreamNodes.length > 0) {
      setTestInput(generateSampleInput(upstreamNodes));
    }
  }, [isOpen, effectiveNodeType, upstreamNodes, generateSampleInput]);

  // Initialize form when modal opens or node changes
  useEffect(() => {
    if (!isOpen) return;

    // Reset to config tab when modal opens
    setActiveTab('config');

    if (node) {
      // Edit mode - populate from existing node
      setName(node.name);

      if (node.type === 'StatCard' || node.type === 'PostList') {
        // UI nodes (StatCard, PostList) use unified InterfaceEditor, no parameters to set here
      } else if (node.type === 'Return') {
        const params = node.parameters as unknown as ReturnNodeParameters;
        setText(params?.text || '');
      } else if (node.type === 'CallFlow') {
        const params = node.parameters as unknown as CallFlowNodeParameters;
        setTargetFlowId(params?.targetFlowId || null);
      } else if (node.type === 'UserIntent') {
        const params = node.parameters as unknown as UserIntentNodeParameters;
        setWhenToUse(params?.whenToUse || '');
        setWhenNotToUse(params?.whenNotToUse || '');
        setToolName(params?.toolName || '');
        setToolDescription(params?.toolDescription || '');
        setToolParameters(params?.parameters || []);
        setIsToolActive(params?.isActive !== false);
      } else if (node.type === 'ApiCall') {
        const params = node.parameters as unknown as ApiCallNodeParameters;
        setApiMethod(params?.method || 'GET');
        setApiUrl(params?.url || '');
        setApiHeaders(params?.headers || []);
        setApiTimeout(params?.timeout || 30000);
      } else if (node.type === 'JavaScriptCodeTransform') {
        const params = node.parameters as unknown as JavaScriptCodeTransformParameters;
        setTransformCode(params?.code || DEFAULT_TRANSFORM_CODE);
        setResolvedOutputSchema(params?.resolvedOutputSchema || null);
        setTestInput('{}');
        resetTest();
      } else if (node.type === 'Link') {
        const params = node.parameters as unknown as LinkNodeParameters;
        setLinkHref(params?.href || '');
      }
    } else {
      // Create mode - set defaults
      setName('');
      // Note: StatCard uses unified InterfaceEditor, no layout template state needed
      setText('');
      setTargetFlowId(null);
      setWhenToUse('');
      setWhenNotToUse('');
      setToolName('');
      setToolDescription('');
      setToolParameters([]);
      setIsToolActive(true);
      setApiMethod('GET');
      setApiUrl('');
      setApiHeaders([]);
      setApiTimeout(30000);
      setTransformCode(DEFAULT_TRANSFORM_CODE);
      setResolvedOutputSchema(null);
      setTestInput('{}');
      resetTest();
      setLinkHref('');
    }
  }, [isOpen, node, resetTest]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    let parameters: Record<string, unknown> = {};

    if (effectiveNodeType === 'StatCard' || effectiveNodeType === 'PostList' || effectiveNodeType === 'RegistryComponent') {
      // UI nodes use the unified InterfaceEditor for code editing, not this modal
      // No parameters needed here - RegistryComponent params are merged in handleSaveNode
      parameters = {};
    } else if (effectiveNodeType === 'Return') {
      parameters = { text };
    } else if (effectiveNodeType === 'CallFlow') {
      parameters = { targetFlowId };
    } else if (effectiveNodeType === 'UserIntent') {
      parameters = {
        whenToUse,
        whenNotToUse,
        toolDescription,
        parameters: toolParameters,
        isActive: isToolActive,
        // Note: toolName is auto-generated by the backend, not sent from frontend
      };
    } else if (effectiveNodeType === 'ApiCall') {
      parameters = {
        method: apiMethod,
        url: apiUrl,
        headers: apiHeaders,
        timeout: apiTimeout,
        inputMappings: [],
      };
    } else if (effectiveNodeType === 'JavaScriptCodeTransform') {
      // Use tested output schema if available, otherwise use resolved schema from node
      const finalOutputSchema = testedOutputSchema || resolvedOutputSchema;
      parameters = {
        code: transformCode,
        resolvedOutputSchema: finalOutputSchema,
      };
    } else if (effectiveNodeType === 'Link') {
      parameters = { href: linkHref };
    }

    await onSave({ name, parameters });
  };

  // Header management for ApiCall
  const addHeader = () => {
    setApiHeaders([...apiHeaders, { key: '', value: '' }]);
  };

  const removeHeader = (index: number) => {
    setApiHeaders(apiHeaders.filter((_, i) => i !== index));
  };

  const updateHeader = (index: number, field: 'key' | 'value', value: string) => {
    const newHeaders = [...apiHeaders];
    newHeaders[index] = { ...newHeaders[index], [field]: value };
    setApiHeaders(newHeaders);
  };

  // Tool parameter management for UserIntent
  const addToolParameter = () => {
    setToolParameters([
      ...toolParameters,
      { name: '', type: 'string', description: '', optional: false },
    ]);
  };

  const removeToolParameter = (index: number) => {
    setToolParameters(toolParameters.filter((_, i) => i !== index));
  };

  const updateToolParameter = (
    index: number,
    field: keyof FlowParameter,
    value: string | boolean
  ) => {
    const newParams = [...toolParameters];
    newParams[index] = { ...newParams[index], [field]: value };
    setToolParameters(newParams);
  };

  // Test transform handler for JavaScriptCodeTransform
  const handleTestTransform = async () => {
    try {
      const parsedInput = JSON.parse(testInput);
      await testTransform(transformCode, parsedInput);
    } catch (err) {
      // JSON parse error will be shown inline
      console.error('Invalid test input JSON:', err);
    }
  };

  if (!isOpen || !effectiveNodeType) return null;

  // Filter out current flow from available targets
  const availableFlows = flows.filter((f) => f.id !== currentFlowId);

  // Get icon and title based on node type
  const getNodeTypeInfo = () => {
    switch (effectiveNodeType) {
      case 'StatCard':
        return {
          icon: <LayoutGrid className="w-5 h-5 text-gray-600" />,
          title: isEditMode ? 'Edit Stat Card' : 'Create Stat Card',
          description: 'Display statistics and metrics',
          color: 'gray',
        };
      case 'Return':
        return {
          icon: <FileText className="w-5 h-5 text-green-600" />,
          title: isEditMode ? 'Edit Return Value' : 'Create Return Value',
          description: 'Return a text response to the user',
          color: 'green',
        };
      case 'CallFlow':
        return {
          icon: <PhoneForwarded className="w-5 h-5 text-purple-600" />,
          title: isEditMode ? 'Edit Call Flow' : 'Create Call Flow',
          description: 'Invoke another flow in the app',
          color: 'purple',
        };
      case 'UserIntent':
        return {
          icon: <Zap className="w-5 h-5 text-blue-600" />,
          title: isEditMode ? 'Edit User Intent' : 'Create User Intent',
          description: 'Define when the AI should trigger this flow',
          color: 'blue',
        };
      case 'ApiCall':
        return {
          icon: <Globe className="w-5 h-5 text-orange-600" />,
          title: isEditMode ? 'Edit API Call' : 'Create API Call',
          description: 'Make HTTP requests to external APIs',
          color: 'orange',
        };
      case 'JavaScriptCodeTransform':
        return {
          icon: <Shuffle className="w-5 h-5 text-teal-600" />,
          title: isEditMode ? 'Edit JavaScript Transform' : 'Create JavaScript Transform',
          description: 'Transform data using custom JavaScript code',
          color: 'teal',
        };
      case 'PostList':
        return {
          icon: <LayoutGrid className="w-5 h-5 text-gray-600" />,
          title: isEditMode ? 'Edit Post List' : 'Create Post List',
          description: 'Display a list of posts with actions',
          color: 'gray',
        };
      case 'Link':
        return {
          icon: <ExternalLink className="w-5 h-5 text-green-600" />,
          title: isEditMode ? 'Edit Link' : 'Create Link',
          description: 'Open an external URL in the user\'s browser',
          color: 'green',
        };
      case 'RegistryComponent':
        return {
          icon: <LayoutGrid className="w-5 h-5 text-gray-600" />,
          title: isEditMode
            ? `Edit ${registryComponentTitle || 'UI Component'}`
            : `Add ${registryComponentTitle || 'UI Component'}`,
          description: registryComponentTitle
            ? `Add ${registryComponentTitle} to your flow`
            : 'Add a UI component from the registry',
          color: 'gray',
        };
    }
  };

  const nodeInfo = getNodeTypeInfo();

  if (!isOpen || !nodeInfo) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Modal - wider for transform nodes */}
      <div className={`relative bg-white rounded-lg shadow-xl w-full max-h-[85vh] overflow-hidden flex flex-col ${
        effectiveNodeType === 'JavaScriptCodeTransform' ? 'max-w-3xl' : 'max-w-lg'
      }`}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg bg-${nodeInfo.color}-100 flex items-center justify-center`}>
              {nodeInfo.icon}
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">{nodeInfo.title}</h2>
              <div className="flex items-center gap-2">
                <p className="text-sm text-gray-500">{nodeInfo.description}</p>
                {/* Show slug in edit mode (T035) */}
                {isEditMode && node?.slug && (
                  <code
                    className="px-1.5 py-0.5 text-xs bg-gray-100 text-gray-600 rounded font-mono"
                    title={`Node slug - use {{ ${node.slug}.fieldName }} to reference outputs`}
                  >
                    {node.slug}
                  </code>
                )}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isLoading}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation (only show in edit mode) */}
        {isEditMode && (
          <div className="flex border-b px-6">
            <button
              type="button"
              onClick={() => setActiveTab('config')}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'config'
                  ? 'text-primary border-primary'
                  : 'text-gray-500 border-transparent hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Configuration
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('schema')}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
                activeTab === 'schema'
                  ? 'text-primary border-primary'
                  : 'text-gray-500 border-transparent hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Code className="w-4 h-4" />
              Schema
            </button>
          </div>
        )}

        {/* Schema Tab Content */}
        {isEditMode && activeTab === 'schema' && node && (
          <div className="flex-1 overflow-y-auto p-6">
            <NodeSchemaPanel
              flowId={currentFlowId}
              nodeId={node.id}
              nodeType={node.type}
            />
          </div>
        )}

        {/* Form (Config Tab) */}
        <form onSubmit={handleSubmit} className={`flex-1 overflow-y-auto ${isEditMode && activeTab !== 'config' ? 'hidden' : ''}`}>
          <div className="p-6 space-y-4">
            {/* Error message */}
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm">
                {error}
              </div>
            )}

            {/* Name field (common to all) */}
            <div>
              <label htmlFor="node-name" className="block text-sm font-medium text-gray-700 mb-1">
                Name
              </label>
              <input
                id="node-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={`Enter ${effectiveNodeType.toLowerCase()} name`}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                required
                disabled={isLoading}
              />
            </div>

            {/* UI nodes use unified InterfaceEditor for code editing */}
            {(effectiveNodeType === 'StatCard' || effectiveNodeType === 'PostList' || effectiveNodeType === 'RegistryComponent') && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-700">
                  {effectiveNodeType === 'RegistryComponent'
                    ? 'Registry components include their source code. After adding, click "Edit Code" on the node to customize.'
                    : 'UI nodes are configured through the unified editor. Click the Edit button on the node to customize appearance and code.'
                  }
                </p>
              </div>
            )}

            {/* Return-specific fields */}
            {effectiveNodeType === 'Return' && (
              <>
                {/* Use Previous Outputs component - only show in edit mode when we have a node ID */}
                {isEditMode && node && (
                  <UsePreviousOutputs
                    upstreamNodes={upstreamNodes}
                    isLoading={upstreamLoading}
                    error={upstreamError}
                    onRefresh={refreshUpstream}
                  />
                )}

                <div>
                  <label htmlFor="return-text" className="block text-sm font-medium text-gray-700 mb-1">
                    Return Text
                  </label>
                  <textarea
                    id="return-text"
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="Enter the text to return to the user... Use {{ nodeSlug.field }} for dynamic values"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary resize-none"
                    rows={4}
                    disabled={isLoading}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Use {'{{ nodeSlug.path }}'} syntax to reference upstream node outputs.
                  </p>
                </div>

                {/* Template References Display - shows input requirements from {{ }} variables */}
                <TemplateReferencesDisplay
                  values={[text]}
                  upstreamNodes={upstreamNodes}
                  isConnected={upstreamNodes.length > 0}
                />
              </>
            )}

            {/* CallFlow-specific fields */}
            {effectiveNodeType === 'CallFlow' && (
              <div>
                <label htmlFor="target-flow" className="block text-sm font-medium text-gray-700 mb-1">
                  Target Flow
                </label>
                <select
                  id="target-flow"
                  value={targetFlowId || ''}
                  onChange={(e) => setTargetFlowId(e.target.value || null)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                  disabled={isLoading}
                >
                  <option value="">Select a flow...</option>
                  {availableFlows.map((flow) => (
                    <option key={flow.id} value={flow.id}>
                      {flow.name}
                    </option>
                  ))}
                </select>
                {availableFlows.length === 0 && (
                  <p className="text-xs text-amber-600 mt-1">
                    No other flows available. Create more flows to call them.
                  </p>
                )}
              </div>
            )}

            {/* UserIntent-specific fields */}
            {effectiveNodeType === 'UserIntent' && (
              <>
                {/* MCP Tool Section */}
                <div className="border border-blue-200 bg-blue-50 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Wrench className="w-4 h-4 text-blue-600" />
                    <span className="text-sm font-medium text-blue-800">MCP Tool Configuration</span>
                  </div>

                  {/* Tool Name (read-only) */}
                  {isEditMode && toolName && (
                    <div className="mb-3">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Tool Name
                      </label>
                      <div className="flex items-center gap-2">
                        <code className="flex-1 px-3 py-2 bg-gray-100 border border-gray-200 rounded-lg text-sm font-mono text-gray-700">
                          {toolName}
                        </code>
                        <span className="text-xs text-gray-500">(auto-generated)</span>
                      </div>
                    </div>
                  )}

                  {/* Tool Description */}
                  <div className="mb-3">
                    <label htmlFor="tool-description" className="block text-sm font-medium text-gray-700 mb-1">
                      Tool Description
                    </label>
                    <textarea
                      id="tool-description"
                      value={toolDescription}
                      onChange={(e) => setToolDescription(e.target.value)}
                      placeholder="Describe what this tool does for MCP clients..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary resize-none"
                      rows={2}
                      disabled={isLoading}
                    />
                  </div>

                  {/* Active Toggle Switch (T030-T033) */}
                  <div className="flex items-center justify-between mb-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="flex flex-col">
                      <label htmlFor="tool-active" className="text-sm font-medium text-gray-700">
                        Active
                      </label>
                      <span className="text-xs text-gray-500" title="Active triggers are exposed as MCP tools and can be invoked by AI assistants">
                        Active triggers are exposed as MCP tools
                      </span>
                    </div>
                    <button
                      id="tool-active"
                      type="button"
                      role="switch"
                      aria-checked={isToolActive}
                      onClick={() => setIsToolActive(!isToolActive)}
                      disabled={isLoading}
                      className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${
                        isToolActive ? 'bg-blue-600' : 'bg-gray-200'
                      }`}
                    >
                      <span
                        aria-hidden="true"
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          isToolActive ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

                  {/* Tool Parameters */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <label className="block text-sm font-medium text-gray-700">
                          Tool Parameters
                        </label>
                        <span className="text-xs text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded" title="Parameters you define here become dynamic output fields that downstream nodes can reference">
                          become outputs
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={addToolParameter}
                        disabled={isLoading}
                        className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 disabled:opacity-50"
                      >
                        <Plus className="w-4 h-4" />
                        Add Parameter
                      </button>
                    </div>
                    {toolParameters.length === 0 ? (
                      <p className="text-sm text-gray-500 bg-white rounded-lg p-3 border border-gray-200">
                        No parameters configured. This tool will accept no input arguments.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {toolParameters.map((param, index) => (
                          <div key={index} className="bg-white rounded-lg p-3 border border-gray-200 space-y-2">
                            <div className="flex gap-2">
                              <input
                                type="text"
                                value={param.name}
                                onChange={(e) => updateToolParameter(index, 'name', e.target.value)}
                                placeholder="Parameter name"
                                className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-primary focus:border-primary"
                                disabled={isLoading}
                              />
                              <select
                                value={param.type}
                                onChange={(e) => updateToolParameter(index, 'type', e.target.value)}
                                className="px-2 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-primary focus:border-primary"
                                disabled={isLoading}
                              >
                                {PARAMETER_TYPES.map((t) => (
                                  <option key={t.value} value={t.value}>
                                    {t.label}
                                  </option>
                                ))}
                              </select>
                              <button
                                type="button"
                                onClick={() => removeToolParameter(index)}
                                disabled={isLoading}
                                className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                            <input
                              type="text"
                              value={param.description}
                              onChange={(e) => updateToolParameter(index, 'description', e.target.value)}
                              placeholder="Parameter description"
                              className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-primary focus:border-primary"
                              disabled={isLoading}
                            />
                            <label className="flex items-center gap-2 text-sm text-gray-600">
                              <input
                                type="checkbox"
                                checked={param.optional}
                                onChange={(e) => updateToolParameter(index, 'optional', e.target.checked)}
                                className="w-3 h-3 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                disabled={isLoading}
                              />
                              Optional parameter
                            </label>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* AI Guidance Section */}
                <div className="border-t pt-4 mt-4">
                  <span className="text-sm font-medium text-gray-700">AI Guidance</span>
                </div>

                <div>
                  <label htmlFor="when-to-use" className="block text-sm font-medium text-gray-700 mb-1">
                    When to Use
                  </label>
                  <textarea
                    id="when-to-use"
                    value={whenToUse}
                    onChange={(e) => setWhenToUse(e.target.value)}
                    placeholder="Describe scenarios when the AI should trigger this flow..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary resize-none"
                    rows={3}
                    disabled={isLoading}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Help the AI understand when this flow is the right choice.
                  </p>
                </div>

                <div>
                  <label htmlFor="when-not-to-use" className="block text-sm font-medium text-gray-700 mb-1">
                    When Not to Use
                  </label>
                  <textarea
                    id="when-not-to-use"
                    value={whenNotToUse}
                    onChange={(e) => setWhenNotToUse(e.target.value)}
                    placeholder="Describe scenarios when the AI should NOT trigger this flow..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary resize-none"
                    rows={3}
                    disabled={isLoading}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Help the AI avoid triggering this flow inappropriately.
                  </p>
                </div>
              </>
            )}

            {/* ApiCall-specific fields */}
            {effectiveNodeType === 'ApiCall' && (
              <>
                {/* Use Previous Outputs component - only show in edit mode when we have a node ID */}
                {isEditMode && node && (
                  <UsePreviousOutputs
                    upstreamNodes={upstreamNodes}
                    isLoading={upstreamLoading}
                    error={upstreamError}
                    onRefresh={refreshUpstream}
                  />
                )}

                {/* Method dropdown */}
                <div>
                  <label htmlFor="api-method" className="block text-sm font-medium text-gray-700 mb-1">
                    HTTP Method
                  </label>
                  <select
                    id="api-method"
                    value={apiMethod}
                    onChange={(e) => setApiMethod(e.target.value as HttpMethod)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                    disabled={isLoading}
                  >
                    {HTTP_METHODS.map((method) => (
                      <option key={method.value} value={method.value}>
                        {method.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* URL input */}
                <div>
                  <label htmlFor="api-url" className="block text-sm font-medium text-gray-700 mb-1">
                    URL
                  </label>
                  <input
                    id="api-url"
                    type="text"
                    value={apiUrl}
                    onChange={(e) => setApiUrl(e.target.value)}
                    placeholder="https://api.example.com/endpoint"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                    required
                    disabled={isLoading}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Use {'{{ nodeSlug.path }}'} syntax to reference upstream node outputs.
                  </p>
                </div>

                {/* Headers editor */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-gray-700">
                      Headers
                    </label>
                    <button
                      type="button"
                      onClick={addHeader}
                      disabled={isLoading}
                      className="flex items-center gap-1 text-sm text-orange-600 hover:text-orange-700 disabled:opacity-50"
                    >
                      <Plus className="w-4 h-4" />
                      Add Header
                    </button>
                  </div>
                  {apiHeaders.length === 0 ? (
                    <p className="text-sm text-gray-500 bg-gray-50 rounded-lg p-3">
                      No headers configured. Click "Add Header" to add one.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {apiHeaders.map((header, index) => (
                        <div key={index} className="flex gap-2">
                          <input
                            type="text"
                            value={header.key}
                            onChange={(e) => updateHeader(index, 'key', e.target.value)}
                            placeholder="Header name"
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary text-sm"
                            disabled={isLoading}
                          />
                          <input
                            type="text"
                            value={header.value}
                            onChange={(e) => updateHeader(index, 'value', e.target.value)}
                            placeholder="Header value"
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary text-sm"
                            disabled={isLoading}
                          />
                          <button
                            type="button"
                            onClick={() => removeHeader(index)}
                            disabled={isLoading}
                            className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Timeout input */}
                <div>
                  <label htmlFor="api-timeout" className="block text-sm font-medium text-gray-700 mb-1">
                    Timeout (ms)
                  </label>
                  <input
                    id="api-timeout"
                    type="number"
                    value={apiTimeout}
                    onChange={(e) => setApiTimeout(Math.max(1000, Math.min(300000, Number(e.target.value))))}
                    min={1000}
                    max={300000}
                    step={1000}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                    disabled={isLoading}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Request timeout in milliseconds (1000-300000). Default: 30000 (30 seconds).
                  </p>
                </div>

                {/* Template References Display - shows input requirements from {{ }} variables */}
                <TemplateReferencesDisplay
                  values={[apiUrl, ...apiHeaders.map(h => h.value)]}
                  upstreamNodes={upstreamNodes}
                  isConnected={upstreamNodes.length > 0}
                />
              </>
            )}

            {/* JavaScriptCodeTransform-specific fields */}
            {effectiveNodeType === 'JavaScriptCodeTransform' && (
              <>
                {/* Available Input Data - show fields with click-to-copy JS paths */}
                {isEditMode && node && (
                  <div className="bg-teal-50 border border-teal-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Code className="w-4 h-4 text-teal-600" />
                        <span className="text-sm font-medium text-teal-800">Available Input Data</span>
                      </div>
                      {upstreamLoading && (
                        <span className="text-xs text-teal-600">Loading...</span>
                      )}
                    </div>

                    {upstreamError && (
                      <p className="text-sm text-red-600 mb-2">{upstreamError}</p>
                    )}

                    {!upstreamLoading && upstreamNodes.length === 0 && (
                      <p className="text-sm text-teal-700">
                        Connect this node to an upstream node to see available data fields.
                      </p>
                    )}

                    {upstreamNodes.length > 0 && (
                      <div className="space-y-3">
                        {upstreamNodes.map(node => (
                          <div key={node.id}>
                            <p className="text-xs font-medium text-teal-700 mb-1">
                              From: {node.name} ({node.type})
                            </p>
                            {node.fields.length > 0 ? (
                              <div className="flex flex-wrap gap-1.5">
                                {node.fields.map(field => (
                                  <button
                                    key={field.path}
                                    type="button"
                                    onClick={() => {
                                      navigator.clipboard.writeText(`input.${node.slug}.${field.path}`);
                                    }}
                                    className="inline-flex items-center gap-1 px-2 py-1 bg-white border border-teal-300 rounded text-xs font-mono text-teal-800 hover:bg-teal-100 hover:border-teal-400 transition-colors"
                                    title={`Click to copy: input.${node.slug}.${field.path}${field.description ? `\n${field.description}` : ''}`}
                                  >
                                    <span>input.{node.slug}.{field.path}</span>
                                    <span className="text-teal-500">: {field.type}</span>
                                  </button>
                                ))}
                              </div>
                            ) : (
                              <p className="text-xs text-teal-600 italic">No typed fields available</p>
                            )}
                          </div>
                        ))}
                        <p className="text-xs text-teal-600 mt-2">
                          Click a field to copy the JavaScript path to clipboard.
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Code editor */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Transform Function
                  </label>
                  <p className="text-xs text-gray-500 mb-2">
                    Write a TypeScript function that transforms the input data. The function receives <code className="bg-gray-100 px-1 rounded">input</code> with data from all connected nodes keyed by slug (e.g., <code className="bg-gray-100 px-1 rounded">input.nodeSlug.field</code>).
                  </p>
                  <CodeEditor
                    value={transformCode}
                    onChange={setTransformCode}
                    placeholder={`function transform(input: Input) {
  // Access data from connected nodes by their slug
  // e.g., input.callPokemonApi.body, input.listPokemons.triggered
  return input;
}`}
                    height="250px"
                    disabled={isLoading}
                    error={codeValidationError?.message}
                    language="typescript"
                  />
                  {isCodeValid && transformCode.trim() && (
                    <div className="mt-2 flex items-center gap-1 text-green-600 text-xs">
                      <CheckCircle className="w-3.5 h-3.5" />
                      <span>Valid syntax</span>
                    </div>
                  )}
                </div>

                {/* Test section */}
                <div className="border border-teal-200 bg-teal-50 rounded-lg p-4 space-y-4">
                  <div className="flex items-center gap-2">
                    <Shuffle className="w-4 h-4 text-teal-600" />
                    <span className="text-sm font-medium text-teal-800">Test Transform</span>
                  </div>

                  {/* Test input */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Sample Input (JSON)
                    </label>
                    <JSONEditor
                      value={testInput}
                      onChange={setTestInput}
                      placeholder='{"example": "data"}'
                      height="150px"
                      disabled={isLoading || isTestLoading}
                    />
                  </div>

                  {/* Test button */}
                  <button
                    type="button"
                    onClick={handleTestTransform}
                    disabled={isLoading || isTestLoading || !isCodeValid}
                    className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white text-sm font-medium rounded-lg hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {isTestLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Testing...
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4" />
                        Test Transform
                      </>
                    )}
                  </button>

                  {/* Test result */}
                  {testResult && (
                    <div className={`p-3 rounded-lg ${testResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                      <div className="flex items-center gap-2 mb-2">
                        {testResult.success ? (
                          <>
                            <CheckCircle className="w-4 h-4 text-green-600" />
                            <span className="text-sm font-medium text-green-800">
                              Success ({testResult.executionTimeMs}ms)
                            </span>
                          </>
                        ) : (
                          <>
                            <AlertCircle className="w-4 h-4 text-red-600" />
                            <span className="text-sm font-medium text-red-800">Error</span>
                          </>
                        )}
                      </div>
                      {testResult.success ? (
                        <pre className="text-xs text-gray-700 bg-white p-2 rounded border overflow-x-auto">
                          {JSON.stringify(testResult.output, null, 2)}
                        </pre>
                      ) : (
                        <p className="text-sm text-red-700">{testResult.error}</p>
                      )}
                    </div>
                  )}
                </div>

                {/* Output schema preview */}
                <div>
                  <SchemaPreview
                    schema={testedOutputSchema || resolvedOutputSchema}
                    title="Inferred Output Schema"
                  />
                  <p className="text-xs text-gray-500 mt-2">
                    Run "Test Transform" to infer the output schema from your code.
                  </p>
                </div>
              </>
            )}

            {/* Link-specific fields */}
            {effectiveNodeType === 'Link' && (
              <>
                {/* Use Previous Outputs component - only show in edit mode when we have a node ID */}
                {isEditMode && node && (
                  <UsePreviousOutputs
                    upstreamNodes={upstreamNodes}
                    isLoading={upstreamLoading}
                    error={upstreamError}
                    onRefresh={refreshUpstream}
                  />
                )}

                <div>
                  <label htmlFor="link-href" className="block text-sm font-medium text-gray-700 mb-1">
                    URL
                  </label>
                  <input
                    type="text"
                    id="link-href"
                    value={linkHref}
                    onChange={(e) => setLinkHref(e.target.value)}
                    placeholder="https://example.com or {{ nodeSlug.field }}"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                    disabled={isLoading}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Enter a static URL or use {'{{ nodeSlug.path }}'} syntax to reference upstream node outputs.
                  </p>
                </div>

                {/* Template References Display - shows input requirements from {{ }} variables */}
                {isEditMode && (
                  <TemplateReferencesDisplay
                    values={[linkHref]}
                    upstreamNodes={upstreamNodes}
                    isConnected={upstreamNodes.length > 0}
                  />
                )}
              </>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t bg-gray-50 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading || !name.trim()}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>{isEditMode ? 'Save Changes' : 'Create'}</>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
