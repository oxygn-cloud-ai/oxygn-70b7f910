import { Component, ReactNode, ErrorInfo } from 'react';
import { trackException } from '@/lib/posthog';

interface ErrorBoundaryProps {
  children: ReactNode;
  message?: string;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * Error Boundary component to catch React rendering errors.
 * Prevents the entire app from crashing when a component fails.
 */
class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({ errorInfo });
    
    // Log to console for debugging
    console.error('ErrorBoundary caught an error:', error);
    console.error('Component stack:', errorInfo?.componentStack);
    
    // Track error in PostHog
    trackException(error, {
      component_stack: errorInfo?.componentStack,
      context: 'error_boundary',
    });
    
    // Report to parent window if in iframe (Lovable's error reporting)
    // Use specific origins for security, fallback to same-origin check
    try {
      if (window.parent && window.parent !== window) {
        // Only send to known trusted origins or same origin
        const trustedOrigins = ['https://lovable.dev', 'https://www.lovable.dev'];
        const currentOrigin = window.location.origin;
        const targetOrigin = trustedOrigins.includes(currentOrigin) ? currentOrigin : 
          (document.referrer ? new URL(document.referrer).origin : currentOrigin);
        
        // Only post if target is trusted or same origin
        if (trustedOrigins.includes(targetOrigin) || targetOrigin === currentOrigin) {
          window.parent.postMessage({
            type: 'error',
            message: error?.message || 'Unknown error',
            stack: error?.stack,
            componentStack: errorInfo?.componentStack,
          }, targetOrigin);
        }
      }
    } catch (e) {
      // Ignore postMessage errors (cross-origin restrictions, etc.)
    }
  }

  handleRetry = (): void => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render(): ReactNode {
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
