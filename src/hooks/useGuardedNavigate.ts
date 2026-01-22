import { useCallback } from 'react';
import { useNavigate, NavigateOptions, To } from 'react-router-dom';
import { useApiCallContext } from '@/contexts/ApiCallContext';

/**
 * A hook that returns a navigate function that respects in-progress API calls.
 * If calls are running, shows a confirmation dialog before navigating.
 */
export const useGuardedNavigate = (): ((to: To, options?: NavigateOptions) => void) => {
  const navigate = useNavigate();
  const { requestNavigation } = useApiCallContext();

  const guardedNavigate = useCallback(
    (to: To, options?: NavigateOptions) => {
      requestNavigation(to, () => navigate(to, options));
    },
    [navigate, requestNavigation]
  );

  return guardedNavigate;
};
