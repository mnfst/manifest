import { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/shadcn/button';
import { Input } from '@/components/ui/shadcn/input';
import { Label } from '@/components/ui/shadcn/label';
import { Textarea } from '@/components/ui/shadcn/textarea';
import { Checkbox } from '@/components/ui/shadcn/checkbox';
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
import { USER_QUERY_PARAMETER } from '@chatgpt-app-builder/shared';
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
import { useTestApiRequest } from '../../hooks/useTestApiRequest';

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
  const nameInputRef = useRef<HTMLInputElement>(null);

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
  const [apiResolvedOutputSchema, setApiResolvedOutputSchema] = useState<JSONSchema | null>(null);

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

  // Test API request hook
  const {
    testRequest,
    isLoading: isApiTestLoading,
    result: apiTestResult,
    outputSchema: apiTestedOutputSchema,
    reset: resetApiTest,
  } = useTestApiRequest(currentFlowId);

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

    // Auto-focus the name input after a short delay to ensure modal is rendered
    setTimeout(() => nameInputRef.current?.focus(), 100);

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
        setApiResolvedOutputSchema(params?.resolvedOutputSchema || null);
        resetApiTest();
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
      // Initialize UserIntent with default system parameters
      setToolParameters([USER_QUERY_PARAMETER]);
      setIsToolActive(true);
      setApiMethod('GET');
      setApiUrl('');
      setApiHeaders([]);
      setApiTimeout(30000);
      setApiResolvedOutputSchema(null);
      setTransformCode(DEFAULT_TRANSFORM_CODE);
      setResolvedOutputSchema(null);
      setTestInput('{}');
      resetTest();
      resetApiTest();
      setLinkHref('');
    }
  }, [isOpen, node, resetTest, resetApiTest]);

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
      // Use tested output schema if available, otherwise use resolved schema from node
      const finalApiOutputSchema = apiTestedOutputSchema || apiResolvedOutputSchema;
      parameters = {
        method: apiMethod,
        url: apiUrl,
        headers: apiHeaders,
        timeout: apiTimeout,
        inputMappings: [],
        resolvedOutputSchema: finalApiOutputSchema,
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
    const newParam: FlowParameter = { name: '', type: 'string', description: '', optional: false };
    // Keep system parameters at the start
    const systemParams = toolParameters.filter((p) => p.isSystem);
    const userParams = toolParameters.filter((p) => !p.isSystem);
    setToolParameters([...systemParams, ...userParams, newParam]);
  };

  const removeToolParameter = (index: number) => {
    // Prevent removing system parameters
    if (toolParameters[index]?.isSystem) return;
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

  // Test API request handler for ApiCall
  const handleTestApiRequest = async () => {
    if (!node) return;
    // Pass saveSchema: true to automatically save the inferred schema
    const result = await testRequest(node.id, {}, true);
    // Update local state with the saved schema so it shows in the UI
    if (result?.outputSchema) {
      setApiResolvedOutputSchema(result.outputSchema);
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
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            disabled={isLoading}
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Tab Navigation (only show in edit mode) */}
        {isEditMode && (
          <div className="flex border-b px-6">
            <Button
              variant="ghost"
              type="button"
              onClick={() => setActiveTab('config')}
              className={`rounded-none border-b-2 ${
                activeTab === 'config'
                  ? 'text-primary border-primary'
                  : 'text-gray-500 border-transparent hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Configuration
            </Button>
            <Button
              variant="ghost"
              type="button"
              onClick={() => setActiveTab('schema')}
              className={`rounded-none border-b-2 ${
                activeTab === 'schema'
                  ? 'text-primary border-primary'
                  : 'text-gray-500 border-transparent hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Code className="w-4 h-4" />
              Schema
            </Button>
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
              <Label htmlFor="node-name" className="block text-sm font-medium text-gray-700 mb-1">
                Name
              </Label>
              <Input
                ref={nameInputRef}
                id="node-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={`Enter ${effectiveNodeType.toLowerCase()} name`}
                className="w-full"
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
                  <Label htmlFor="return-text" className="block text-sm font-medium text-gray-700 mb-1">
                    Return Text
                  </Label>
                  <Textarea
                    id="return-text"
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="Enter the text to return to the user... Use {{ nodeSlug.field }} for dynamic values"
                    className="w-full resize-none"
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
                <Label htmlFor="target-flow" className="block text-sm font-medium text-gray-700 mb-1">
                  Target Flow
                </Label>
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
                      <Label className="block text-sm font-medium text-gray-700 mb-1">
                        Tool Name
                      </Label>
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
                    <Label htmlFor="tool-description" className="block text-sm font-medium text-gray-700 mb-1">
                      Tool Description
                    </Label>
                    <Textarea
                      id="tool-description"
                      value={toolDescription}
                      onChange={(e) => setToolDescription(e.target.value)}
                      placeholder="Describe what this tool does for MCP clients..."
                      className="w-full resize-none"
                      rows={2}
                      disabled={isLoading}
                    />
                  </div>

                  {/* Active Toggle Switch (T030-T033) */}
                  <div className="flex items-center justify-between mb-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="flex flex-col">
                      <Label htmlFor="tool-active" className="text-sm font-medium text-gray-700">
                        Active
                      </Label>
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
                        <Label className="block text-sm font-medium text-gray-700">
                          Tool Parameters
                        </Label>
                        <span className="text-xs text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded" title="Parameters you define here become dynamic output fields that downstream nodes can reference">
                          become outputs
                        </span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        type="button"
                        onClick={addToolParameter}
                        disabled={isLoading}
                        className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                      >
                        <Plus className="w-4 h-4" />
                        Add Parameter
                      </Button>
                    </div>
                    {toolParameters.length === 0 ? (
                      <p className="text-sm text-gray-500 bg-white rounded-lg p-3 border border-gray-200">
                        No parameters configured. This tool will accept no input arguments.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {toolParameters.map((param, index) => {
                          const isSystemParam = param.isSystem === true;
                          const isFieldDisabled = isLoading || isSystemParam;
                          return (
                            <div
                              key={index}
                              className={`rounded-lg p-3 border space-y-2 ${
                                isSystemParam
                                  ? 'bg-gray-50 border-gray-300 opacity-75'
                                  : 'bg-white border-gray-200'
                              }`}
                            >
                              <div className="flex gap-2 items-center">
                                {/* Lock icon for system parameters */}
                                {isSystemParam && (
                                  <div className="flex-shrink-0" title="System parameter (cannot be modified)">
                                    <svg
                                      className="w-4 h-4 text-gray-500"
                                      fill="none"
                                      stroke="currentColor"
                                      viewBox="0 0 24 24"
                                    >
                                      <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                                      />
                                    </svg>
                                  </div>
                                )}
                                <Input
                                  type="text"
                                  value={param.name}
                                  onChange={(e) => updateToolParameter(index, 'name', e.target.value)}
                                  placeholder="Parameter name"
                                  className={`flex-1 h-8 text-sm ${
                                    isSystemParam ? 'cursor-not-allowed bg-gray-100' : ''
                                  }`}
                                  disabled={isFieldDisabled}
                                />
                                <select
                                  value={param.type}
                                  onChange={(e) => updateToolParameter(index, 'type', e.target.value)}
                                  className={`px-2 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-primary focus:border-primary ${
                                    isSystemParam ? 'cursor-not-allowed bg-gray-100' : ''
                                  }`}
                                  disabled={isFieldDisabled}
                                >
                                  {PARAMETER_TYPES.map((t) => (
                                    <option key={t.value} value={t.value}>
                                      {t.label}
                                    </option>
                                  ))}
                                </select>
                                {/* Hide remove button for system parameters */}
                                {!isSystemParam && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    type="button"
                                    onClick={() => removeToolParameter(index)}
                                    disabled={isLoading}
                                    className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                )}
                              </div>
                              <Input
                                type="text"
                                value={param.description}
                                onChange={(e) => updateToolParameter(index, 'description', e.target.value)}
                                placeholder="Parameter description"
                                className={`w-full h-8 text-sm ${
                                  isSystemParam ? 'cursor-not-allowed bg-gray-100' : ''
                                }`}
                                disabled={isFieldDisabled}
                                maxLength={350}
                              />
                              <Label className={`flex items-center gap-2 text-sm text-gray-600 ${isSystemParam ? 'cursor-not-allowed' : ''}`}>
                                <Checkbox
                                  checked={param.optional}
                                  onCheckedChange={(checked) => updateToolParameter(index, 'optional', checked === true)}
                                  className="w-3 h-3"
                                  disabled={isFieldDisabled}
                                />
                                Optional parameter
                              </Label>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* AI Guidance Section */}
                <div className="border-t pt-4 mt-4">
                  <span className="text-sm font-medium text-gray-700">AI Guidance</span>
                </div>

                <div>
                  <Label htmlFor="when-to-use" className="block text-sm font-medium text-gray-700 mb-1">
                    When to Use
                  </Label>
                  <Textarea
                    id="when-to-use"
                    value={whenToUse}
                    onChange={(e) => setWhenToUse(e.target.value)}
                    placeholder="Describe scenarios when the AI should trigger this flow..."
                    className="w-full resize-none"
                    rows={3}
                    disabled={isLoading}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Help the AI understand when this flow is the right choice.
                  </p>
                </div>

                <div>
                  <Label htmlFor="when-not-to-use" className="block text-sm font-medium text-gray-700 mb-1">
                    When Not to Use
                  </Label>
                  <Textarea
                    id="when-not-to-use"
                    value={whenNotToUse}
                    onChange={(e) => setWhenNotToUse(e.target.value)}
                    placeholder="Describe scenarios when the AI should NOT trigger this flow..."
                    className="w-full resize-none"
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
                  <Label htmlFor="api-method" className="block text-sm font-medium text-gray-700 mb-1">
                    HTTP Method
                  </Label>
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
                  <Label htmlFor="api-url" className="block text-sm font-medium text-gray-700 mb-1">
                    URL
                  </Label>
                  <Input
                    id="api-url"
                    type="text"
                    value={apiUrl}
                    onChange={(e) => setApiUrl(e.target.value)}
                    placeholder="https://api.example.com/endpoint"
                    className="w-full"
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
                    <Label className="block text-sm font-medium text-gray-700">
                      Headers
                    </Label>
                    <Button
                      variant="ghost"
                      size="sm"
                      type="button"
                      onClick={addHeader}
                      disabled={isLoading}
                      className="text-orange-600 hover:text-orange-700 hover:bg-orange-50"
                    >
                      <Plus className="w-4 h-4" />
                      Add Header
                    </Button>
                  </div>
                  {apiHeaders.length === 0 ? (
                    <p className="text-sm text-gray-500 bg-gray-50 rounded-lg p-3">
                      No headers configured. Click "Add Header" to add one.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {apiHeaders.map((header, index) => (
                        <div key={index} className="flex gap-2">
                          <Input
                            type="text"
                            value={header.key}
                            onChange={(e) => updateHeader(index, 'key', e.target.value)}
                            placeholder="Header name"
                            className="flex-1 text-sm"
                            disabled={isLoading}
                          />
                          <Input
                            type="text"
                            value={header.value}
                            onChange={(e) => updateHeader(index, 'value', e.target.value)}
                            placeholder="Header value"
                            className="flex-1 text-sm"
                            disabled={isLoading}
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            type="button"
                            onClick={() => removeHeader(index)}
                            disabled={isLoading}
                            className="text-red-500 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Timeout input */}
                <div>
                  <Label htmlFor="api-timeout" className="block text-sm font-medium text-gray-700 mb-1">
                    Timeout (ms)
                  </Label>
                  <Input
                    id="api-timeout"
                    type="number"
                    value={apiTimeout}
                    onChange={(e) => setApiTimeout(Math.max(1000, Math.min(300000, Number(e.target.value))))}
                    min={1000}
                    max={300000}
                    step={1000}
                    className="w-full"
                    disabled={isLoading}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Request timeout in milliseconds (1000-300000). Default: 30000 (30 seconds).
                  </p>
                </div>

                {/* Test Request section - only show in edit mode */}
                {isEditMode && node && (
                  <div className="border border-orange-200 bg-orange-50 rounded-lg p-4 space-y-4">
                    <div className="flex items-center gap-2">
                      <Globe className="w-4 h-4 text-orange-600" />
                      <span className="text-sm font-medium text-orange-800">Test Request</span>
                    </div>

                    {/* Warning for mutating methods */}
                    {apiMethod !== 'GET' && (
                      <div className="bg-amber-100 border border-amber-300 rounded-lg p-3">
                        <div className="flex items-start gap-2">
                          <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                          <p className="text-sm text-amber-800">
                            This {apiMethod} request may modify data on the target server.
                            Test with caution.
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Test button */}
                    <Button
                      type="button"
                      onClick={handleTestApiRequest}
                      disabled={isLoading || isApiTestLoading || !apiUrl.trim()}
                      className="bg-orange-600 hover:bg-orange-700"
                    >
                      {isApiTestLoading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Sending...
                        </>
                      ) : (
                        <>
                          <Play className="w-4 h-4" />
                          Test Request
                        </>
                      )}
                    </Button>

                    {/* Test result */}
                    {apiTestResult && (
                      <div className={`rounded-lg border ${apiTestResult.success && apiTestResult.status && apiTestResult.status >= 200 && apiTestResult.status < 300 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                        {/* Status header */}
                        <div className="p-3 border-b border-inherit">
                          <div className="flex items-center gap-2">
                            {apiTestResult.success && apiTestResult.status && apiTestResult.status >= 200 && apiTestResult.status < 300 ? (
                              <>
                                <CheckCircle className="w-4 h-4 text-green-600" />
                                <span className="text-sm font-medium text-green-800">
                                  {apiTestResult.status} {apiTestResult.statusText}
                                </span>
                              </>
                            ) : (
                              <>
                                <AlertCircle className="w-4 h-4 text-red-600" />
                                <span className="text-sm font-medium text-red-800">
                                  {apiTestResult.error || `${apiTestResult.status} ${apiTestResult.statusText}`}
                                </span>
                              </>
                            )}
                            {apiTestResult.executionTimeMs && (
                              <span className="text-xs text-gray-500 ml-auto">
                                {apiTestResult.executionTimeMs}ms
                              </span>
                            )}
                          </div>
                          {apiTestResult.requestUrl && (
                            <p className="text-xs text-gray-500 mt-1 font-mono truncate">
                              {apiTestResult.requestUrl}
                            </p>
                          )}
                        </div>

                        {/* Response body */}
                        {apiTestResult.body !== undefined && (
                          <div className="p-3">
                            <p className="text-xs font-medium text-gray-700 mb-2">Response Body</p>
                            <pre className="text-xs text-gray-700 bg-white p-2 rounded border overflow-x-auto max-h-48">
                              {typeof apiTestResult.body === 'string'
                                ? apiTestResult.body
                                : JSON.stringify(apiTestResult.body, null, 2)}
                            </pre>
                          </div>
                        )}

                        {/* Inferred schema */}
                        {apiTestedOutputSchema && (
                          <div className="p-3 border-t border-inherit">
                            <SchemaPreview
                              schema={apiTestedOutputSchema}
                              title="Inferred Output Schema"
                            />
                          </div>
                        )}
                      </div>
                    )}

                    <p className="text-xs text-gray-500">
                      Test the API request to see the response. The output schema is automatically inferred and saved.
                    </p>
                  </div>
                )}

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
                  <Label className="block text-sm font-medium text-gray-700 mb-1">
                    Transform Function
                  </Label>
                  <p className="text-xs text-gray-500 mb-2">
                    Write a TypeScript function that transforms the input data. The function receives <code className="bg-gray-100 px-1 rounded">input</code> with data from all connected nodes keyed by slug (e.g., <code className="bg-gray-100 px-1 rounded">input.nodeSlug.field</code>).
                  </p>
                  <CodeEditor
                    value={transformCode}
                    onChange={setTransformCode}
                    placeholder={`function transform(input: Input) {
  // Access data from connected nodes by their slug
  // e.g., input.callPokemonApi.body, input.userIntent.toolName
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
                    <Label className="block text-sm font-medium text-gray-700 mb-1">
                      Sample Input (JSON)
                    </Label>
                    <JSONEditor
                      value={testInput}
                      onChange={setTestInput}
                      placeholder='{"example": "data"}'
                      height="150px"
                      disabled={isLoading || isTestLoading}
                    />
                  </div>

                  {/* Test button */}
                  <Button
                    type="button"
                    onClick={handleTestTransform}
                    disabled={isLoading || isTestLoading || !isCodeValid}
                    className="bg-teal-600 hover:bg-teal-700"
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
                  </Button>

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
                  <Label htmlFor="link-href" className="block text-sm font-medium text-gray-700 mb-1">
                    URL
                  </Label>
                  <Input
                    type="text"
                    id="link-href"
                    value={linkHref}
                    onChange={(e) => setLinkHref(e.target.value)}
                    placeholder="https://example.com or {{ nodeSlug.field }}"
                    className="w-full"
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
            <Button
              variant="ghost"
              type="button"
              onClick={onClose}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isLoading || !name.trim()}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>{isEditMode ? 'Save Changes' : 'Create'}</>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
