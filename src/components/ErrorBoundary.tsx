/// <reference types="vite/client" />

import { Component, ErrorInfo, ReactNode } from 'react';
import { trackException } from '@/lib/posthog';

/**
 * Props for ErrorBoundary component
 */
interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  message?: string;
}

/**
 * State for ErrorBoundary component
 */
interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

// Explicitly whitelisted trusted origins for postMessage - never use dynamic referrer
const TRUSTED_ORIGINS = [
  'https://lovable.dev',
  'https://www.lovable.dev',
  'https://qonsol.app',
  'https://www.qonsol.app',
  'https://id-preview--5c8b7a90-dc2a-4bd7-9069-c2c2cd2e6062.lovable.app',
] as const;

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
    // Only post to explicitly trusted origins - never use dynamic referrer
    try {
      if (window.parent && window.parent !== window) {
        const currentOrigin = window.location.origin;
        
        // Find matching trusted origin (exact match only - no prefix matching)
        // This prevents any attacker-controlled domain from receiving error data
        const targetOrigin = TRUSTED_ORIGINS.find(origin => 
          currentOrigin === origin
        ) || null;
        
        // Only post if we found a matching trusted origin
        if (targetOrigin) {
          window.parent.postMessage({
            type: 'error',
            message: error?.message || 'Unknown error',
            // Only include stack in dev mode to prevent credential exposure
            ...(import.meta.env.DEV && { stack: error?.stack }),
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
