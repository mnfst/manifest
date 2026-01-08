/**
 * InterfaceEditor - Full-screen editor for UI nodes.
 * Provides a unified interface with tabs for General, Appearance, Code, and Preview.
 */
import { useState, useCallback, useEffect, useMemo } from 'react';
import { X, Save, Code, Eye, Settings, Palette } from 'lucide-react';
import { CodeEditor } from './CodeEditor';
import { ComponentPreview } from './ComponentPreview';
import { GeneralTab } from './GeneralTab';
import { AppearanceTab } from './AppearanceTab';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../ui/tabs';
import {
  getTemplateDefaultCode,
  getTemplateSampleData,
  type AppearanceConfig,
  getDefaultAppearanceConfig,
} from '@chatgpt-app-builder/shared';
import { validateCode } from '../../lib/codeValidator';
import type { ValidationError } from '@chatgpt-app-builder/shared';

export interface InterfaceEditorProps {
  /** Flow ID containing the node */
  flowId: string;
  /** Node ID being edited */
  nodeId: string;
  /** Node name for display */
  nodeName: string;
  /** Component type for the node (used to get appearance schema) */
  componentType?: string;
  /** Initial custom code (undefined if using default) */
  initialCode?: string;
  /** Initial appearance configuration */
  initialAppearanceConfig?: AppearanceConfig;
  /** Callback when editor is closed */
  onClose: () => void;
  /** Callback when changes are saved */
  onSave: (data: { name: string; code: string; appearanceConfig: AppearanceConfig }) => Promise<void>;
}

/**
 * Full-screen editor for customizing UI node configuration.
 * Provides tabs for General (name), Appearance (visual options), Code (TSX), and Preview.
 */
