import type { NodeTypeDefinition, ExecutionContext, ExecutionResult } from '../../types.js';
import type { JavaScriptCodeTransformParameters, JSONSchema } from '@chatgpt-app-builder/shared';

/**
 * Output structure produced by the JavaScriptCodeTransform node.
 */
interface TransformOutput {
  /** Discriminator for output type */
  type: 'transform';
  /** Whether the transformation was successful */
  success: boolean;
  /** The transformed data */
  data?: unknown;
  /** Error message if transformation failed */
  error?: string;
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
  getOutputSchema(parameters: Record<string, unknown>): JSONSchema | null {
    const resolvedSchema = parameters.resolvedOutputSchema as JSONSchema | null | undefined;
    if (resolvedSchema) {
      return resolvedSchema;
    }

    // Default output structure when schema not yet resolved
    return {
      type: 'object',
      properties: {
        type: { type: 'string', const: 'transform' },
        success: { type: 'boolean', description: 'Whether the transformation succeeded' },
        data: { description: 'The transformed data' },
        error: { type: 'string', description: 'Error message if transformation failed' },
      },
      required: ['type', 'success'],
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

      // Execute the user's JavaScript code using Function constructor
      // This creates an isolated scope where only 'input' is accessible
      try {
        const transformFunction = new Function('input', executableCode);
        const result = transformFunction(input);

        const output: TransformOutput = {
          type: 'transform',
          success: true,
          data: result,
        };

        return {
          success: true,
          output,
        };
      } catch (err) {
        // Handle JavaScript execution errors (syntax errors, runtime errors)
        const message = err instanceof Error ? err.message : 'Unknown JavaScript error';
        const output: TransformOutput = {
          type: 'transform',
          success: false,
          error: `Transform execution failed: ${message}`,
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
      const output: TransformOutput = {
        type: 'transform',
        success: false,
        error: `Transform failed: ${message}`,
      };

      return {
        success: false,
        error: `Transform failed: ${message}`,
        output,
      };
    }
  },
};
