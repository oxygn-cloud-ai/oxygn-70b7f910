import React, { useState, useEffect } from 'react';
import { Key, Trash2, Loader2, Eye, EyeOff, ExternalLink } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { SettingCard } from '@/components/ui/setting-card';
import { SettingRow } from '@/components/ui/setting-row';
import { useUserCredentials } from '@/hooks/useUserCredentials';
import { toast } from '@/components/ui/sonner';
import { trackEvent } from '@/lib/posthog';

const OpenAIIntegrationSettings = () => {
  const { 
    credentialStatus, 
    getCredentialStatus, 
    setCredential, 
    deleteCredential,
    isLoading: isCredLoading 
  } = useUserCredentials();
  const [isSaving, setIsSaving] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);

  // Check OpenAI status on mount
  useEffect(() => {
    getCredentialStatus('openai');
  }, [getCredentialStatus]);

  const openaiStatus = credentialStatus['openai'] || {};
  const isConfigured = openaiStatus.api_key === true;

  const handleSaveKey = async () => {
    if (!apiKey.trim()) {
      toast.error('Please enter an API key');
      return;
    }

    // Basic validation for OpenAI key format
    if (!apiKey.trim().startsWith('sk-')) {
      toast.error('Invalid API key format', {
        description: 'OpenAI API keys should start with "sk-"'
      });
      return;
    }

    setIsSaving(true);
    try {
      await setCredential('openai', 'api_key', apiKey.trim());
      setApiKey('');
      toast.success('OpenAI API key saved');
      trackEvent('openai_api_key_saved');
    } catch (error) {
      toast.error('Failed to save API key');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteKey = async () => {
    setIsSaving(true);
    try {
      await deleteCredential('openai', 'api_key');
      toast.success('OpenAI API key removed');
      trackEvent('openai_api_key_deleted');
    } catch (error) {
      toast.error('Failed to remove API key');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Status Card */}
      <SettingCard label="Connection">
        <div className="flex items-center gap-3 mb-3">
          <Key className="h-5 w-5 text-on-surface-variant" />
          <div className="flex-1">
            <h4 className="text-body-sm text-on-surface font-medium">
              {isConfigured ? 'Connected' : 'Not Connected'}
            </h4>
            <p className="text-[10px] text-on-surface-variant">
              {isConfigured 
                ? 'Your API key is securely stored' 
                : 'Add your OpenAI API key to use GPT models'}
            </p>
          </div>
        {isConfigured ? (
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-success/10 text-success">Active</span>
        ) : (
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-warning/10 text-warning">Not Set</span>
        )}
        </div>
      </SettingCard>

      {/* API Key Card */}
      <SettingCard label="API Key">
        <div className="space-y-3">
          <SettingRow 
            label="OpenAI API Key" 
            description={isConfigured ? "Key is securely stored" : "Required for running prompts"}
          >
            {isConfigured ? (
              <div className="flex items-center gap-2">
                <span className="text-body-sm text-on-surface font-mono">sk-••••••••••••</span>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={handleDeleteKey}
                      disabled={isSaving || isCredLoading}
                      className="w-8 h-8 flex items-center justify-center rounded-m3-full text-on-surface-variant hover:bg-on-surface/[0.08] hover:text-destructive disabled:opacity-50"
                    >
                      {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent className="text-[10px]">Remove API Key</TooltipContent>
                </Tooltip>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <input
                  type={showKey ? "text" : "password"}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="sk-..."
                  className="h-8 w-48 px-2 bg-surface-container rounded-m3-sm border border-outline-variant text-body-sm text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => setShowKey(!showKey)}
                      className="w-8 h-8 flex items-center justify-center rounded-m3-full text-on-surface-variant hover:bg-on-surface/[0.08]"
                    >
                      {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent className="text-[10px]">{showKey ? 'Hide' : 'Show'} Key</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={handleSaveKey}
                      disabled={isSaving || isCredLoading || !apiKey.trim()}
                      className="w-8 h-8 flex items-center justify-center rounded-m3-full text-on-surface-variant hover:bg-primary/10 hover:text-primary disabled:opacity-50"
                    >
                      {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Key className="h-4 w-4" />}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent className="text-[10px]">Save API Key</TooltipContent>
                </Tooltip>
              </div>
            )}
          </SettingRow>

          {/* Help Link */}
          <div className="pt-2 border-t border-outline-variant">
            <a
              href="https://platform.openai.com/api-keys"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-[10px] text-primary hover:underline"
            >
              <ExternalLink className="h-3 w-3" />
              Get an API key from OpenAI
            </a>
          </div>
        </div>
      </SettingCard>
    </div>
  );
};

export default OpenAIIntegrationSettings;
