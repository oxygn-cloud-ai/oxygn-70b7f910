import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Settings, RefreshCw } from 'lucide-react';

const EnvironmentSection = ({ isLoading, onRefresh }) => {
  return (
    <div className="space-y-4">

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Environment Variables</CardTitle>
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
  );
};

export default EnvironmentSection;
