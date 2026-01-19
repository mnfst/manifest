import type { ValidationError } from '@manifest/shared';

/**
 * State for the Interface node code editor.
 */
export interface EditorState {
  /** The node being edited */
  nodeId: string;

  /** Flow ID the node belongs to */
  flowId: string;

  /** Current code in editor (may differ from saved) */
  code: string;

  /** Whether there are unsaved changes */
  isDirty: boolean;

  /** Current validation errors */
  errors: ValidationError[];

  /** Active view mode */
  viewMode: 'preview' | 'code';
}

/**
 * Props for the InterfaceEditor component.
 */
export interface InterfaceEditorProps {
  /** Flow ID containing the node */
  flowId: string;

  /** Node ID being edited */
  nodeId: string;

  /** Node name for display */
  nodeName: string;

  /** Layout template type */
  layoutTemplate: string;

  /** Initial custom code (undefined if using default) */
  initialCode?: string;

  /** Callback when editor is closed */
  onClose: () => void;

  /** Callback when code is saved */
  onSave: (code: string) => Promise<void>;
}
