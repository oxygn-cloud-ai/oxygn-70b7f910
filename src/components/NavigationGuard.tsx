import { useEffect } from 'react';
import { useApiCallContext } from '@/contexts/ApiCallContext';

/**
 * NavigationGuard only warns when closing the browser tab/window during API calls.
 * Prompt switching and in-app navigation now allow calls to continue in background.
 * The LiveApiDashboard in TopBar shows active call status.
 */
const NavigationGuard: React.FC = () => {
  const { isApiCallInProgress } = useApiCallContext();

  // Warn user when closing tab/window during API calls
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isApiCallInProgress) {
        e.preventDefault();
        e.returnValue = '';
        return '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isApiCallInProgress]);

  return null; // No dialog - API calls continue in background
};

export default NavigationGuard;
