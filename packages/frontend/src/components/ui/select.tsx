/**
 * Select component for dropdown selection.
 * Styled to match the existing select patterns in the app.
 */

interface SelectOption {
  value: string | number;
  label: string;
}

interface SelectProps {
  value: string | number;
  onValueChange: (value: string | number) => void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  id?: string;
  className?: string;
}

export function Select({
  value,
  onValueChange,
  options = [],
  placeholder,
  disabled = false,
  id,
  className = '',
}: SelectProps) {
  return (
    <select
      id={id}
      value={value}
      onChange={(e) => {
        const newValue = e.target.value;
        // Try to preserve number type if the original value was a number
        const numValue = Number(newValue);
        if (!isNaN(numValue) && typeof options[0]?.value === 'number') {
          onValueChange(numValue);
        } else {
          onValueChange(newValue);
        }
      }}
      disabled={disabled}
      className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary bg-white disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
    >
      {placeholder && (
        <option value="" disabled>
          {placeholder}
        </option>
      )}
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
