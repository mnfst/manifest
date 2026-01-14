import { useCallback, useMemo } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { css } from '@codemirror/lang-css';
import { EditorView } from '@codemirror/view';
import type { ThemeVariables } from '@chatgpt-app-builder/shared';
import { formatCssVariables, parseCssVariables } from '../../lib/hsl-utils';

interface ThemeCodeEditorProps {
  /** Current theme variables */
  variables: ThemeVariables;
  /** Callback when variables change */
  onChange: (variables: Partial<ThemeVariables>) => void;
  /** Map of validation errors */
  errors: Map<string, string>;
}

// Light theme for the code editor
const lightTheme = EditorView.theme({
  '&': {
    backgroundColor: 'hsl(var(--background))',
    color: 'hsl(var(--foreground))',
  },
  '.cm-content': {
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
    fontSize: '13px',
  },
  '.cm-gutters': {
    backgroundColor: 'hsl(var(--muted))',
    color: 'hsl(var(--muted-foreground))',
    border: 'none',
  },
  '.cm-activeLine': {
    backgroundColor: 'hsl(var(--accent) / 0.3)',
  },
  '.cm-selectionBackground': {
    backgroundColor: 'hsl(var(--primary) / 0.2) !important',
  },
  '&.cm-focused .cm-cursor': {
    borderLeftColor: 'hsl(var(--primary))',
  },
});

/**
 * CodeMirror-based CSS editor for theme variables
 * Provides syntax highlighting and bidirectional sync with visual controls
 */
export function ThemeCodeEditor({
  variables,
  onChange,
  errors,
}: ThemeCodeEditorProps) {
  // Format variables as CSS for display
  const cssContent = useMemo(() => {
    return formatCssVariables(variables);
  }, [variables]);

  // Handle code changes
  const handleChange = useCallback(
    (value: string) => {
      const parsed = parseCssVariables(value);
      if (Object.keys(parsed).length > 0) {
        onChange(parsed);
      }
    },
    [onChange]
  );

  // Build error annotations for display
  const errorMessages = useMemo(() => {
    if (errors.size === 0) return null;
    const messages: string[] = [];
    errors.forEach((error, key) => {
      messages.push(`${key}: ${error}`);
    });
    return messages;
  }, [errors]);

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <div className="bg-muted px-3 py-2 border-b border-border">
        <h3 className="text-sm font-medium text-foreground">CSS Variables</h3>
        <p className="text-xs text-muted-foreground">
          Edit theme as CSS custom properties
        </p>
      </div>
      <CodeMirror
        value={cssContent}
        height="400px"
        extensions={[css(), lightTheme]}
        onChange={handleChange}
        basicSetup={{
          lineNumbers: true,
          highlightActiveLineGutter: true,
          highlightActiveLine: true,
          bracketMatching: true,
          closeBrackets: true,
          autocompletion: false,
          foldGutter: false,
        }}
      />
      {/* Error display */}
      {errorMessages && errorMessages.length > 0 && (
        <div className="bg-destructive/10 border-t border-destructive/20 px-3 py-2">
          <p className="text-xs font-medium text-destructive mb-1">
            Validation Errors:
          </p>
          <ul className="text-xs text-destructive space-y-0.5">
            {errorMessages.map((msg, i) => (
              <li key={i}>{msg}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
