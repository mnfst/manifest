import { useState, useEffect } from 'react';
import type {
  NodeInstance,
  NodeType,
  Flow,
  StatCardNodeParameters,
  ReturnNodeParameters,
  CallFlowNodeParameters,
  UserIntentNodeParameters,
  ApiCallNodeParameters,
  HttpMethod,
  HeaderEntry,
  LayoutTemplate,
  FlowParameter,
  ParameterType,
} from '@chatgpt-app-builder/shared';
import { X, Loader2, LayoutGrid, FileText, PhoneForwarded, Zap, Globe, Plus, Trash2, Wrench, Code } from 'lucide-react';
import { NodeSchemaPanel } from '../node/NodeSchemaPanel';

interface NodeEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: { name: string; parameters: Record<string, unknown> }) => Promise<void>;
  node: NodeInstance | null; // null for create mode
  nodeType: NodeType | null; // Required for create mode, derived from node for edit mode
  flows: Flow[]; // Available flows for CallFlow node
  currentFlowId: string; // Current flow ID (to exclude from CallFlow targets)
  isLoading?: boolean;
  error?: string | null;
}

type TabType = 'config' | 'schema';

const LAYOUT_OPTIONS: { value: LayoutTemplate; label: string }[] = [
  { value: 'stat-card', label: 'Stat Card' },
];

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
  isLoading = false,
  error = null,
}: NodeEditModalProps) {
  const isEditMode = node !== null;
  const effectiveNodeType = node?.type ?? nodeType;

  // Tab state - only show schema tab in edit mode
  const [activeTab, setActiveTab] = useState<TabType>('config');

  // Common fields
  const [name, setName] = useState('');

  // StatCard node fields
  const [layoutTemplate, setLayoutTemplate] = useState<LayoutTemplate>('stat-card');

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

  // Initialize form when modal opens or node changes
  useEffect(() => {
    if (!isOpen) return;

    // Reset to config tab when modal opens
    setActiveTab('config');

    if (node) {
      // Edit mode - populate from existing node
      setName(node.name);

      if (node.type === 'StatCard') {
        const params = node.parameters as unknown as StatCardNodeParameters;
        setLayoutTemplate(params?.layoutTemplate || 'stat-card');
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
      }
    } else {
      // Create mode - set defaults
      setName('');
      setLayoutTemplate('stat-card');
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
    }
  }, [isOpen, node]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    let parameters: Record<string, unknown> = {};

    if (effectiveNodeType === 'StatCard') {
      parameters = { layoutTemplate };
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
    }
  };

  const nodeInfo = getNodeTypeInfo();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[80vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg bg-${nodeInfo.color}-100 flex items-center justify-center`}>
              {nodeInfo.icon}
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">{nodeInfo.title}</h2>
              <p className="text-sm text-gray-500">{nodeInfo.description}</p>
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

            {/* StatCard-specific fields */}
            {effectiveNodeType === 'StatCard' && (
              <div>
                <label htmlFor="layout-template" className="block text-sm font-medium text-gray-700 mb-1">
                  Layout Template
                </label>
                <select
                  id="layout-template"
                  value={layoutTemplate}
                  onChange={(e) => setLayoutTemplate(e.target.value as LayoutTemplate)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                  disabled={isLoading}
                >
                  {LAYOUT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Return-specific fields */}
            {effectiveNodeType === 'Return' && (
              <div>
                <label htmlFor="return-text" className="block text-sm font-medium text-gray-700 mb-1">
                  Return Text
                </label>
                <textarea
                  id="return-text"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Enter the text to return to the user..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary resize-none"
                  rows={4}
                  disabled={isLoading}
                />
                <p className="text-xs text-gray-500 mt-1">
                  This text will be returned as the response when this flow completes.
                </p>
              </div>
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

                  {/* Is Active Toggle */}
                  <div className="flex items-center gap-2 mb-3">
                    <input
                      id="tool-active"
                      type="checkbox"
                      checked={isToolActive}
                      onChange={(e) => setIsToolActive(e.target.checked)}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      disabled={isLoading}
                    />
                    <label htmlFor="tool-active" className="text-sm text-gray-700">
                      Expose as MCP tool
                    </label>
                  </div>

                  {/* Tool Parameters */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-sm font-medium text-gray-700">
                        Tool Parameters
                      </label>
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
                    Use {'{{nodeId.path}}'} syntax to reference upstream node outputs.
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
