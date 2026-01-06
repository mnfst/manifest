import { useState, useEffect } from 'react';
import type {
  NodeInstance,
  NodeType,
  Flow,
  InterfaceNodeParameters,
  ReturnNodeParameters,
  CallFlowNodeParameters,
  UserIntentNodeParameters,
  LayoutTemplate,
  MockData,
} from '@chatgpt-app-builder/shared';
import {
  DEFAULT_TABLE_MOCK_DATA,
  DEFAULT_POST_LIST_MOCK_DATA,
} from '@chatgpt-app-builder/shared';
import { X, Loader2, LayoutGrid, FileText, PhoneForwarded, Zap } from 'lucide-react';

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

const LAYOUT_OPTIONS: { value: LayoutTemplate; label: string }[] = [
  { value: 'table', label: 'Table' },
  { value: 'post-list', label: 'Post List' },
];

function getDefaultMockData(layout: LayoutTemplate): MockData {
  if (layout === 'post-list') {
    return DEFAULT_POST_LIST_MOCK_DATA;
  }
  return DEFAULT_TABLE_MOCK_DATA;
}

/**
 * Modal for creating and editing nodes (Interface, Return, CallFlow)
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

  // Common fields
  const [name, setName] = useState('');

  // Interface node fields
  const [layoutTemplate, setLayoutTemplate] = useState<LayoutTemplate>('table');
  const [mockData, setMockData] = useState<MockData>(DEFAULT_TABLE_MOCK_DATA);

  // Return node fields
  const [text, setText] = useState('');

  // CallFlow node fields
  const [targetFlowId, setTargetFlowId] = useState<string | null>(null);

  // UserIntent node fields
  const [whenToUse, setWhenToUse] = useState('');
  const [whenNotToUse, setWhenNotToUse] = useState('');

  // Initialize form when modal opens or node changes
  useEffect(() => {
    if (!isOpen) return;

    if (node) {
      // Edit mode - populate from existing node
      setName(node.name);

      if (node.type === 'Interface') {
        const params = node.parameters as unknown as InterfaceNodeParameters;
        setLayoutTemplate(params?.layoutTemplate || 'table');
        setMockData(params?.mockData || DEFAULT_TABLE_MOCK_DATA);
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
      }
    } else {
      // Create mode - set defaults
      setName('');
      setLayoutTemplate('table');
      setMockData(DEFAULT_TABLE_MOCK_DATA);
      setText('');
      setTargetFlowId(null);
      setWhenToUse('');
      setWhenNotToUse('');
    }
  }, [isOpen, node]);

  const handleLayoutChange = (newLayout: LayoutTemplate) => {
    setLayoutTemplate(newLayout);
    // Update mock data to match the new layout
    setMockData(getDefaultMockData(newLayout));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    let parameters: Record<string, unknown> = {};

    if (effectiveNodeType === 'Interface') {
      parameters = { layoutTemplate, mockData };
    } else if (effectiveNodeType === 'Return') {
      parameters = { text };
    } else if (effectiveNodeType === 'CallFlow') {
      parameters = { targetFlowId };
    } else if (effectiveNodeType === 'UserIntent') {
      parameters = { whenToUse, whenNotToUse };
    }

    await onSave({ name, parameters });
  };

  if (!isOpen || !effectiveNodeType) return null;

  // Filter out current flow from available targets
  const availableFlows = flows.filter((f) => f.id !== currentFlowId);

  // Get icon and title based on node type
  const getNodeTypeInfo = () => {
    switch (effectiveNodeType) {
      case 'Interface':
        return {
          icon: <LayoutGrid className="w-5 h-5 text-gray-600" />,
          title: isEditMode ? 'Edit Interface' : 'Create Interface',
          description: 'Display data with a layout template',
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

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
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

            {/* Interface-specific fields */}
            {effectiveNodeType === 'Interface' && (
              <>
                <div>
                  <label htmlFor="layout-template" className="block text-sm font-medium text-gray-700 mb-1">
                    Layout Template
                  </label>
                  <select
                    id="layout-template"
                    value={layoutTemplate}
                    onChange={(e) => handleLayoutChange(e.target.value as LayoutTemplate)}
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

                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-sm text-gray-600">
                    Mock data will be initialized with default values for the selected layout.
                    You can edit the mock data after creating the node.
                  </p>
                </div>
              </>
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
                      {flow.name} ({flow.toolName})
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
