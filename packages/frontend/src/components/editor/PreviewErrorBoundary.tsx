/**
 * PreviewErrorBoundary - Error boundary for component preview rendering.
 * Catches errors during component rendering and displays a friendly error message.
 */
import { Component, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export interface PreviewErrorBoundaryProps {
  /** Child components to render */
  children: ReactNode;
  /** Callback when reset is requested */
  onReset?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: string | null;
}

/**
 * Error boundary that catches rendering errors in component preview.
 * Displays the error message and provides a reset button.
 */
export class PreviewErrorBoundary extends Component<
  PreviewErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: PreviewErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    this.setState({
      errorInfo: errorInfo.componentStack || null,
    });
    console.error('Preview render error:', error, errorInfo);
  }

  handleReset = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
    this.props.onReset?.();
  };

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-full p-8 bg-red-50 rounded-lg border border-red-200">
          <AlertTriangle className="w-12 h-12 text-red-500 mb-4" />
          <h3 className="text-lg font-semibold text-red-800 mb-2">
            Preview Error
          </h3>
          <p className="text-sm text-red-600 text-center mb-4 max-w-md">
            An error occurred while rendering the component preview.
          </p>
          {this.state.error && (
            <div className="bg-red-100 rounded-md p-4 mb-4 max-w-lg w-full overflow-auto">
              <p className="text-sm font-mono text-red-700 break-words">
                {this.state.error.message}
              </p>
              {this.state.errorInfo && (
                <pre className="text-xs font-mono text-red-600 mt-2 whitespace-pre-wrap">
                  {this.state.errorInfo}
                </pre>
              )}
            </div>
          )}
          <button
            onClick={this.handleReset}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default PreviewErrorBoundary;
