import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Bot, Key, Globe, Zap, RefreshCw, CheckCircle, XCircle } from 'lucide-react';

const StatusIcon = ({ status }) => {
  switch (status) {
    case 'success':
      return <CheckCircle className="h-5 w-5 text-green-500" />;
    case 'error':
      return <XCircle className="h-5 w-5 text-red-500" />;
    default:
      return <RefreshCw className="h-5 w-5 text-muted-foreground animate-spin" />;
  }
};

const StatusBadge = ({ status }) => {
  const variants = {
    success: 'bg-green-100 text-green-800 border-green-200',
    error: 'bg-red-100 text-red-800 border-red-200',
    pending: 'bg-gray-100 text-gray-800 border-gray-200',
  };
  
  return (
    <Badge variant="outline" className={variants[status] || variants.pending}>
      {status}
    </Badge>
  );
};

const OpenAISection = ({ results, isLoading, onRefresh }) => {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Bot className="h-5 w-5" />
            AI API
          </h2>
          <p className="text-sm text-muted-foreground">API configuration and connectivity</p>
        </div>
        <Button variant="ghost" size="icon" onClick={onRefresh} disabled={isLoading}>
          <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <Bot className="h-5 w-5 text-primary" />
            <div className="flex-1">
              <CardTitle className="text-lg">API Status</CardTitle>
              <CardDescription>Configuration and connectivity</CardDescription>
            </div>
            <StatusIcon status={results.openai.connection.status} />
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {/* API Key */}
            <div className="flex items-center justify-between py-2 border-b">
              <div className="flex items-center gap-3">
                <Key className="h-4 w-4 text-muted-foreground" />
                <div>
                  <span className="text-sm font-medium">API Key</span>
                  <p className="text-xs text-muted-foreground">{results.openai.apiKey.message}</p>
                </div>
              </div>
              <StatusBadge status={results.openai.apiKey.status} />
            </div>

            {/* API URL */}
            <div className="flex items-center justify-between py-2 border-b">
              <div className="flex items-center gap-3">
                <Globe className="h-4 w-4 text-muted-foreground" />
                <div>
                  <span className="text-sm font-medium">API Endpoint</span>
                  <p className="text-xs text-muted-foreground truncate max-w-[250px]">{results.openai.apiUrl.message}</p>
                </div>
              </div>
              <StatusBadge status={results.openai.apiUrl.status} />
            </div>

            {/* Connection Test */}
            <div className="flex items-center justify-between py-2 border-b">
              <div className="flex items-center gap-3">
                <Zap className="h-4 w-4 text-muted-foreground" />
                <div>
                  <span className="text-sm font-medium">Connection Test</span>
                  <p className="text-xs text-muted-foreground">{results.openai.connection.message}</p>
                </div>
              </div>
              <StatusBadge status={results.openai.connection.status} />
            </div>

            {/* Available Models */}
            <div className="flex items-center justify-between py-2">
              <div className="flex items-center gap-3">
                <Bot className="h-4 w-4 text-muted-foreground" />
                <div>
                  <span className="text-sm font-medium">Available Models</span>
                  <p className="text-xs text-muted-foreground">{results.openai.models.message}</p>
                </div>
              </div>
              <StatusBadge status={results.openai.models.status} />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default OpenAISection;
