import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, XCircle, RefreshCw, Database, User, Table2 } from 'lucide-react';

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

    setResults({
      database: dbResult,
      tables: tableResults,
      auth: authResult,
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
