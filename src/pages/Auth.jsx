import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import chocolateFullLogo from '@/assets/chocolate-full-logo.png';

const Auth = () => {
  const { signInWithGoogle, isAuthenticated, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && isAuthenticated) {
      navigate('/');
    }
  }, [isAuthenticated, loading, navigate]);

  const handleGoogleSignIn = async () => {
    await signInWithGoogle();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-surface via-surface-container to-surface-container-high">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-surface via-surface-container to-surface-container-high p-4">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-tertiary/5 rounded-full blur-3xl" />
      </div>

      <Card className="w-full max-w-md relative bg-surface-container-high/95 backdrop-blur shadow-elevation-3 border-outline-variant/50 rounded-3xl">
        <CardHeader className="text-center pb-2">
          {/* Logo */}
          <div className="flex justify-center mb-4">
            <img 
              src={chocolateFullLogo} 
              alt="Chocolate Finance" 
              className="h-16 object-contain"
            />
          </div>

          <CardTitle className="text-display-small font-bold text-on-surface">
            Qonsol
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-6 pt-4">
          {/* Google Sign In Button */}
          <Button 
            onClick={handleGoogleSignIn}
            variant="outline"
            className="w-full flex items-center justify-center gap-3 h-14 bg-surface text-on-surface hover:bg-surface-container-highest border-outline hover:border-primary/30 transition-all duration-medium-2 rounded-full text-label-large"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            <span className="font-medium">Sign in with Google</span>
          </Button>

          {/* Footer text */}
          <p className="text-center text-label-small text-on-surface-variant">
            Only accounts from authorized domains can access this application
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;
