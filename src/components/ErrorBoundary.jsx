import { Component } from 'react';
import { trackException } from '@/lib/posthog';

/**
 * Error Boundary component to catch React rendering errors.
 * Prevents the entire app from crashing when a component fails.
 */
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });
    
    // Log to console for debugging
    console.error('ErrorBoundary caught an error:', error);
    console.error('Component stack:', errorInfo?.componentStack);
    
    // Track error in PostHog
    trackException(error, {
      component_stack: errorInfo?.componentStack,
      context: 'error_boundary',
    });
    
    // Report to parent window if available (Lovable's error reporting)
    try {
      if (window.parent && window.parent !== window) {
        window.parent.postMessage({
          type: 'error',
          message: error?.message || 'Unknown error',
          stack: error?.stack,
          componentStack: errorInfo?.componentStack,
        }, '*');
      }
    } catch (e) {
      // Ignore postMessage errors
    }
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback UI or default
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex flex-col items-center justify-center min-h-[200px] p-6 bg-background text-foreground">
          <div className="max-w-md text-center space-y-4">
            <div className="text-4xl">⚠️</div>
            <h2 className="text-xl font-semibold">Something went wrong</h2>
            <p className="text-muted-foreground text-sm">
              {this.props.message || 'An error occurred while rendering this component.'}
            </p>
            {import.meta.env.DEV && this.state.error && (
              <details className="text-left bg-muted p-3 rounded text-xs overflow-auto max-h-40">
                <summary className="cursor-pointer font-medium mb-2">Error details</summary>
                <pre className="whitespace-pre-wrap break-all">
                  {this.state.error.toString()}
                </pre>
              </details>
            )}
            <button
              onClick={this.handleRetry}
              className="px-4 py-2 bg-primary text-primary-foreground rounded hover:opacity-90 transition-opacity"
            >
              Try Again
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
