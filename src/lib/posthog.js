import posthog from 'posthog-js';

const POSTHOG_API_KEY = import.meta.env.VITE_POSTHOG_API_KEY;
const POSTHOG_HOST = 'https://eu.i.posthog.com';

let isInitialized = false;

/**
 * Initialize PostHog with EU region configuration
 * Full session recording enabled, no masking
 */
export const initPostHog = () => {
  if (isInitialized || !POSTHOG_API_KEY) {
    if (!POSTHOG_API_KEY) {
      console.warn('PostHog API key not configured');
    }
    return;
  }

  posthog.init(POSTHOG_API_KEY, {
    api_host: POSTHOG_HOST,
    capture_pageview: false, // Manual SPA tracking
    capture_pageleave: true,
    autocapture: true,
    session_recording: {
      maskAllInputs: false,
      maskTextSelector: null,
    },
    enable_heatmaps: true,
    persistence: 'localStorage',
    bootstrap: {
      distinctID: undefined, // Will be set on identify
    },
  });

  isInitialized = true;
};

/**
 * Identify authenticated user with their email as distinct ID
 * Groups user by email domain for organization analytics
 */
export const identifyUser = (user, userProfile = null, isAdmin = false) => {
  if (!isInitialized || !user?.email) return;

  const email = user.email;
  const domain = email.split('@')[1]?.toLowerCase();
  
  // Get organization name from domain
  const orgNames = {
    'chocfin.com': 'ChocFin',
    'oxygn.cloud': 'OXYGN',
  };
  const orgName = orgNames[domain] || domain;

  // Identify user with email as distinct ID
  posthog.identify(email, {
    email: email,
    display_name: userProfile?.display_name || null,
    avatar_url: userProfile?.avatar_url || null,
    is_admin: isAdmin,
    created_at: user.created_at || null,
    last_sign_in_at: user.last_sign_in_at || null,
  });

  // Group by organization (email domain)
  posthog.group('organization', domain, {
    name: orgName,
    domain: domain,
  });
};

/**
 * Reset user identity on logout
 */
export const resetUser = () => {
  if (!isInitialized) return;
  posthog.reset();
};

/**
 * Track custom event with standard properties
 */
export const trackEvent = (eventName, properties = {}) => {
  if (!isInitialized) return;
  
  posthog.capture(eventName, {
    timestamp: new Date().toISOString(),
    ...properties,
  });
};

/**
 * Track page view for SPA navigation
 */
export const trackPageView = (path, searchParams = '', url = '') => {
  if (!isInitialized) return;
  
  posthog.capture('$pageview', {
    $current_url: url || window.location.href,
    path: path,
    search: searchParams,
  });
};

/**
 * Check if a feature flag is enabled
 */
export const isFeatureEnabled = (flagKey) => {
  if (!isInitialized) return false;
  return posthog.isFeatureEnabled(flagKey);
};

/**
 * Get feature flag value (for multivariate flags)
 */
export const getFeatureFlag = (flagKey) => {
  if (!isInitialized) return null;
  return posthog.getFeatureFlag(flagKey);
};

/**
 * Track exception/error
 */
export const trackException = (error, context = {}) => {
  if (!isInitialized) return;
  
  posthog.capture('$exception', {
    $exception_message: error?.message || String(error),
    $exception_stack: error?.stack || null,
    $exception_type: error?.name || 'Error',
    timestamp: new Date().toISOString(),
    ...context,
  });
};

/**
 * Get PostHog instance for advanced usage
 */
export const getPostHog = () => {
  if (!isInitialized) return null;
  return posthog;
};

export default posthog;
