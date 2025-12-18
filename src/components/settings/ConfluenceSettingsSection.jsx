import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Save, TestTube, Eye, EyeOff, CheckCircle2, XCircle, Loader2, ExternalLink } from 'lucide-react';
import { useConfluencePages } from '@/hooks/useConfluencePages';

const ConfluenceSettingsSection = ({ 
  settings, 
  editedValues, 
  onValueChange, 
  onSave, 
  isSaving 
}) => {
  const [showToken, setShowToken] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const { testConnection } = useConfluencePages();

  const baseUrl = editedValues.confluence_base_url ?? settings.confluence_base_url?.value ?? '';
  const email = editedValues.confluence_email ?? settings.confluence_email?.value ?? '';
  const apiToken = editedValues.confluence_api_token ?? settings.confluence_api_token?.value ?? '';

  const handleTestConnection = async () => {
    // First save any pending changes
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
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <h2 className="text-2xl font-bold">Confluence</h2>
        </div>
        
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Connection Settings</CardTitle>
            <CardDescription>
              Configure your Atlassian Confluence connection to attach pages to assistants and prompts.
              <a 
                href="https://id.atlassian.com/manage-profile/security/api-tokens" 
                target="_blank" 
                rel="noopener noreferrer"
                className="ml-1 inline-flex items-center gap-1 text-primary hover:underline"
              >
                Get API Token <ExternalLink className="h-3 w-3" />
              </a>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Base URL */}
            <div className="space-y-2">
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
            <div className="space-y-2">
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
            <div className="space-y-2">
              <Label htmlFor="confluence_api_token">API Token</Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    id="confluence_api_token"
                    type={showToken ? 'text' : 'password'}
                    placeholder="••••••••••••••••"
                    value={apiToken}
                    onChange={(e) => onValueChange('confluence_api_token', e.target.value)}
                    className="pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full px-3"
                    onClick={() => setShowToken(!showToken)}
                  >
                    {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
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
                Create an API token from your Atlassian account settings
              </p>
            </div>

            {/* Test Connection */}
            <div className="pt-4 border-t">
              <div className="flex items-center gap-4">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      onClick={handleTestConnection}
                      disabled={isTesting || !baseUrl || !email || !apiToken}
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
          </CardContent>
        </Card>
      </div>
    </TooltipProvider>
  );
};

export default ConfluenceSettingsSection;
