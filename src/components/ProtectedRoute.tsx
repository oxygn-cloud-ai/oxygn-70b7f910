import React, { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { isOAuthCallbackInProgress } from '@/utils/oauthDetection';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const { isAuthenticated, loading } = useAuth();
  const [callbackTimedOut, setCallbackTimedOut] = useState(false);

  useEffect(() => {
    if (!isOAuthCallbackInProgress()) return;
    const timer = setTimeout(() => {
      console.warn('[ProtectedRoute] OAuth callback timeout after 5s');
      setCallbackTimedOut(true);
    }, 5000);
    return () => clearTimeout(timer);
  }, []);

  const callbackInProgress = isOAuthCallbackInProgress() && !callbackTimedOut;

  if (loading || callbackInProgress) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    console.debug('[ProtectedRoute] Not authenticated, redirecting to /auth');
    return <Navigate to="/auth" replace />;
  }

  return children;
};

export default ProtectedRoute;
