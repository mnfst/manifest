/**
 * ComponentPreview - Renders a live preview of user-defined TSX components.
 * Uses Sucrase to compile JSX and renders the component with sample data.
 */
import { useEffect, useState, useMemo } from 'react';
import React from 'react';
import { transform } from 'sucrase';
import { PreviewErrorBoundary } from './PreviewErrorBoundary';
import * as LucideIcons from 'lucide-react';
import { Loader2, AlertCircle, Copy, Check } from 'lucide-react';
import { cn } from '../../lib/utils';
import { ThemeProvider } from './ThemeProvider';
import type { ThemeVariables } from '@chatgpt-app-builder/shared';

export interface ComponentPreviewProps {
  /** TSX code string to render */
  code: string;
  /** Sample data to pass to the component */
  sampleData: unknown;
  /** Key to force re-render when code changes */
  renderKey?: number;
  /** Appearance configuration for visual options */
  appearanceConfig?: Record<string, string | number | boolean>;
  /** Additional files for resolving sibling imports (from registry components) */
  siblingFiles?: Array<{ path: string; content: string }>;
  /** Theme variables for styling */
  themeVariables?: ThemeVariables;
}

// ===========================================
// Auto-discover UI Components
// ===========================================

// Use Vite's import.meta.glob to auto-import all UI components
// Custom components are in ../ui/, shadcn components are in ../ui/shadcn/
const uiModules = import.meta.glob(['../ui/*.tsx', '../ui/shadcn/*.tsx'], { eager: true }) as Record<string, Record<string, unknown>>;

// ===========================================
// File Resolution for Multi-File Components
// ===========================================

/**
 * Normalize a file path to get the module name used in imports.
 * e.g., "registry/events/event-card.tsx" -> "event-card"
 *       "registry/events/demo/data.ts" -> "demo/data"
 */
function getModuleNameFromPath(filePath: string): string {
  // Get filename without extension
  const basename = filePath.replace(/\.[^/.]+$/, '');
  const parts = basename.split('/');

  // Find index of "registry" folder and skip to component folder
  const registryIndex = parts.indexOf('registry');
  if (registryIndex >= 0 && registryIndex < parts.length - 2) {
    // Return everything after the category folder (e.g., "events")
    return parts.slice(registryIndex + 2).join('/');
  }

  // Fallback: just return the filename
  return parts[parts.length - 1];
}

/**
 * Build a map from module names to file content.
 */
function buildFileMap(
  siblingFiles?: Array<{ path: string; content: string }>
): Map<string, string> {
  const fileMap = new Map<string, string>();

  if (siblingFiles) {
    for (const file of siblingFiles) {
      const moduleName = getModuleNameFromPath(file.path);
      fileMap.set(moduleName, file.content);
    }
  }

  return fileMap;
}

/**
 * Compile a sibling module and return its exports.
 */
