import { useState } from 'react';
import type { ThemeVariables } from '@manifest/shared';
import { useThemeEditor } from './hooks/useThemeEditor';
import { VariableControlGroup } from './VariableControlGroup';
import { ThemePreview } from './ThemePreview';
import { ThemeCodeEditor } from './ThemeCodeEditor';
import { ResetConfirmDialog } from './ResetConfirmDialog';
import { THEME_VARIABLE_GROUPS } from '@manifest/shared';
import type { ThemePreviewProps } from './types';
import { Button } from '../ui/shadcn/button';

type EditorMode = 'visual' | 'code';

interface ThemeEditorProps {
  /** Initial theme variables from the database */
  initialVariables: ThemeVariables;
  /** Callback to save theme variables */
  onSave: (variables: ThemeVariables) => Promise<void>;
  /** Custom preview component (optional) */
  PreviewComponent?: React.ComponentType<ThemePreviewProps>;
}

/**
 * Main theme editor component
 * Provides visual controls and code editor for editing shadcn theme variables
 */
export function ThemeEditor({
  initialVariables,
  onSave,
  PreviewComponent = ThemePreview,
}: ThemeEditorProps) {
  const [editorMode, setEditorMode] = useState<EditorMode>('visual');
  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const {
    variables,
    isDirty,
    isSaving,
    errors,
    isValid,
    updateVariable,
    updateAllVariables,
    save,
    resetToDefaults,
  } = useThemeEditor({
    initialVariables,
    onSave,
  });

  const handleSave = async () => {
    setSaveError(null);
    setSaveSuccess(false);
    try {
      await save();
      setSaveSuccess(true);
      // Clear success message after 3 seconds
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      console.error('Failed to save theme:', error);
      setSaveError(
        error instanceof Error ? error.message : 'Failed to save theme. Please try again.'
      );
    }
  };

  const handleResetConfirm = () => {
    resetToDefaults();
    setIsResetDialogOpen(false);
  };

  return (
    <div className="space-y-6">
      {/* Header with mode toggle and save button */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-semibold">Theme Editor</h2>
          <p className="text-sm text-muted-foreground">
            Customize your app's color scheme
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Mode toggle */}
          <div className="flex rounded-lg border border-input overflow-hidden">
            <Button
              type="button"
              variant={editorMode === 'visual' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setEditorMode('visual')}
              className="rounded-none px-3"
            >
              Visual
            </Button>
            <Button
              type="button"
              variant={editorMode === 'code' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setEditorMode('code')}
              className="rounded-none px-3"
            >
              Code
            </Button>
          </div>
          {/* Status indicators */}
          {isDirty && !saveSuccess && (
            <span className="text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded">
              Unsaved changes
            </span>
          )}
          {saveSuccess && (
            <span className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded">
              Saved successfully
            </span>
          )}
          <Button
            variant="outline"
            onClick={() => setIsResetDialogOpen(true)}
          >
            Reset to Default
          </Button>
          <Button
            onClick={handleSave}
            disabled={!isDirty || !isValid || isSaving}
          >
            {isSaving ? 'Saving...' : 'Save Theme'}
          </Button>
        </div>
      </div>

      {/* Validation errors summary */}
      {errors.size > 0 && (
        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3">
          <p className="text-sm text-destructive font-medium">
            Please fix {errors.size} validation error{errors.size > 1 ? 's' : ''} before saving
          </p>
        </div>
      )}

      {/* Save error message */}
      {saveError && (
        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 flex items-center justify-between">
          <p className="text-sm text-destructive font-medium">{saveError}</p>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setSaveError(null)}
            className="text-destructive hover:text-destructive/80 p-0 h-auto hover:bg-transparent"
          >
            Dismiss
          </Button>
        </div>
      )}

      {/* Visual editor mode */}
      {editorMode === 'visual' && (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {THEME_VARIABLE_GROUPS.map((group) => (
            <VariableControlGroup
              key={group.label}
              group={group}
              variables={variables}
              onChange={updateVariable}
              errors={errors}
            />
          ))}
        </div>
      )}

      {/* Code editor mode */}
      {editorMode === 'code' && (
        <ThemeCodeEditor
          variables={variables}
          onChange={updateAllVariables}
          errors={errors}
        />
      )}

      {/* Preview - below the editor */}
      <div className="border-t pt-6">
        <h3 className="text-sm font-medium text-muted-foreground mb-4">Preview</h3>
        <PreviewComponent themeVariables={variables} />
      </div>

      {/* Reset confirmation dialog */}
      <ResetConfirmDialog
        isOpen={isResetDialogOpen}
        onConfirm={handleResetConfirm}
        onCancel={() => setIsResetDialogOpen(false)}
      />
    </div>
  );
}
