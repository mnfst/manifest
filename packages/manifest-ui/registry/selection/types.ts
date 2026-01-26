// Shared types for Selection category components

/**
 * Represents a selectable option with label and description.
 * @interface Option
 */
export interface Option {
  label?: string
  description?: string
  icon?: React.ReactNode
  disabled?: boolean
}
