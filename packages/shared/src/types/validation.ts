/**
 * Validation types for code validation in the editor.
 */

/**
 * A single validation error with location information.
 */
export interface ValidationError {
  /** Line number (1-indexed) */
  line: number;

  /** Column number (1-indexed) */
  column: number;

  /** Error message describing the issue */
  message: string;

  /** Severity level */
  severity: 'error' | 'warning';
}

/**
 * Result of validating code.
 */
export interface ValidationResult {
  /** Whether the code passed validation (no errors) */
  isValid: boolean;

  /** List of errors and warnings found */
  errors: ValidationError[];
}
