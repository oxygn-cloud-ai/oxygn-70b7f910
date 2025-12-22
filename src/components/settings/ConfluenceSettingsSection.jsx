import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Save, TestTube, CheckCircle2, XCircle, Loader2, ExternalLink } from 'lucide-react';
import { useConfluencePages } from '@/hooks/useConfluencePages';

const ConfluenceSettingsSection = ({ 
  settings, 
  editedValues, 
  onValueChange, 
  onSave, 
  isSaving 
}) => {
  
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const { testConnection } = useConfluencePages();

  const baseUrl = editedValues.confluence_base_url ?? settings.confluence_base_url?.value ?? '';
  const email = editedValues.confluence_email ?? settings.confluence_email?.value ?? '';
  const savedApiToken = settings.confluence_api_token?.value ?? '';
  const apiToken = editedValues.confluence_api_token ?? '';
  const hasStoredToken = !!savedApiToken && editedValues.confluence_api_token === undefined;

  const handleTestConnection = async () => {
    if (editedValues.confluence_base_url !== undefined) {
      await onSave('confluence_base_url');
    }
    if (editedValues.confluence_email !== undefined) {
      await onSave('confluence_email');
    }
    if (editedValues.confluence_api_token !== undefined) {
      await onSave('confluence_api_token');
    }

    setIsTesting(true);
    setTestResult(null);
    
    try {
      const result = await testConnection();
      setTestResult(result);
    } catch (error) {
      setTestResult({ success: false, message: error.message });
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <TooltipProvider>
      <div className="space-y-4">
          {/* Base URL */}
          <div className="space-y-2 p-4 border rounded-lg">
            <Label htmlFor="confluence_base_url">Base URL</Label>
            <div className="flex gap-2">
              <Input
                id="confluence_base_url"
                placeholder="https://yourcompany.atlassian.net"
                value={baseUrl}
                onChange={(e) => onValueChange('confluence_base_url', e.target.value)}
                className="flex-1"
              />
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => onSave('confluence_base_url')}
                    disabled={isSaving || editedValues.confluence_base_url === undefined}
                  >
                    <Save className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Save</TooltipContent>
              </Tooltip>
            </div>
            <p className="text-xs text-muted-foreground">
              Your Confluence instance URL (e.g., https://yourcompany.atlassian.net)
            </p>
          </div>

          {/* Email */}
          <div className="space-y-2 p-4 border rounded-lg">
            <Label htmlFor="confluence_email">Email</Label>
            <div className="flex gap-2">
              <Input
                id="confluence_email"
                type="email"
                placeholder="your.email@company.com"
                value={email}
                onChange={(e) => onValueChange('confluence_email', e.target.value)}
                className="flex-1"
              />
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => onSave('confluence_email')}
                    disabled={isSaving || editedValues.confluence_email === undefined}
                  >
                    <Save className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Save</TooltipContent>
              </Tooltip>
            </div>
            <p className="text-xs text-muted-foreground">
              The email associated with your Atlassian account
            </p>
          </div>

          {/* API Token */}
          <div className="space-y-2 p-4 border rounded-lg">
            <Label htmlFor="confluence_api_token">API Token</Label>
            <div className="flex gap-2">
              <Input
                id="confluence_api_token"
                type="password"
                placeholder={hasStoredToken ? '••••••••••••••••' : 'Enter API token'}
                value={apiToken}
                onChange={(e) => onValueChange('confluence_api_token', e.target.value)}
                className="flex-1"
                autoComplete="new-password"
              />
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => onSave('confluence_api_token')}
                    disabled={isSaving || editedValues.confluence_api_token === undefined}
                  >
                    <Save className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Save</TooltipContent>
              </Tooltip>
            </div>
            <p className="text-xs text-muted-foreground">
              {hasStoredToken 
                ? 'API token is saved. Enter a new value to update it.'
                : 'Create an API token from your Atlassian account settings'}
            </p>
          </div>

          {/* Test Connection */}
          <div className="p-4 border rounded-lg">
            <div className="flex items-center gap-4">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    onClick={handleTestConnection}
                    disabled={isTesting || !baseUrl || !email || (!apiToken && !hasStoredToken)}
                  >
                    {isTesting ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <TestTube className="h-4 w-4 mr-2" />
                    )}
                    Test Connection
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Verify your Confluence credentials</TooltipContent>
              </Tooltip>

              {testResult && (
                <div className={`flex items-center gap-2 text-sm ${testResult.success ? 'text-green-600' : 'text-red-600'}`}>
                  {testResult.success ? (
                    <>
                      <CheckCircle2 className="h-4 w-4" />
                      <span>Connected successfully</span>
                    </>
                  ) : (
                    <>
                      <XCircle className="h-4 w-4" />
                      <span>{testResult.message}</span>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
      </div>
    </TooltipProvider>
  );
};

export default ConfluenceSettingsSection;
