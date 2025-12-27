import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { User, RefreshCw, CheckCircle, XCircle } from 'lucide-react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { useAuth } from '@/contexts/AuthContext';

const StatusIcon = ({ status }) => {
  switch (status) {
    case 'authenticated':
      return <CheckCircle className="h-5 w-5 text-green-500" />;
    case 'error':
      return <XCircle className="h-5 w-5 text-red-500" />;
    case 'unauthenticated':
      return <XCircle className="h-5 w-5 text-yellow-500" />;
    default:
      return <RefreshCw className="h-5 w-5 text-muted-foreground animate-spin" />;
  }
};

const StatusBadge = ({ status }) => {
  const variants = {
    authenticated: 'bg-green-100 text-green-800 border-green-200',
    error: 'bg-red-100 text-red-800 border-red-200',
    unauthenticated: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    pending: 'bg-gray-100 text-gray-800 border-gray-200',
  };
  
  return (
    <Badge variant="outline" className={variants[status] || variants.pending}>
      {status}
    </Badge>
  );
};

const AuthSection = ({ results, isLoading, onRefresh }) => {
  const { userProfile } = useAuth();

  const getInitials = () => {
    if (userProfile?.display_name) {
      return userProfile.display_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
    }
    if (results.auth.user?.email) {
      return results.auth.user.email[0].toUpperCase();
    }
    return 'U';
  };

  return (
    <div className="space-y-4">

      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">{results.auth.message}</span>
            <StatusBadge status={results.auth.status} />
          </div>
          {results.auth.user && (
            <div className="mt-3 p-3 bg-muted rounded-lg text-sm space-y-2">
              <div><strong>User ID:</strong> {results.auth.user.id}</div>
              <div className="flex items-center gap-2">
                <strong>User:</strong>
                <Avatar className="h-6 w-6">
                  <AvatarImage src={userProfile?.avatar_url} alt={userProfile?.display_name || results.auth.user.email} />
                  <AvatarFallback className="bg-primary/10 text-primary text-xs">
                    {getInitials()}
                  </AvatarFallback>
                </Avatar>
                <span>{userProfile?.display_name || results.auth.user.email}</span>
              </div>
              {userProfile?.display_name && (
                <div><strong>Email:</strong> {results.auth.user.email}</div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AuthSection;
