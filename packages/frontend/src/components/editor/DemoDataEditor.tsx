/**
 * DemoDataEditor - JSON editor wrapper with error display for demo data editing.
 * Provides live JSON editing with validation feedback.
 */
import { JSONEditor } from '../common/JSONEditor';

export interface DemoDataEditorProps {
  /** JSON string value */
  value: string;
  /** Called on any edit to the JSON string */
  onChange: (value: string) => void;
  /** Parse error message to display (null if valid) */
  error: string | null;
  /** Disable editing */
  disabled?: boolean;
}

/**
 * Demo data editor component.
 * Wraps JSONEditor with error display for validation feedback.
 * Error styling: red border and error text below editor.
 */
export function DemoDataEditor({
  value,
  onChange,
  error,
  disabled = false,
}: DemoDataEditorProps) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 min-h-0">
        <div className={`h-full ${error ? '[&_.json-editor-wrapper]:border-red-500' : ''}`}>
          <JSONEditor
            value={value}
            onChange={onChange}
            disabled={disabled}
            height="100%"
            placeholder='{"key": "value"}'
          />
        </div>
      </div>

      {error && (
        <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-700">
            <span className="font-medium">Invalid JSON:</span> {error}
          </p>
        </div>
      )}

      {!error && (
        <p className="mt-2 text-xs text-muted-foreground">
          Edit the JSON to change the preview data. Changes update the preview in real-time.
        </p>
      )}
    </div>
  );
}

export default DemoDataEditor;
