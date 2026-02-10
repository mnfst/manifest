/**
 * Extracts component-specific demo data by parsing the component's
 * `data ?? <expr>` fallback and evaluating it against compiled demo exports.
 */
import React from 'react';
import { transform } from 'sucrase';

/**
 * Extract the component-specific demo data by parsing the component source
 * to find which demo export it uses as fallback (the `data ?? <expr>` pattern),
 * then compiling the demo file and evaluating that expression.
 */
export function extractComponentDemoData(
  files: Array<{ path: string; content: string }>
): Record<string, unknown> | undefined {
  const mainFile = files.find(f => f.path.endsWith('.tsx') && !f.path.includes('/demo/'));
  if (!mainFile) return undefined;

  const demoFile = files.find(f => f.path.includes('/demo/'));
  if (!demoFile) return undefined;

  // Find the `data ?? <expression>` pattern in the component source
  const fallbackMatch = mainFile.content.match(/=\s*data\s*\?\?\s*([^\n;]+)/);
  if (!fallbackMatch) return undefined;
  const fallbackExpr = fallbackMatch[1].trim();

  try {
    const processedCode = demoFile.content
      .replace(/['"]use client['"]\s*;?/g, '')
      .replace(/['"]use server['"]\s*;?/g, '');

    const result = transform(processedCode, {
      transforms: ['jsx', 'typescript', 'imports'],
      jsxRuntime: 'classic',
      jsxPragma: 'React.createElement',
      jsxFragmentPragma: 'React.Fragment',
    });

    const moduleCode = `
      var exports = {};
      var module = { exports: exports };
      ${result.code}
      return exports;
    `;

    const mockRequire = () => ({});
    const factory = new Function('React', 'require', moduleCode);
    const rawExports = factory(React, mockRequire) as Record<string, unknown>;

    // Filter internal keys, keep only demo exports
    const demoExports: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(rawExports)) {
      if (key !== '__esModule' && key !== 'default') {
        demoExports[key] = value;
      }
    }

    // Evaluate the fallback expression with demo exports in scope
    const paramNames = Object.keys(demoExports);
    const paramValues = Object.values(demoExports);
    const evalFn = new Function(...paramNames, `return (${fallbackExpr})`);
    const value = evalFn(...paramValues);

    return value && typeof value === 'object' ? value as Record<string, unknown> : undefined;
  } catch (err) {
    console.warn('Failed to extract component demo data:', err);
    return undefined;
  }
}
