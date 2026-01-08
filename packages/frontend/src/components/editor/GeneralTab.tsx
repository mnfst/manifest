/**
 * GeneralTab - Name and schema configuration for UI nodes.
 * Part of the unified Interface Editor.
 */

interface GeneralTabProps {
  /** Current node name */
  name: string;
  /** Callback when name changes */
  onNameChange: (name: string) => void;
  /** Whether the form is disabled */
  disabled?: boolean;
}

export function GeneralTab({ name, onNameChange, disabled = false }: GeneralTabProps) {
  return (
    <div className="space-y-6">
      {/* Name field */}
      <div>
        <label htmlFor="node-name" className="block text-sm font-medium text-gray-700 mb-1">
          Name
        </label>
        <input
          id="node-name"
          type="text"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder="Enter node name"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
          disabled={disabled}
          maxLength={100}
        />
        <p className="text-xs text-gray-500 mt-1">
          A descriptive name for this UI component.
        </p>
      </div>

      {/* Schema info - read-only for now */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Component Type
        </label>
        <div className="px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-600 text-sm">
          UI Component (StatCard)
        </div>
        <p className="text-xs text-gray-500 mt-1">
          This node renders a customizable UI component.
        </p>
      </div>
    </div>
  );
}