export function InterfaceEditor({
  nodeName: initialNodeName,
  componentType = 'StatCard',
  initialCode,
  initialAppearanceConfig,
  onClose,
  onSave,
}: InterfaceEditorProps) {
  // Determine the initial code to display
  const defaultCode = getTemplateDefaultCode('stat-card');
  const startingCode = initialCode ?? defaultCode;
  const startingAppearanceConfig = initialAppearanceConfig ?? getDefaultAppearanceConfig(componentType);

  // Editor state - unified for all tabs
  const [name, setName] = useState(initialNodeName);
  const [code, setCode] = useState(startingCode);
  const [appearanceConfig, setAppearanceConfig] = useState<AppearanceConfig>(startingAppearanceConfig);
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
  const [previewKey, setPreviewKey] = useState(0);

  // Get sample data for preview
  const sampleData = useMemo(
    () => getTemplateSampleData('stat-card'),
    []
  );

  // Validate code when it changes
  useEffect(() => {
    const result = validateCode(code);
    setErrors(result.errors);
  }, [code]);

  // Track dirty state
  const updateDirtyState = useCallback(() => {
    const nameChanged = name !== initialNodeName;
    const codeChanged = code !== startingCode;
    const appearanceChanged = JSON.stringify(appearanceConfig) !== JSON.stringify(startingAppearanceConfig);
    setIsDirty(nameChanged || codeChanged || appearanceChanged);
  }, [name, code, appearanceConfig, initialNodeName, startingCode, startingAppearanceConfig]);

  useEffect(() => {
    updateDirtyState();
  }, [updateDirtyState]);

  // Handle name change
  const handleNameChange = useCallback((newName: string) => {
    setName(newName);
  }, []);

  // Handle code change and trigger preview update
  const handleCodeChange = useCallback((newCode: string) => {
    setCode(newCode);
    setPreviewKey((prev) => prev + 1);
  }, []);

  // Handle appearance config change and trigger preview update
  const handleAppearanceChange = useCallback((newConfig: AppearanceConfig) => {
    setAppearanceConfig(newConfig);
    setPreviewKey((prev) => prev + 1);
  }, []);

  // Handle save
  const handleSave = useCallback(async () => {
    // Validate before saving
    const result = validateCode(code);
    if (!result.isValid) {
      setErrors(result.errors);
      return;
    }

    setIsSaving(true);
    try {
      await onSave({ name, code, appearanceConfig });
      setIsDirty(false);
    } catch (err) {
      console.error('Failed to save:', err);
    } finally {
      setIsSaving(false);
    }
  }, [name, code, appearanceConfig, onSave]);

  // Handle close with unsaved changes check
  const handleClose = useCallback(() => {
    if (isDirty) {
      setShowUnsavedDialog(true);
    } else {
      onClose();
    }
  }, [isDirty, onClose]);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + S to save
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        if (!isSaving && errors.length === 0) {
          handleSave();
        }
      }
      // Escape to close (with unsaved check)
      if (e.key === 'Escape') {
        handleClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleSave, handleClose, isSaving, errors.length]);

  const hasErrors = errors.length > 0;
  const canSave = isDirty && !hasErrors && !isSaving && name.trim().length > 0;

  return (
    <div className="absolute inset-0 bg-background z-40 flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b bg-card">
        <div className="flex items-center gap-4">
          <button
            onClick={handleClose}
            className="p-2 hover:bg-muted rounded-lg transition-colors"
            title="Close (Esc)"
          >
            <X className="w-5 h-5" />
          </button>

          <div>
            <h1 className="text-lg font-semibold">{name || 'Untitled'}</h1>
            <p className="text-sm text-muted-foreground">
              Edit UI Component
              {isDirty && <span className="text-amber-500 ml-2">• Unsaved changes</span>}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Save button */}
          <button
            onClick={handleSave}
            disabled={!canSave}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              canSave
                ? 'bg-gray-900 text-white hover:bg-gray-800'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
            title={hasErrors ? 'Fix errors before saving' : !name.trim() ? 'Name is required' : 'Save (Cmd+S)'}
          >
            <Save className="w-4 h-4" />
            {isSaving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </header>

      {/* Main content with tabs */}
      <Tabs defaultValue="general" className="flex-1 flex flex-col overflow-hidden">
        <div className="px-4 bg-card">
          <TabsList>
            <TabsTrigger value="general" className="flex items-center gap-2">
              <Settings className="w-4 h-4" />
              General
            </TabsTrigger>
            <TabsTrigger value="appearance" className="flex items-center gap-2">
              <Palette className="w-4 h-4" />
              Appearance
            </TabsTrigger>
            <TabsTrigger value="code" className="flex items-center gap-2">
              <Code className="w-4 h-4" />
              Code
            </TabsTrigger>
            <TabsTrigger value="preview" className="flex items-center gap-2">
              <Eye className="w-4 h-4" />
              Preview
            </TabsTrigger>
          </TabsList>
        </div>

        {/* General Tab */}
        <TabsContent value="general" className="flex-1 overflow-auto p-6">
          <div className="max-w-xl">
            <GeneralTab
              name={name}
              onNameChange={handleNameChange}
              disabled={isSaving}
            />
          </div>
        </TabsContent>

        {/* Appearance Tab */}
        <TabsContent value="appearance" className="flex-1 overflow-auto p-6">
          <div className="max-w-xl">
            <AppearanceTab
              componentType={componentType}
              config={appearanceConfig}
              onChange={handleAppearanceChange}
              disabled={isSaving}
            />
          </div>
        </TabsContent>

        {/* Code Tab */}
        <TabsContent value="code" className="flex-1 overflow-auto p-4">
          <CodeEditor
            value={code}
            onChange={handleCodeChange}
            showLintErrors={true}
            minHeight="400px"
          />

          {/* Error summary panel */}
          {hasErrors && (
            <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-4">
              <h3 className="text-sm font-medium text-red-800 mb-2">
                {errors.length} error{errors.length !== 1 ? 's' : ''} found
              </h3>
              <ul className="space-y-1">
                {errors.slice(0, 5).map((error, index) => (
                  <li key={index} className="text-sm text-red-700">
                    <span className="font-mono text-red-500">
                      Line {error.line}:{error.column}
                    </span>{' '}
                    {error.message}
                  </li>
                ))}
                {errors.length > 5 && (
                  <li className="text-sm text-red-600 italic">
                    ...and {errors.length - 5} more errors
                  </li>
                )}
              </ul>
            </div>
          )}
        </TabsContent>

        {/* Preview Tab */}
        <TabsContent value="preview" className="flex-1 overflow-auto bg-muted/30 p-8">
          <div className="bg-card rounded-xl shadow-lg p-6 max-w-4xl mx-auto min-h-[400px]">
            <ComponentPreview
              code={code}
              sampleData={sampleData}
              renderKey={previewKey}
              appearanceConfig={appearanceConfig}
            />
          </div>
        </TabsContent>
      </Tabs>

      {/* Unsaved changes dialog */}
      {showUnsavedDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-60">
          <div className="bg-card rounded-xl shadow-xl p-6 max-w-md w-full mx-4">
            <h2 className="text-lg font-semibold mb-2">Unsaved Changes</h2>
            <p className="text-muted-foreground mb-6">
              You have unsaved changes. Do you want to save them before closing?
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowUnsavedDialog(false);
                  onClose();
                }}
                className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                Discard
              </button>
              <button
                onClick={() => setShowUnsavedDialog(false)}
                className="px-4 py-2 text-sm font-medium bg-muted hover:bg-muted/80 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  await handleSave();
                  setShowUnsavedDialog(false);
                  if (!hasErrors) {
                    onClose();
                  }
                }}
                disabled={hasErrors || !name.trim()}
                className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Save & Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default InterfaceEditor;
