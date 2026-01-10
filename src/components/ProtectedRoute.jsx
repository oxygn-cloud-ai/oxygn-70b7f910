import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

  // DEVELOPMENT ONLY: Bypass authentication for local testing
  // This entire block is removed from production builds by Vite's dead code elimination
  if (import.meta.env.DEV) {
    console.warn(
      '%c[DEV MODE] Authentication bypassed for testing',
      'background: #fbbf24; color: #000; padding: 4px 8px; border-radius: 4px; font-weight: bold;'
    );
    return children;
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/auth" replace />;
  }

  return children;
};

export default ProtectedRoute;
