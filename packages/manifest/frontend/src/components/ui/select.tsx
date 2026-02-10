import { cn } from '@/lib/utils';

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
      className={cn(
        "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        className
      )}
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
