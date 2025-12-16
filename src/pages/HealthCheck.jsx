import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, XCircle, RefreshCw, Database, User, Table2, Bot, Key, Globe, Zap } from 'lucide-react';

const REQUIRED_TABLES = [
  import.meta.env.VITE_PROMPTS_TBL || 'cyg_prompts',
  import.meta.env.VITE_SETTINGS_TBL || 'cyg_settings',
  import.meta.env.VITE_MODELS_TBL || 'cyg_models',
  'projects',
];

const HealthCheck = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState({
    database: { status: 'pending', message: '' },
    tables: {},
    auth: { status: 'pending', message: '', user: null },
    openai: {
      apiKey: { status: 'pending', message: '' },
      apiUrl: { status: 'pending', message: '' },
      connection: { status: 'pending', message: '', latency: null },
      models: { status: 'pending', message: '', available: [] },
    },
  });

  const checkDatabaseConnection = async () => {
    try {
      const start = Date.now();
      const { error } = await supabase.from(REQUIRED_TABLES[0]).select('count').limit(1);
      const latency = Date.now() - start;
      
      if (error && !error.message.includes('does not exist')) {
        return { status: 'error', message: `Connection failed: ${error.message}` };
      }
      return { status: 'success', message: `Connected (${latency}ms)` };
    } catch (err) {
      return { status: 'error', message: `Connection error: ${err.message}` };
    }
  };

  const checkTable = async (tableName) => {
    try {
      const { data, error } = await supabase.from(tableName).select('*').limit(1);
      
      if (error) {
        if (error.message.includes('does not exist') || error.code === '42P01') {
          return { status: 'missing', message: 'Table does not exist', count: 0 };
        }
        return { status: 'error', message: error.message, count: 0 };
      }
      
      // Get row count
      const { count } = await supabase.from(tableName).select('*', { count: 'exact', head: true });
      return { status: 'success', message: 'Table exists', count: count || 0 };
    } catch (err) {
      return { status: 'error', message: err.message, count: 0 };
    }
  };

  const checkAuth = async () => {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) {
        return { status: 'error', message: error.message, user: null };
      }
      
      if (session?.user) {
        return { 
          status: 'authenticated', 
          message: `Logged in as ${session.user.email}`,
          user: session.user 
        };
      }
      
      return { status: 'unauthenticated', message: 'No active session', user: null };
    } catch (err) {
      return { status: 'error', message: err.message, user: null };
    }
  };

  const checkOpenAIConfig = () => {
    // Edge function handles the API key securely
    return { 
      apiKey: { status: 'success', message: 'Managed via edge function secret' },
      apiUrl: { status: 'success', message: 'https://api.openai.com/v1/chat/completions' }
    };
  };

  const checkOpenAIConnection = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('openai-proxy', {
        body: { action: 'health' }
      });

      if (error) {
        console.error('Edge function error:', error);
        return { status: 'error', message: `Edge function error: ${error.message}`, latency: null };
      }

      return {
        status: data.status || 'error',
        message: data.message || 'Unknown response',
        latency: data.latency || null
      };
    } catch (err) {
      console.error('Connection check error:', err);
      return { status: 'error', message: `Connection failed: ${err.message}`, latency: null };
    }
  };

  const checkOpenAIModels = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('openai-proxy', {
        body: { action: 'models' }
      });

      if (error) {
        console.error('Edge function error:', error);
        return { status: 'error', message: `Edge function error: ${error.message}`, available: [] };
      }

      return {
        status: data.status || 'error',
        message: data.message || 'Unknown response',
        available: data.available || []
      };
    } catch (err) {
      console.error('Models check error:', err);
      return { status: 'error', message: `Failed: ${err.message}`, available: [] };
    }
  };

  const runHealthCheck = async () => {
    setIsLoading(true);
    
    const [dbResult, authResult] = await Promise.all([
      checkDatabaseConnection(),
      checkAuth(),
    ]);

    const tableResults = {};
    for (const table of REQUIRED_TABLES) {
      tableResults[table] = await checkTable(table);
    }

    // OpenAI checks
    const openaiConfig = checkOpenAIConfig();
    const [openaiConnection, openaiModels] = await Promise.all([
      checkOpenAIConnection(),
      checkOpenAIModels(),
    ]);

    setResults({
      database: dbResult,
      tables: tableResults,
      auth: authResult,
      openai: {
        apiKey: openaiConfig.apiKey,
        apiUrl: openaiConfig.apiUrl,
        connection: openaiConnection,
        models: openaiModels,
      },
    });
    
    setIsLoading(false);
  };

  useEffect(() => {
    runHealthCheck();
  }, []);

  const StatusIcon = ({ status }) => {
    switch (status) {
      case 'success':
      case 'authenticated':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'error':
      case 'missing':
        return <XCircle className="h-5 w-5 text-red-500" />;
      case 'warning':
      case 'unauthenticated':
        return <XCircle className="h-5 w-5 text-yellow-500" />;
      default:
        return <RefreshCw className="h-5 w-5 text-muted-foreground animate-spin" />;
    }
  };

  const StatusBadge = ({ status }) => {
    const variants = {
      success: 'bg-green-100 text-green-800 border-green-200',
      authenticated: 'bg-green-100 text-green-800 border-green-200',
      error: 'bg-red-100 text-red-800 border-red-200',
      missing: 'bg-red-100 text-red-800 border-red-200',
      warning: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      unauthenticated: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      pending: 'bg-gray-100 text-gray-800 border-gray-200',
    };
    
    return (
      <Badge variant="outline" className={variants[status] || variants.pending}>
        {status}
      </Badge>
    );
  };

  return (
    <div className="container mx-auto p-6 max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Backend Health Check</h1>
          <p className="text-muted-foreground">Verify database connectivity and configuration</p>
        </div>
        <Button onClick={runHealthCheck} disabled={isLoading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <div className="space-y-4">
        {/* Database Connection */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <Database className="h-5 w-5 text-primary" />
              <div className="flex-1">
                <CardTitle className="text-lg">Database Connection</CardTitle>
                <CardDescription>Lovable Cloud connectivity status</CardDescription>
              </div>
              <StatusIcon status={results.database.status} />
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{results.database.message}</span>
              <StatusBadge status={results.database.status} />
            </div>
          </CardContent>
        </Card>

        {/* Tables */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <Table2 className="h-5 w-5 text-primary" />
              <div className="flex-1">
                <CardTitle className="text-lg">Required Tables</CardTitle>
                <CardDescription>Database tables needed by the application</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {REQUIRED_TABLES.map((table) => {
                const result = results.tables[table] || { status: 'pending', message: 'Checking...', count: 0 };
                return (
                  <div key={table} className="flex items-center justify-between py-2 border-b last:border-0">
                    <div className="flex items-center gap-3">
                      <StatusIcon status={result.status} />
                      <div>
                        <span className="font-mono text-sm">{table}</span>
                        {result.status === 'success' && (
                          <span className="text-xs text-muted-foreground ml-2">
                            ({result.count} rows)
                          </span>
                        )}
                      </div>
                    </div>
                    <StatusBadge status={result.status} />
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Auth Status */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <User className="h-5 w-5 text-primary" />
              <div className="flex-1">
                <CardTitle className="text-lg">Authentication</CardTitle>
                <CardDescription>Current session status</CardDescription>
              </div>
              <StatusIcon status={results.auth.status} />
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{results.auth.message}</span>
              <StatusBadge status={results.auth.status} />
            </div>
            {results.auth.user && (
              <div className="mt-3 p-3 bg-muted rounded-lg text-sm">
                <div><strong>User ID:</strong> {results.auth.user.id}</div>
                <div><strong>Email:</strong> {results.auth.user.email}</div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* OpenAI Status */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <Bot className="h-5 w-5 text-primary" />
              <div className="flex-1">
                <CardTitle className="text-lg">OpenAI API Status</CardTitle>
                <CardDescription>API configuration and connectivity</CardDescription>
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

              {/* Show available models if any */}
              {results.openai.models.available.length > 0 && (
                <div className="mt-3 p-3 bg-muted rounded-lg">
                  <p className="text-xs font-medium mb-2">GPT Models:</p>
                  <div className="flex flex-wrap gap-1">
                    {results.openai.models.available.slice(0, 10).map(model => (
                      <Badge key={model} variant="secondary" className="text-xs">
                        {model}
                      </Badge>
                    ))}
                    {results.openai.models.available.length > 10 && (
                      <Badge variant="outline" className="text-xs">
                        +{results.openai.models.available.length - 10} more
                      </Badge>
                    )}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Environment Variables */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Environment Configuration</CardTitle>
            <CardDescription>Table name configuration from environment</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm font-mono">
              <div className="flex justify-between">
                <span className="text-muted-foreground">VITE_PROMPTS_TBL:</span>
                <span>{import.meta.env.VITE_PROMPTS_TBL || '(not set)'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">VITE_SETTINGS_TBL:</span>
                <span>{import.meta.env.VITE_SETTINGS_TBL || '(not set)'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">VITE_MODELS_TBL:</span>
                <span>{import.meta.env.VITE_MODELS_TBL || '(not set)'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">VITE_SUPABASE_URL:</span>
                <span className="truncate max-w-[200px]">{import.meta.env.VITE_SUPABASE_URL ? '✓ Set' : '(not set)'}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default HealthCheck;