function compileSiblingModule(
  code: string,
  mockRequire: (moduleName: string) => unknown
): unknown {
  try {
    // Strip Next.js directives
    const processedCode = code
      .replace(/['"]use client['"]\s*;?/g, '')
      .replace(/['"]use server['"]\s*;?/g, '');

    // Transform with Sucrase
    const result = transform(processedCode, {
      transforms: ['jsx', 'typescript', 'imports'],
      jsxRuntime: 'classic',
      jsxPragma: 'React.createElement',
      jsxFragmentPragma: 'React.Fragment',
    });

    // Create module wrapper
    const moduleCode = `
      var exports = {};
      var module = { exports: exports };
      ${result.code}
      return module.exports;
    `;

    const factory = new Function('React', 'require', moduleCode);
    return factory(React, mockRequire);
  } catch (err) {
    console.warn('Failed to compile sibling module:', err);
    return {};
  }
}

// ===========================================
// Available imports for user components
// ===========================================
const availableImports: Record<string, unknown> = {
  'react': React,
  'lucide-react': LucideIcons,
  '@/lib/utils': { cn },
};

// Auto-add all UI components from the glob import
for (const [path, module] of Object.entries(uiModules)) {
  // Convert "../ui/button.tsx" → "@/components/ui/button"
  // Convert "../ui/shadcn/button.tsx" → "@/components/ui/shadcn/button"
  const componentPath = path.replace('../ui/', '@/components/ui/').replace('.tsx', '');
  availableImports[componentPath] = module;

  // For shadcn components, also register under the short path for backwards compatibility
  // "../ui/shadcn/button.tsx" → also available as "@/components/ui/button"
  if (path.includes('/shadcn/')) {
    const shortPath = componentPath.replace('/shadcn/', '/');
    // Only add if not already defined (custom components take precedence)
    if (!availableImports[shortPath]) {
      availableImports[shortPath] = module;
    }
  }
}

/**
 * Creates an enhanced mock require function that can resolve sibling files and stub Next.js imports.
 */
function createMockRequire(
  fileMap: Map<string, string>,
  compiledModules: Map<string, unknown>,
  compilingModules: Set<string>
): (moduleName: string) => unknown {
  const mockRequire = (moduleName: string): unknown => {
    // 1. Check static imports first (React, lucide-react, etc.)
    if (availableImports[moduleName]) {
      return availableImports[moduleName];
    }

    // 2. Handle @/ path aliases
    if (moduleName.startsWith('@/') && availableImports[moduleName]) {
      return availableImports[moduleName];
    }

    // 3. Handle relative imports (sibling files)
    if (moduleName.startsWith('./') || moduleName.startsWith('../')) {
      const normalizedName = moduleName
        .replace(/^\.\//, '')
        .replace(/^\.\.\//, '')
        .replace(/\.(tsx?|jsx?)$/, ''); // Remove extension if present

      // Check if already compiled (cache hit)
      if (compiledModules.has(normalizedName)) {
        return compiledModules.get(normalizedName);
      }

      // Check for circular import
      if (compilingModules.has(normalizedName)) {
        console.warn(`Circular import detected: ${normalizedName}`);
        return {};
      }

      // Check if file exists in map
      const fileContent = fileMap.get(normalizedName);
      if (fileContent) {
        // Mark as compiling (for circular detection)
        compilingModules.add(normalizedName);

        try {
          // Compile the sibling file
          const result = compileSiblingModule(fileContent, mockRequire);
          compiledModules.set(normalizedName, result);
          return result;
        } finally {
          compilingModules.delete(normalizedName);
        }
      }

      // File not found - return empty stub
      console.warn(`Sibling file not found: ${moduleName} (looked for: ${normalizedName})`);
      return {};
    }

    // 5. Handle normalized paths
    const normalizedName = moduleName
      .replace(/^\.\.\//, '@/')
      .replace(/^\.\//, '@/')
      .replace(/^components\//, '@/components/')
      .replace(/^lib\//, '@/lib/');

    if (availableImports[normalizedName]) {
      return availableImports[normalizedName];
    }

    // 6. Unknown import - return empty object
    console.warn(`Unknown import: ${moduleName}`);
    return {};
  };

  return mockRequire;
}

/**
 * Compile and evaluate user's TSX code to create a React component.
 * The component receives { data, appearance } props.
 */
function compileComponent(
  code: string,
  siblingFiles?: Array<{ path: string; content: string }>
): { Component: React.ComponentType<{ data: unknown; appearance?: Record<string, string | number | boolean> }> | null; error: string | null } {
  try {
    if (!code || code.trim().length === 0) {
      return { Component: null, error: 'No code to preview' };
    }

    // Build the file resolution map from sibling files
    const fileMap = buildFileMap(siblingFiles);

    // Caches for compiled modules and circular detection
    const compiledModules = new Map<string, unknown>();
    const compilingModules = new Set<string>();

    // Create the enhanced mock require
    const mockRequire = createMockRequire(fileMap, compiledModules, compilingModules);

    // Strip out Next.js directives that aren't valid JS
    const processedCode = code
      .replace(/['"]use client['"]\s*;?/g, '')
      .replace(/['"]use server['"]\s*;?/g, '');

    // Transform JSX and imports to JavaScript using Sucrase
    const result = transform(processedCode, {
      transforms: ['jsx', 'typescript', 'imports'],
      jsxRuntime: 'classic',
      jsxPragma: 'React.createElement',
      jsxFragmentPragma: 'React.Fragment',
    });

    // Create a module wrapper that handles both default and named exports
    const moduleCode = `
      var exports = {};
      var module = { exports: exports };
      ${result.code}

      // Try default export first
      if (module.exports.default) {
        return module.exports.default;
      }

      // If module.exports is a function itself, return it
      if (typeof module.exports === 'function') {
        return module.exports;
      }

      // Look for the first exported function (named export)
      for (var key in exports) {
        if (typeof exports[key] === 'function') {
          return exports[key];
        }
      }

      return null;
    `;

    // Execute the code
    const factory = new Function('React', 'require', moduleCode);
    const Component = factory(React, mockRequire);

    if (typeof Component !== 'function') {
      return { Component: null, error: 'Component must export a function (default or named)' };
    }

    return { Component, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown compilation error';
    return { Component: null, error: message };
  }
}

/**
 * Component that renders a live preview of user-defined TSX code.
 */
export function ComponentPreview({
  code,
  sampleData,
  renderKey = 0,
  appearanceConfig,
  siblingFiles,
  themeVariables,
}: ComponentPreviewProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [resetKey, setResetKey] = useState(0);
  const [copied, setCopied] = useState(false);

  // Compile the component when code or sibling files change
  const { Component, error } = useMemo(() => {
    return compileComponent(code, siblingFiles);
  }, [code, siblingFiles]);

  // Short loading delay for UX
  useEffect(() => {
    setIsLoading(true);
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 100);
    return () => clearTimeout(timer);
  }, [code, renderKey]);

  // Handle error boundary reset
  const handleReset = () => {
    setResetKey((prev) => prev + 1);
  };

  // Copy sample data to clipboard
  const handleCopySampleData = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(sampleData, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      console.warn('Clipboard API not available');
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8">
        <Loader2 className="w-8 h-8 text-gray-500 animate-spin mb-4" />
        <p className="text-sm text-muted-foreground">Compiling preview...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 bg-red-50 rounded-lg border border-red-200">
        <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
        <h3 className="text-lg font-semibold text-red-800 mb-2">
          Compilation Error
        </h3>
        <p className="text-sm text-red-600 text-center max-w-md font-mono">
          {error}
        </p>
      </div>
    );
  }

  if (!Component) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 bg-amber-50 rounded-lg border border-amber-200">
        <AlertCircle className="w-12 h-12 text-amber-500 mb-4" />
        <h3 className="text-lg font-semibold text-amber-800 mb-2">
          No Component
        </h3>
        <p className="text-sm text-amber-600 text-center max-w-md">
          Write a component that exports a default function.
        </p>
      </div>
    );
  }

  return (
    <PreviewErrorBoundary key={`${resetKey}-${renderKey}`} onReset={handleReset}>
      <div className="preview-container">
        {/* Live preview heading */}
        <div className="mb-4 pb-4 border-b">
          <h3 className="text-sm font-medium text-gray-700">Live Preview</h3>
          <p className="text-xs text-gray-500">
            Your component rendered with sample data
          </p>
        </div>

        {/* Render the user's component with sample data and appearance config */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          {themeVariables ? (
            <ThemeProvider themeVariables={themeVariables}>
              <Component data={sampleData} appearance={appearanceConfig} />
            </ThemeProvider>
          ) : (
            <Component data={sampleData} appearance={appearanceConfig} />
          )}
        </div>

        {/* Sample data reference */}
        <div className="mt-6 pt-4 border-t">
          <details className="group">
            <summary className="text-xs font-medium text-gray-500 cursor-pointer hover:text-gray-700">
              View sample data
            </summary>
            <div className="relative mt-2">
              <button
                onClick={handleCopySampleData}
                className="absolute top-2 right-2 p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
                title={copied ? 'Copied!' : 'Copy sample data'}
              >
                {copied ? (
                  <Check className="w-4 h-4 text-green-500" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </button>
              <pre className="p-3 pr-10 bg-gray-50 rounded-lg text-xs font-mono text-gray-600 overflow-auto max-h-48">
                {JSON.stringify(sampleData, null, 2)}
              </pre>
            </div>
          </details>
        </div>
      </div>
    </PreviewErrorBoundary>
  );
}

export default ComponentPreview;
