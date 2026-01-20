import { useCallback } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { javascript } from '@codemirror/lang-javascript';
import { EditorView } from '@codemirror/view';

interface CodeEditorProps {
  /** The code value */
  value: string;
  /** Callback when code changes */
  onChange: (value: string) => void;
  /** Placeholder text when empty */
  placeholder?: string;
  /** Height of the editor (default: 200px) */
  height?: string;
  /** Whether the editor is disabled */
  disabled?: boolean;
  /** Validation error message to display */
  error?: string | null;
  /** Line number of the error (for highlighting) */
  errorLine?: number;
  /** Language mode - javascript or typescript (default: javascript) */
  language?: 'javascript' | 'typescript';
}

/**
 * Custom theme for the code editor - light theme consistent with app design.
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
  // Error line highlighting
  '.cm-error-line': {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderLeft: '3px solid #ef4444',
  },
});

/**
 * CodeEditor component for editing JavaScript code.
 * Uses CodeMirror with JavaScript syntax highlighting.
 */
export function CodeEditor({
  value,
  onChange,
  placeholder = '// Enter your code here',
  height = '200px',
  disabled = false,
  error,
  language = 'javascript',
}: CodeEditorProps) {
  const handleChange = useCallback(
    (newValue: string) => {
      if (!disabled) {
        onChange(newValue);
      }
    },
    [onChange, disabled]
  );

  return (
    <div className="code-editor-wrapper">
      <CodeMirror
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        height={height}
        readOnly={disabled}
        extensions={[
          javascript({ jsx: false, typescript: language === 'typescript' }),
          customTheme,
        ]}
        basicSetup={{
          lineNumbers: true,
          highlightActiveLineGutter: true,
          highlightActiveLine: true,
          foldGutter: false,
          dropCursor: true,
          indentOnInput: true,
          bracketMatching: true,
          closeBrackets: true,
          autocompletion: true,
          highlightSelectionMatches: true,
          searchKeymap: false,
          tabSize: 2,
        }}
      />
      {error && (
        <div className="mt-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}
    </div>
  );
}
