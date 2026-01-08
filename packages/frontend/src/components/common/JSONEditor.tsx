import { useCallback, useMemo } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { json, jsonParseLinter } from '@codemirror/lang-json';
import { linter } from '@codemirror/lint';
import { EditorView } from '@codemirror/view';

interface JSONEditorProps {
  /** The JSON value as a string */
  value: string;
  /** Callback when JSON changes */
  onChange: (value: string) => void;
  /** Placeholder text when empty */
  placeholder?: string;
  /** Height of the editor (default: 150px) */
  height?: string;
  /** Whether the editor is disabled */
  disabled?: boolean;
}

/**
 * Custom theme for the JSON editor - light theme consistent with app design.
 */
const customTheme = EditorView.theme({
  '&': {
    fontSize: '14px',
    border: '1px solid #e5e7eb',
    borderRadius: '0.5rem',
    overflow: 'hidden',
  },
  '&.cm-focused': {
    outline: 'none',
    borderColor: '#14b8a6',
    boxShadow: '0 0 0 2px rgba(20, 184, 166, 0.2)',
  },
  '.cm-content': {
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
    padding: '8px 0',
  },
  '.cm-line': {
    padding: '0 8px',
  },
  '.cm-gutters': {
    backgroundColor: '#f9fafb',
    borderRight: '1px solid #e5e7eb',
    color: '#9ca3af',
  },
  '.cm-activeLineGutter': {
    backgroundColor: '#f3f4f6',
  },
  '.cm-activeLine': {
    backgroundColor: '#f9fafb',
  },
});

/**
 * JSONEditor component for editing JSON data.
 * Uses CodeMirror with JSON syntax highlighting and validation.
 */
export function JSONEditor({
  value,
  onChange,
  placeholder = '{"example": "data"}',
  height = '150px',
  disabled = false,
}: JSONEditorProps) {
  const handleChange = useCallback(
    (newValue: string) => {
      if (!disabled) {
        onChange(newValue);
      }
    },
    [onChange, disabled]
  );

  // Create extensions with JSON support and linting
  const extensions = useMemo(
    () => [
      json(),
      customTheme,
      linter(jsonParseLinter()),
    ],
    []
  );

  return (
    <div className="json-editor-wrapper">
      <CodeMirror
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        height={height}
        readOnly={disabled}
        extensions={extensions}
        basicSetup={{
          lineNumbers: true,
          highlightActiveLineGutter: true,
          highlightActiveLine: true,
          foldGutter: true,
          dropCursor: true,
          indentOnInput: true,
          bracketMatching: true,
          closeBrackets: true,
          autocompletion: true,
          highlightSelectionMatches: true,
          tabSize: 2,
        }}
      />
    </div>
  );
}
