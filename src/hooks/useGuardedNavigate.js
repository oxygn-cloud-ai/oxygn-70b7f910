import { useNavigate } from 'react-router-dom';
import { useApiCallContext } from '@/contexts/ApiCallContext';
import { useCallback } from 'react';

export const useGuardedNavigate = () => {
  const navigate = useNavigate();
  const { navigateWithGuard } = useApiCallContext();

  const guardedNavigate = useCallback((to, options) => {
    navigateWithGuard(() => navigate(to, options));
  }, [navigate, navigateWithGuard]);

  return guardedNavigate;
};
