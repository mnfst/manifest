/**
 * ComponentPreview - Renders a live preview of user-defined TSX components.
 * Uses Sucrase to compile JSX and renders the component with sample data.
 */
import { useEffect, useState, useMemo } from 'react';
import React from 'react';
import { transform } from 'sucrase';
import { PreviewErrorBoundary } from './PreviewErrorBoundary';
import { Loader2, AlertCircle, TrendingUp, TrendingDown, Minus } from 'lucide-react';

export interface ComponentPreviewProps {
  /** TSX code string to render */
  code: string;
  /** Sample data to pass to the component */
  sampleData: unknown;
  /** Key to force re-render when code changes */
  renderKey?: number;
  /** Appearance configuration for visual options */
  appearanceConfig?: Record<string, string | number | boolean>;
}

// Available imports for user components
const availableImports: Record<string, unknown> = {
  'react': React,
  'lucide-react': { TrendingUp, TrendingDown, Minus },
};

/**
 * Compile and evaluate user's TSX code to create a React component.
 * The component receives { data, appearance } props.
 */
function compileComponent(code: string): { Component: React.ComponentType<{ data: unknown; appearance?: Record<string, string | number | boolean> }> | null; error: string | null } {
  try {
    if (!code || code.trim().length === 0) {
      return { Component: null, error: 'No code to preview' };
    }

    // Transform JSX and imports to JavaScript using Sucrase
    const result = transform(code, {
      transforms: ['jsx', 'typescript', 'imports'],
      jsxRuntime: 'classic',
      jsxPragma: 'React.createElement',
      jsxFragmentPragma: 'React.Fragment',
    });

    // Create a mock require function for imports
    const mockRequire = (moduleName: string) => {
      // Handle path aliases
      const normalizedName = moduleName.replace(/^@\//, '').replace(/^\.\.\//, '').replace(/^\.\//, '');

      if (availableImports[moduleName]) {
        return availableImports[moduleName];
      }
      if (availableImports[normalizedName]) {
        return availableImports[normalizedName];
      }
      // Return empty object for unknown imports
      console.warn(`Unknown import: ${moduleName}`);
      return {};
    };

    // Create a module wrapper
    const moduleCode = `
      var exports = {};
      var module = { exports: exports };
      ${result.code}
      return module.exports.default || module.exports;
    `;

    // Execute the code
    const factory = new Function('React', 'require', moduleCode);
    const Component = factory(React, mockRequire);

    if (typeof Component !== 'function') {
      return { Component: null, error: 'Component must export a default function' };
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
}: ComponentPreviewProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [resetKey, setResetKey] = useState(0);

  // Compile the component when code changes
  const { Component, error } = useMemo(() => {
    return compileComponent(code);
  }, [code]);

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
          <Component data={sampleData} appearance={appearanceConfig} />
        </div>

        {/* Sample data reference */}
        <div className="mt-6 pt-4 border-t">
          <details className="group">
            <summary className="text-xs font-medium text-gray-500 cursor-pointer hover:text-gray-700">
              View sample data
            </summary>
            <pre className="mt-2 p-3 bg-gray-50 rounded-lg text-xs font-mono text-gray-600 overflow-auto max-h-48">
              {JSON.stringify(sampleData, null, 2)}
            </pre>
          </details>
        </div>
      </div>
    </PreviewErrorBoundary>
  );
}

export default ComponentPreview;
