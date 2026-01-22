import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { trackPageView } from '@/lib/posthog';

/**
 * Component to track page views in SPA
 * Captures route changes and sends to PostHog
 */
const PostHogPageView = () => {
  const location = useLocation();

  useEffect(() => {
    // Track page view on route change
    trackPageView(
      location.pathname,
      location.search,
      window.location.origin + location.pathname + location.search
    );
  }, [location.pathname, location.search]);

  return null;
};

export default PostHogPageView;
