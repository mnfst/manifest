/**
 * Code validation utilities using Babel parser for TSX syntax validation.
 */
import { parse } from '@babel/parser';
import type { ValidationError, ValidationResult } from '@chatgpt-app-builder/shared';

/**
 * Babel parser options for TSX code.
 */
const PARSER_OPTIONS = {
  sourceType: 'module' as const,
  plugins: ['jsx', 'typescript'] as ('jsx' | 'typescript')[],
  errorRecovery: false,
};

/**
 * Validate TSX code for syntax errors.
 *
 * @param code - The TSX code to validate
 * @returns ValidationResult with isValid flag and array of errors
 */
export function validateCode(code: string): ValidationResult {
  // Check for empty code
  if (!code || code.trim().length === 0) {
    return {
      isValid: false,
      errors: [
        {
          line: 1,
          column: 1,
          message: 'Code cannot be empty',
          severity: 'error',
        },
      ],
    };
  }

  try {
    // Attempt to parse the code
    parse(code, PARSER_OPTIONS);

    // If parsing succeeds, code is valid
    return {
      isValid: true,
      errors: [],
    };
  } catch (error: unknown) {
    // Extract error information from Babel parser error
    const errors: ValidationError[] = [];

    if (error && typeof error === 'object' && 'loc' in error) {
      const babelError = error as {
        message: string;
        loc?: { line: number; column: number };
      };

      // Clean up the error message (remove position info that's redundant)
      let message = babelError.message;
      const posMatch = message.match(/\(\d+:\d+\)$/);
      if (posMatch) {
        message = message.slice(0, message.length - posMatch[0].length).trim();
      }

      errors.push({
        line: babelError.loc?.line ?? 1,
        column: (babelError.loc?.column ?? 0) + 1, // Babel uses 0-indexed columns
        message,
        severity: 'error',
      });
    } else if (error instanceof Error) {
      // Fallback for unexpected error format
      errors.push({
        line: 1,
        column: 1,
        message: error.message,
        severity: 'error',
      });
    } else {
      errors.push({
        line: 1,
        column: 1,
        message: 'Unknown syntax error',
        severity: 'error',
      });
    }

    return {
      isValid: false,
      errors,
    };
  }
}

/**
 * Create a CodeMirror-compatible linter source from validation.
 * Used to display inline errors in the editor.
 *
 * @param code - The code to validate
 * @returns Array of Diagnostic objects for CodeMirror
 */
export function createLinterDiagnostics(code: string): Array<{
  from: number;
  to: number;
  severity: 'error' | 'warning' | 'info';
  message: string;
}> {
  const result = validateCode(code);

  if (result.isValid) {
    return [];
  }

  const lines = code.split('\n');

  return result.errors.map((error) => {
    // Calculate character offset from line/column
    let from = 0;
    for (let i = 0; i < error.line - 1 && i < lines.length; i++) {
      from += lines[i].length + 1; // +1 for newline
    }
    from += Math.max(0, error.column - 1);

    // Highlight to end of line or next few characters
    const lineContent = lines[error.line - 1] || '';
    const toColumn = Math.min(lineContent.length, error.column + 10);
    let to = from + (toColumn - error.column + 1);

    // Ensure 'to' doesn't go past 'from' + line length
    to = Math.max(from + 1, Math.min(to, from + lineContent.length - error.column + 1));

    return {
      from,
      to,
      severity: error.severity === 'warning' ? 'warning' : 'error',
      message: error.message,
    };
  });
}

/**
 * Check if code has any validation errors.
 *
 * @param code - The code to check
 * @returns true if code is valid, false otherwise
 */
export function isCodeValid(code: string): boolean {
  return validateCode(code).isValid;
}
