import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Database, Table2, RefreshCw, CheckCircle, XCircle } from 'lucide-react';

const StatusIcon = ({ status }) => {
  switch (status) {
    case 'success':
      return <CheckCircle className="h-5 w-5 text-green-500" />;
    case 'error':
    case 'missing':
      return <XCircle className="h-5 w-5 text-red-500" />;
    default:
      return <RefreshCw className="h-5 w-5 text-muted-foreground animate-spin" />;
  }
};

const StatusBadge = ({ status }) => {
  const variants = {
    success: 'bg-green-100 text-green-800 border-green-200',
    error: 'bg-red-100 text-red-800 border-red-200',
    missing: 'bg-red-100 text-red-800 border-red-200',
    pending: 'bg-gray-100 text-gray-800 border-gray-200',
  };
  
  return (
    <Badge variant="outline" className={variants[status] || variants.pending}>
      {status}
    </Badge>
  );
};

const DatabaseSection = ({ results, tables, isLoading, onRefresh }) => {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Database className="h-5 w-5" />
            Database
          </h2>
          <p className="text-sm text-muted-foreground">Database connectivity and tables</p>
        </div>
        <Button variant="ghost" size="icon" onClick={onRefresh} disabled={isLoading}>
          <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {/* Database Connection */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <Database className="h-5 w-5 text-primary" />
            <div className="flex-1">
              <CardTitle className="text-lg">Connection</CardTitle>
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
            {tables.map((table) => {
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
    </div>
  );
};

export default DatabaseSection;
