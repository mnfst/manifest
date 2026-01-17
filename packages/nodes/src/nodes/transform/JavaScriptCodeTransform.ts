import vm from 'node:vm';
import type { NodeTypeDefinition, ExecutionContext, ExecutionResult } from '../../types.js';
import type { JavaScriptCodeTransformParameters, JSONSchema, TransformExecutionMetadata } from '@chatgpt-app-builder/shared';

/** Maximum execution time for user code (ms) */
const EXECUTION_TIMEOUT_MS = 5000;

/**
 * Creates a sandboxed context for executing user JavaScript code.
 * Blocks access to dangerous Node.js globals and provides only safe utilities.
 */
function createSandboxContext(input: unknown): vm.Context {
  // Create a minimal context with only safe globals
  const sandbox = {
    // User's input data
    input,
    // Safe built-ins for data transformation
    JSON: {
      parse: JSON.parse,
      stringify: JSON.stringify,
    },
    Object: {
      keys: Object.keys,
      values: Object.values,
      entries: Object.entries,
      assign: Object.assign,
      fromEntries: Object.fromEntries,
    },
    Array: {
      isArray: Array.isArray,
      from: Array.from,
    },
    String,
    Number,
    Boolean,
    Date,
    Math,
    parseInt,
    parseFloat,
    isNaN,
    isFinite,
    // Console for debugging (safe - just logs)
    console: {
      log: () => {}, // Silently ignore in production
      warn: () => {},
      error: () => {},
    },
    // Result placeholder
    __result: undefined as unknown,
  };

  // Create VM context with no prototype chain to global
  return vm.createContext(sandbox, {
    codeGeneration: {
      strings: false, // Block eval() and new Function()
      wasm: false,    // Block WebAssembly
    },
  });
}

/**
 * Extract executable JavaScript from TypeScript transform code.
 * Handles both full function definitions and simple function bodies.
 */
function extractExecutableCode(code: string): string {
  // Strip TypeScript type annotations
  const jsCode = code
    // Remove function parameter type annotations: (param: Type) => (param)
    .replace(/:\s*[A-Za-z_$][\w$<>,\s]*(\[\])?(?=\s*[,)=])/g, '')
    // Remove function return type annotations: function foo(): Type { => function foo() {
    .replace(/\):\s*[A-Za-z_$][\w$<>,\s]*(\[\])?\s*\{/g, ') {')
    // Remove interface declarations
    .replace(/interface\s+\w+\s*\{[^}]*\}/g, '')
    // Remove type declarations
    .replace(/type\s+\w+\s*=\s*[^;]+;/g, '');

  const trimmed = jsCode.trim();

  // Check if this is a full function definition
  const functionMatch = trimmed.match(/^function\s+\w*\s*\([^)]*\)\s*\{([\s\S]*)\}$/);
  if (functionMatch) {
    // Extract the function body
    return functionMatch[1].trim();
  }

  // Check for arrow function: const transform = (input) => { ... }
  const arrowMatch = trimmed.match(/^(?:const|let|var)\s+\w+\s*=\s*\([^)]*\)\s*=>\s*\{([\s\S]*)\}$/);
  if (arrowMatch) {
    return arrowMatch[1].trim();
  }

  // Check for arrow function with expression body: (input) => input.value
  const arrowExprMatch = trimmed.match(/^(?:const|let|var)\s+\w+\s*=\s*\([^)]*\)\s*=>\s*(.+)$/);
  if (arrowExprMatch) {
    return `return ${arrowExprMatch[1]}`;
  }

  // Assume it's already a function body
  return jsCode;
}

/**
 * JavaScriptCodeTransform Node
 *
 * Transforms data using custom JavaScript code written by the user.
 * The code receives the input from the upstream node and returns the transformed output.
 *
 * Input: Accepts any data structure from the upstream node.
 * Output: The result of executing the user's JavaScript transformation code.
 */
