import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const isOAuthCallbackInProgress = (): boolean => {
  const hash = window.location.hash;
  const search = window.location.search;
  
  // Check hash-based tokens (implicit flow)
  if (hash && (hash.includes('access_token') || hash.includes('refresh_token') || hash.includes('id_token'))) {
    console.debug('[ProtectedRoute] OAuth hash detected, waiting...');
    return true;
  }
  
  // Check query-based callback params (authorization code flow)
  const params = new URLSearchParams(search);
  if (params.has('code') || params.has('state') || params.has('error')) {
    console.debug('[ProtectedRoute] OAuth query params detected, waiting...');
    return true;
  }
  
  return false;
};

const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading || isOAuthCallbackInProgress()) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
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
