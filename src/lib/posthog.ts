/**
 * PostHog Analytics Integration
 * 
 * Provides user identification, event tracking, feature flags,
 * error tracking, and performance monitoring.
 */

import posthog from 'posthog-js';

// ============= Types =============

export interface UserProfile {
  display_name?: string | null;
  avatar_url?: string | null;
}

export interface AuthUser {
  email?: string;
  created_at?: string;
  last_sign_in_at?: string;
}

export interface PerformanceNavigationTiming extends PerformanceEntry {
  domainLookupEnd: number;
  domainLookupStart: number;
  connectEnd: number;
  connectStart: number;
  responseStart: number;
  requestStart: number;
  domInteractive: number;
  navigationStart: number;
  domComplete: number;
  loadEventEnd: number;
  transferSize: number;
  encodedBodySize: number;
  type: string;
}

// ============= Configuration =============

const POSTHOG_API_KEY = import.meta.env.VITE_POSTHOG_API_KEY as string | undefined;
const POSTHOG_HOST = 'https://eu.i.posthog.com';

let isInitialized = false;

// ============= Initialization =============

/**
 * Initialize PostHog with EU region configuration
 */
export const initPostHog = (): void => {
  if (isInitialized || !POSTHOG_API_KEY) {
    if (!POSTHOG_API_KEY) {
      console.warn('PostHog API key not configured');
    }
    return;
  }

  posthog.init(POSTHOG_API_KEY, {
    api_host: POSTHOG_HOST,
    capture_pageview: false,
    capture_pageleave: true,
    autocapture: true,
    session_recording: {
      maskAllInputs: false,
      maskTextSelector: null,
    },
    enable_heatmaps: true,
    persistence: 'localStorage',
    bootstrap: {
      distinctID: undefined,
    },
  });

  isInitialized = true;
  setupGlobalErrorHandlers();
  trackPageLoadPerformance();
};

// ============= Error Handlers =============

const setupGlobalErrorHandlers = (): void => {
  window.addEventListener('error', (event: ErrorEvent) => {
    trackException(event.error || new Error(event.message), {
      error_type: 'uncaught_error',
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno
    });
  });

  window.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
    const error = event.reason instanceof Error 
      ? event.reason 
      : new Error(String(event.reason));
    trackException(error, {
      error_type: 'unhandled_promise_rejection'
    });
  });
};

// ============= User Identification =============

/**
 * Identify authenticated user with their email as distinct ID
 */
export const identifyUser = (
  user: AuthUser,
  userProfile: UserProfile | null = null,
  isAdmin: boolean = false
): void => {
  if (!isInitialized || !user?.email) return;

  const email = user.email;
  const domain = email.split('@')[1]?.toLowerCase();
  
  const orgNames: Record<string, string> = {
    'chocfin.com': 'ChocFin',
    'oxygn.cloud': 'OXYGN',
  };
  const orgName = orgNames[domain] || domain;

  posthog.identify(email, {
    email: email,
    display_name: userProfile?.display_name || null,
    avatar_url: userProfile?.avatar_url || null,
    is_admin: isAdmin,
    created_at: user.created_at || null,
    last_sign_in_at: user.last_sign_in_at || null,
  });

  posthog.group('organization', domain, {
    name: orgName,
    domain: domain,
  });
};

/**
 * Reset user identity on logout
 */
export const resetUser = (): void => {
  if (!isInitialized) return;
  posthog.reset();
};

// ============= Event Tracking =============

/**
 * Track custom event with standard properties
 */
export const trackEvent = (
  eventName: string,
  properties: Record<string, unknown> = {}
): void => {
  if (!isInitialized) return;
  
  posthog.capture(eventName, {
    timestamp: new Date().toISOString(),
    ...properties,
  });
};

/**
 * Track page view for SPA navigation
 */
export const trackPageView = (
  path: string,
  searchParams: string = '',
  url: string = ''
): void => {
  if (!isInitialized) return;
  
  posthog.capture('$pageview', {
    $current_url: url || window.location.href,
    path: path,
    search: searchParams,
  });
};

// ============= Feature Flags =============

/**
 * Check if a feature flag is enabled
 */
export const isFeatureEnabled = (flagKey: string): boolean => {
  if (!isInitialized) return false;
  return posthog.isFeatureEnabled(flagKey) ?? false;
};

/**
 * Get feature flag value (for multivariate flags)
 */
export const getFeatureFlag = (flagKey: string): string | boolean | undefined => {
  if (!isInitialized) return undefined;
  return posthog.getFeatureFlag(flagKey);
};

// ============= Error Tracking =============

/**
 * Track exception/error
 */
export const trackException = (
  error: Error | unknown,
  context: Record<string, unknown> = {}
): void => {
  if (!isInitialized) return;
  
  const err = error instanceof Error ? error : new Error(String(error));
  
  posthog.capture('$exception', {
    $exception_message: err.message,
    $exception_stack: err.stack || null,
    $exception_type: err.name || 'Error',
    timestamp: new Date().toISOString(),
    ...context,
  });
};

/**
 * Track API/network error with request context
 */
export const trackApiError = (
  endpoint: string,
  error: Error | { message?: string; code?: string; status?: number } | unknown,
  context: Record<string, unknown> = {}
): void => {
  if (!isInitialized) return;
  
  const err = error as { message?: string; code?: string; status?: number };
  
  posthog.capture('api_error', {
    endpoint: endpoint,
    error_message: err?.message || String(error),
    error_code: err?.code || null,
    status_code: err?.status || (context.statusCode as number | undefined) || null,
    timestamp: new Date().toISOString(),
    ...context,
  });
};

// ============= Performance Tracking =============

const trackPageLoadPerformance = (): void => {
  if (typeof window === 'undefined' || !window.performance) return;
  
  window.addEventListener('load', () => {
    setTimeout(() => {
      const entries = performance.getEntriesByType('navigation');
      const timing = entries[0] as PerformanceNavigationTiming | undefined;
      if (!timing) return;
      
      posthog.capture('page_load_performance', {
        dns_lookup_ms: Math.round(timing.domainLookupEnd - timing.domainLookupStart),
        tcp_connection_ms: Math.round(timing.connectEnd - timing.connectStart),
        ttfb_ms: Math.round(timing.responseStart - timing.requestStart),
        dom_interactive_ms: Math.round(timing.domInteractive - timing.navigationStart),
        dom_complete_ms: Math.round(timing.domComplete - timing.navigationStart),
        load_complete_ms: Math.round(timing.loadEventEnd - timing.navigationStart),
        transfer_size_bytes: timing.transferSize,
        encoded_body_size: timing.encodedBodySize,
        navigation_type: timing.type,
      });
    }, 100);
  });
};

/**
 * Track component render performance
 */
export const trackRenderPerformance = (
  componentName: string,
  renderTimeMs: number,
  context: Record<string, unknown> = {}
): void => {
  if (!isInitialized) return;
  
  posthog.capture('component_render', {
    component_name: componentName,
    render_time_ms: renderTimeMs,
    timestamp: new Date().toISOString(),
    ...context,
  });
};

/**
 * Create a performance marker and return a function to measure elapsed time
 */
export const startPerformanceMeasure = (_measureName: string): (() => number) => {
  const startTime = performance.now();
  
  return (): number => {
    const endTime = performance.now();
    return Math.round(endTime - startTime);
  };
};

/**
 * Get PostHog instance for advanced usage
 */
export const getPostHog = (): typeof posthog | null => {
  if (!isInitialized) return null;
  return posthog;
};

export default posthog;
