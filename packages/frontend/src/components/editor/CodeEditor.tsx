/**
 * CodeEditor component - CodeMirror wrapper with TSX support and Manifest theme.
 */
import { useMemo, useCallback } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { javascript } from '@codemirror/lang-javascript';
import { linter, type Diagnostic } from '@codemirror/lint';
import { EditorView } from '@codemirror/view';
import { manifestTheme } from './manifestTheme';
import { createLinterDiagnostics } from '../../lib/codeValidator';

export interface CodeEditorProps {
  /** Current code value */
  value: string;
  /** Callback when code changes */
  onChange: (value: string) => void;
  /** Whether the editor is read-only */
  readOnly?: boolean;
  /** Whether to show validation errors inline */
  showLintErrors?: boolean;
  /** Minimum height of the editor */
  minHeight?: string;
  /** Placeholder text when empty */
  placeholder?: string;
}

/**
 * CodeEditor component using CodeMirror 6 with Manifest theme.
 * Provides TSX syntax highlighting and optional inline error display.
 */
export function CodeEditor({
  value,
  onChange,
  readOnly = false,
  showLintErrors = true,
  minHeight = '400px',
  placeholder = '// Start writing your component code here...',
}: CodeEditorProps) {
  // Create linter extension that validates TSX code
  const tsxLinter = useMemo(() => {
    if (!showLintErrors) return [];

    return [
      linter((view) => {
        const code = view.state.doc.toString();
        const diagnostics = createLinterDiagnostics(code);
        return diagnostics as Diagnostic[];
      }),
    ];
  }, [showLintErrors]);

  // Memoize extensions to prevent unnecessary re-renders
  const extensions = useMemo(
    () => [
      // TSX language support
      javascript({ jsx: true, typescript: true }),
      // Manifest theme
      ...manifestTheme,
      // Line wrapping
      EditorView.lineWrapping,
      // Linter for inline errors
      ...tsxLinter,
    ],
    [tsxLinter]
  );

  // Handle code changes
  const handleChange = useCallback(
    (newValue: string) => {
      onChange(newValue);
    },
    [onChange]
  );

  return (
    <div className="code-editor-container rounded-lg overflow-hidden border border-[#3a3a4a]">
      <CodeMirror
        value={value}
        onChange={handleChange}
        extensions={extensions}
        readOnly={readOnly}
        placeholder={placeholder}
        theme="none"
        basicSetup={{
          lineNumbers: true,
          highlightActiveLineGutter: true,
          highlightActiveLine: true,
          foldGutter: true,
          dropCursor: true,
          allowMultipleSelections: true,
          indentOnInput: true,
          bracketMatching: true,
          closeBrackets: true,
          autocompletion: true,
          rectangularSelection: true,
          crosshairCursor: false,
          highlightSelectionMatches: true,
          searchKeymap: true,
          tabSize: 2,
        }}
        style={{
          minHeight,
          fontSize: '14px',
        }}
      />
    </div>
  );
}

export default CodeEditor;
