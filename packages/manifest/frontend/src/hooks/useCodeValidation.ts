import { useState, useCallback, useEffect, useRef } from 'react';
import * as acorn from 'acorn';

/**
 * Validation error with location information.
 */
export interface CodeValidationError {
  /** Error message */
  message: string;
  /** Line number (1-indexed) */
  line: number;
  /** Column number (0-indexed) */
  column: number;
}

/**
 * Result of code validation.
 */
interface CodeValidationResult {
  /** Whether the code is valid */
  isValid: boolean;
  /** Validation error (if any) */
  error: CodeValidationError | null;
}

/**
 * Strip TypeScript type annotations from code for JavaScript-only parsing.
 * This is a simplified approach that handles common patterns.
 */
function stripTypeAnnotations(code: string): string {
  return code
    // Remove function parameter type annotations: (param: Type) => (param)
    .replace(/:\s*[A-Za-z_$][\w$]*(\[\])?(?=\s*[,)=])/g, '')
    // Remove function return type annotations: function foo(): Type { => function foo() {
    .replace(/\):\s*[A-Za-z_$][\w$]*(\[\])?\s*\{/g, ') {')
    // Remove interface declarations
    .replace(/interface\s+\w+\s*\{[^}]*\}/g, '')
    // Remove type declarations
    .replace(/type\s+\w+\s*=\s*[^;]+;/g, '')
    // Remove generic type parameters: <T> or <T, U>
    .replace(/<[A-Za-z_$][\w$,\s]*>/g, '');
}

/**
 * Check if code is a full function definition (vs just function body).
 */
function isFullFunctionDefinition(code: string): boolean {
  const trimmed = code.trim();
  return /^function\s+\w*\s*\(/.test(trimmed) || /^const\s+\w+\s*=\s*\(/.test(trimmed) || /^\(/.test(trimmed);
}

/**
 * Parse JavaScript/TypeScript code and return validation result.
 */
function parseCode(code: string): CodeValidationResult {
  if (!code.trim()) {
    return { isValid: true, error: null };
  }

  // Strip TypeScript annotations for JavaScript parsing
  const jsCode = stripTypeAnnotations(code);

  let codeToValidate: string;
  let columnOffset = 0;

  if (isFullFunctionDefinition(jsCode)) {
    // Code is a full function definition, validate as-is
    codeToValidate = jsCode;
  } else {
    // Wrap the code in a function body context for validation
    // This allows `return` statements at the top level
    codeToValidate = `(function(input) { ${jsCode} })`;
    columnOffset = 21; // Length of "(function(input) { "
  }

  try {
    acorn.parse(codeToValidate, {
      ecmaVersion: 2020,
      sourceType: 'script',
    });
    return { isValid: true, error: null };
  } catch (err) {
    if (err instanceof SyntaxError) {
      // Extract location from acorn error
      const acornError = err as SyntaxError & { loc?: { line: number; column: number } };
      const loc = acornError.loc;

      // Adjust column to account for the wrapper function (if used)
      const adjustedLine = loc ? loc.line : 1;
      const adjustedColumn = loc ? Math.max(0, loc.column - columnOffset) : 0;

      return {
        isValid: false,
        error: {
          message: err.message.replace(/^\(\d+:\d+\)\s*/, ''), // Clean up position prefix
          line: adjustedLine,
          column: adjustedColumn,
        },
      };
    }

    return {
      isValid: false,
      error: {
        message: 'Unknown parsing error',
        line: 1,
        column: 0,
      },
    };
  }
}

/**
 * Hook for validating JavaScript code with debouncing.
 *
 * @param code - The code to validate
 * @param debounceMs - Debounce delay in milliseconds (default: 300ms)
 */
export function useCodeValidation(code: string, debounceMs = 300) {
  const [result, setResult] = useState<CodeValidationResult>({
    isValid: true,
    error: null,
  });
  const [isValidating, setIsValidating] = useState(false);

  // Track the latest code to avoid race conditions
  const latestCodeRef = useRef(code);
  latestCodeRef.current = code;

  // Debounced validation
  useEffect(() => {
    setIsValidating(true);

    const timeoutId = setTimeout(() => {
      // Only validate if this is still the latest code
      if (latestCodeRef.current === code) {
        const validationResult = parseCode(code);
        setResult(validationResult);
        setIsValidating(false);
      }
    }, debounceMs);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [code, debounceMs]);

  /**
   * Validate code immediately (bypass debounce).
   */
  const validateNow = useCallback(() => {
    const validationResult = parseCode(code);
    setResult(validationResult);
    setIsValidating(false);
    return validationResult;
  }, [code]);

  return {
    ...result,
    isValidating,
    validateNow,
  };
}
