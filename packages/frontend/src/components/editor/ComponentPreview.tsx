/**
 * ComponentPreview - Renders a live preview of user-defined TSX components.
 * Uses Sucrase to compile JSX and renders the component with sample data.
 */
import { useEffect, useState, useMemo, forwardRef } from 'react';
import React from 'react';
import { transform } from 'sucrase';
import { PreviewErrorBoundary } from './PreviewErrorBoundary';
import * as LucideIcons from 'lucide-react';
import { Loader2, AlertCircle, Copy, Check } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Button } from '../ui/button';
import { Checkbox } from '../ui/checkbox';

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

// ===========================================
// Stub UI Components for missing dependencies
// ===========================================

// Input component stub
const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement> & { className?: string }>(
  ({ className, type = 'text', ...props }, ref) => (
    <input
      type={type}
      className={cn(
        "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      ref={ref}
      {...props}
    />
  )
);
Input.displayName = "Input";

// Label component stub
const Label = forwardRef<HTMLLabelElement, React.LabelHTMLAttributes<HTMLLabelElement> & { className?: string }>(
  ({ className, ...props }, ref) => (
    <label
      ref={ref}
      className={cn(
        "text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
        className
      )}
      {...props}
    />
  )
);
Label.displayName = "Label";

// Textarea component stub
const Textarea = forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement> & { className?: string }>(
  ({ className, ...props }, ref) => (
    <textarea
      className={cn(
        "flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      ref={ref}
      {...props}
    />
  )
);
Textarea.displayName = "Textarea";

// Card components stub
const Card = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement> & { className?: string }>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("rounded-lg border bg-card text-card-foreground shadow-sm", className)} {...props} />
  )
);
Card.displayName = "Card";

const CardHeader = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement> & { className?: string }>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex flex-col space-y-1.5 p-6", className)} {...props} />
  )
);
CardHeader.displayName = "CardHeader";

const CardTitle = forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLHeadingElement> & { className?: string }>(
  ({ className, ...props }, ref) => (
    <h3 ref={ref} className={cn("text-2xl font-semibold leading-none tracking-tight", className)} {...props} />
  )
);
CardTitle.displayName = "CardTitle";

const CardDescription = forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement> & { className?: string }>(
  ({ className, ...props }, ref) => (
    <p ref={ref} className={cn("text-sm text-muted-foreground", className)} {...props} />
  )
);
CardDescription.displayName = "CardDescription";

const CardContent = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement> & { className?: string }>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
  )
);
CardContent.displayName = "CardContent";

const CardFooter = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement> & { className?: string }>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex items-center p-6 pt-0", className)} {...props} />
  )
);
CardFooter.displayName = "CardFooter";

// Popover components stub (simplified - just renders children)
const Popover: React.FC<{ children: React.ReactNode; open?: boolean; onOpenChange?: (open: boolean) => void }> = ({ children }) => <>{children}</>;
const PopoverTrigger = forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement> & { asChild?: boolean }>(
  ({ children, asChild, ...props }, ref) => asChild ? <>{children}</> : <button ref={ref} {...props}>{children}</button>
);
PopoverTrigger.displayName = "PopoverTrigger";
const PopoverContent = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement> & { className?: string; align?: string; sideOffset?: number }>(
  ({ className, children, ...props }, ref) => (
    <div ref={ref} className={cn("z-50 w-72 rounded-md border bg-popover p-4 text-popover-foreground shadow-md outline-none", className)} {...props}>
      {children}
    </div>
  )
);
PopoverContent.displayName = "PopoverContent";

// Badge component stub
const Badge = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement> & { className?: string; variant?: string }>(
  ({ className, variant = "default", ...props }, ref) => {
    const variants: Record<string, string> = {
      default: "bg-primary text-primary-foreground",
      secondary: "bg-secondary text-secondary-foreground",
      destructive: "bg-destructive text-destructive-foreground",
      outline: "text-foreground border",
    };
    return (
      <div ref={ref} className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors", variants[variant] || variants.default, className)} {...props} />
    );
  }
);
Badge.displayName = "Badge";

// Avatar components stub
const Avatar = forwardRef<HTMLSpanElement, React.HTMLAttributes<HTMLSpanElement> & { className?: string }>(
  ({ className, ...props }, ref) => (
    <span ref={ref} className={cn("relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full", className)} {...props} />
  )
);
Avatar.displayName = "Avatar";

const AvatarImage = forwardRef<HTMLImageElement, React.ImgHTMLAttributes<HTMLImageElement> & { className?: string }>(
  ({ className, ...props }, ref) => (
    <img ref={ref} className={cn("aspect-square h-full w-full", className)} {...props} />
  )
);
AvatarImage.displayName = "AvatarImage";

const AvatarFallback = forwardRef<HTMLSpanElement, React.HTMLAttributes<HTMLSpanElement> & { className?: string }>(
  ({ className, ...props }, ref) => (
    <span ref={ref} className={cn("flex h-full w-full items-center justify-center rounded-full bg-muted", className)} {...props} />
  )
);
AvatarFallback.displayName = "AvatarFallback";

// Separator component stub
const Separator = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement> & { className?: string; orientation?: 'horizontal' | 'vertical' }>(
  ({ className, orientation = 'horizontal', ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "shrink-0 bg-border",
        orientation === 'horizontal' ? "h-[1px] w-full" : "h-full w-[1px]",
        className
      )}
      {...props}
    />
  )
);
Separator.displayName = "Separator";

// ScrollArea stub (simplified)
const ScrollArea = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement> & { className?: string }>(
  ({ className, children, ...props }, ref) => (
    <div ref={ref} className={cn("relative overflow-auto", className)} {...props}>{children}</div>
  )
);
ScrollArea.displayName = "ScrollArea";

// ===========================================
// Available imports for user components
// ===========================================
const availableImports: Record<string, unknown> = {
  'react': React,
  'lucide-react': LucideIcons,
  '@/lib/utils': { cn },
  '@/components/ui/button': { Button },
  '@/components/ui/input': { Input },
  '@/components/ui/label': { Label },
  '@/components/ui/textarea': { Textarea },
  '@/components/ui/checkbox': { Checkbox },
  '@/components/ui/card': { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter },
  '@/components/ui/popover': { Popover, PopoverTrigger, PopoverContent },
  '@/components/ui/badge': { Badge },
  '@/components/ui/avatar': { Avatar, AvatarImage, AvatarFallback },
  '@/components/ui/separator': { Separator },
  '@/components/ui/scroll-area': { ScrollArea },
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

    // Create a mock require function for imports
    const mockRequire = (moduleName: string) => {
      // Direct match first
      if (availableImports[moduleName]) {
        return availableImports[moduleName];
      }

      // Handle @/ path alias - try with the alias
      if (moduleName.startsWith('@/')) {
        if (availableImports[moduleName]) {
          return availableImports[moduleName];
        }
      }

      // Handle relative paths by converting to @/ format
      const normalizedName = moduleName
        .replace(/^\.\.\//, '@/')
        .replace(/^\.\//, '@/')
        .replace(/^components\//, '@/components/')
        .replace(/^lib\//, '@/lib/');

      if (availableImports[normalizedName]) {
        return availableImports[normalizedName];
      }

      // Return empty object for unknown imports (with warning)
      console.warn(`Unknown import: ${moduleName}`);
      return {};
    };

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
}: ComponentPreviewProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [resetKey, setResetKey] = useState(0);
  const [copied, setCopied] = useState(false);

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
          <Component data={sampleData} appearance={appearanceConfig} />
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