export const JavaScriptCodeTransform: NodeTypeDefinition = {
  name: 'JavaScriptCodeTransform',
  displayName: 'JavaScript Code',
  icon: 'shuffle',
  group: ['transform'],
  category: 'transform',
  description: 'Transform data using custom JavaScript code',

  inputs: ['main'],
  outputs: ['main'],

  defaultParameters: {
    code: 'return input;',
    resolvedOutputSchema: null,
  } satisfies JavaScriptCodeTransformParameters,

  // Transform nodes accept any input data
  inputSchema: {
    type: 'object',
    additionalProperties: true,
    description: 'Input data from the upstream node to be transformed',
  } as JSONSchema,

  // Dynamic output schema based on resolved schema from testing
  // The output spreads transformed data at root with _execution metadata
  getOutputSchema(parameters: Record<string, unknown>): JSONSchema | null {
    const resolvedSchema = parameters.resolvedOutputSchema as JSONSchema | null | undefined;
    if (resolvedSchema) {
      // Return resolved schema as-is (it should already have _execution added during resolution)
      return resolvedSchema;
    }

    // Default output structure when schema not yet resolved
    // Uses additionalProperties to allow any transformed data at root
    return {
      type: 'object',
      properties: {
        _execution: {
          type: 'object',
          description: 'Execution metadata',
          properties: {
            success: { type: 'boolean', description: 'Whether the transformation succeeded' },
            error: { type: 'string', description: 'Error message if transformation failed' },
            durationMs: { type: 'number', description: 'Transform execution time in milliseconds' },
          },
          required: ['success', 'durationMs'],
        },
      },
      additionalProperties: true,
      description: 'Transformed data with execution metadata',
    } as JSONSchema;
  },

  /**
   * Executes the JavaScript transformation code.
   *
   * @param context - Execution context with node parameters and helper functions
   * @returns Execution result with transformed data or error information
   */
  async execute(context: ExecutionContext): Promise<ExecutionResult> {
    const { parameters, getNodeValue } = context;
    const rawCode = (parameters.code as string) || 'return input;';
    const startTime = performance.now();

    try {
      // Get input from upstream node (via the 'main' input handle)
      // The getNodeValue function expects a node ID, so we need to find the connected upstream node
      // For now, we'll try to get the value from 'main' which should resolve to the connected node's output
      let input: unknown;
      try {
        input = await getNodeValue('main');
      } catch {
        // If no upstream value, use empty object
        input = {};
      }

      // Extract executable JavaScript from potentially TypeScript code
      const executableCode = extractExecutableCode(rawCode);

      // Execute user code in a sandboxed VM context
      // This blocks access to Node.js globals (process, require, etc.)
      try {
        const context = createSandboxContext(input);

        // Wrap code in a function that assigns result to __result
        const wrappedCode = `__result = (function(input) { ${executableCode} })(input);`;

        // Compile and run with timeout
        const script = new vm.Script(wrappedCode, {
          filename: 'user-transform.js',
        });

        script.runInContext(context, {
          timeout: EXECUTION_TIMEOUT_MS,
          displayErrors: true,
        });

        const result = context.__result;
        const durationMs = Math.round(performance.now() - startTime);

        // Spread transformed data at root with _execution metadata
        const output = {
          ...(typeof result === 'object' && result !== null ? result : { _value: result }),
          _execution: {
            success: true,
            durationMs,
          } as TransformExecutionMetadata,
        };

        return {
          success: true,
          output,
        };
      } catch (err) {
        // Handle JavaScript execution errors (syntax, runtime, timeout)
        const durationMs = Math.round(performance.now() - startTime);
        let message: string;

        if (err instanceof Error) {
          if (err.message.includes('Script execution timed out')) {
            message = `Execution timeout after ${EXECUTION_TIMEOUT_MS}ms`;
          } else if (err.message.includes('is not defined')) {
            // Blocked global access attempt
            message = `Blocked access: ${err.message}. Only safe utilities are available.`;
          } else {
            message = err.message;
          }
        } else {
          message = 'Unknown JavaScript error';
        }

        const output = {
          _execution: {
            success: false,
            error: `Transform execution failed: ${message}`,
            durationMs,
          } as TransformExecutionMetadata,
        };

        return {
          success: false,
          error: `Transform execution failed: ${message}`,
          output,
        };
      }
    } catch (err) {
      // Handle other errors (e.g., getting input value)
      const message = err instanceof Error ? err.message : 'Unknown error';
      const durationMs = Math.round(performance.now() - startTime);
      const output = {
        _execution: {
          success: false,
          error: `Transform failed: ${message}`,
          durationMs,
        } as TransformExecutionMetadata,
      };

      return {
        success: false,
        error: `Transform failed: ${message}`,
        output,
      };
    }
  },
};
