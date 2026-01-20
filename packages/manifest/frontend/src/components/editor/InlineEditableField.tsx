/**
 * InlineEditableField - Inline editable text field with pencil icon trigger.
 * Supports Enter to confirm, Escape to cancel, and blur to confirm.
 */
import { useState, useCallback, useRef, useEffect } from 'react';
import { Pencil } from 'lucide-react';

export interface InlineEditableFieldProps {
  /** Current text value */
  value: string;
  /** Called when edit is confirmed (Enter, blur) */
  onChange: (value: string) => void;
  /** Placeholder text when value is empty */
  placeholder?: string;
  /** Disable editing */
  disabled?: boolean;
  /** Maximum characters allowed */
  maxLength?: number;
  /** Additional CSS classes for the container */
  className?: string;
  /** CSS classes for the input element */
  inputClassName?: string;
  /** CSS classes for the display element */
  displayClassName?: string;
}

/**
 * Inline editable text field component.
 * Click the pencil icon to enter edit mode.
 * Press Enter or click outside to save, Escape to cancel.
 */
export function InlineEditableField({
  value,
  onChange,
  placeholder = 'Enter text...',
  disabled = false,
  maxLength,
  className = '',
  inputClassName = '',
  displayClassName = '',
}: InlineEditableFieldProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [tempValue, setTempValue] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync tempValue when value prop changes (external update)
  useEffect(() => {
    if (!isEditing) {
      setTempValue(value);
    }
  }, [value, isEditing]);

  // Focus input when entering edit mode
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleStartEdit = useCallback(() => {
    if (!disabled) {
      setTempValue(value);
      setIsEditing(true);
    }
  }, [disabled, value]);

  const handleConfirm = useCallback(() => {
    setIsEditing(false);
    if (tempValue !== value) {
      onChange(tempValue);
    }
  }, [tempValue, value, onChange]);

  const handleCancel = useCallback(() => {
    setIsEditing(false);
    setTempValue(value);
  }, [value]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleConfirm();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        handleCancel();
      }
    },
    [handleConfirm, handleCancel]
  );

  const handleBlur = useCallback(() => {
    handleConfirm();
  }, [handleConfirm]);

  if (isEditing) {
    return (
      <div className={`inline-flex items-center ${className}`}>
        <input
          ref={inputRef}
          type="text"
          value={tempValue}
          onChange={(e) => setTempValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          maxLength={maxLength}
          placeholder={placeholder}
          className={`px-2 py-1 text-lg font-semibold border border-primary rounded
            focus:outline-none focus:ring-2 focus:ring-primary/20 bg-background ${inputClassName}`}
        />
      </div>
    );
  }

  return (
    <div className={`inline-flex items-center gap-2 group ${className}`}>
      <span className={`text-lg font-semibold ${displayClassName}`}>
        {value || <span className="text-muted-foreground">{placeholder}</span>}
      </span>
      {!disabled && (
        <button
          type="button"
          onClick={handleStartEdit}
          className="p-1 rounded hover:bg-muted transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
          title="Edit"
          aria-label="Edit field"
        >
          <Pencil className="w-4 h-4 text-muted-foreground" />
        </button>
      )}
    </div>
  );
}

export default InlineEditableField;
