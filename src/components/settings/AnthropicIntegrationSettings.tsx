import { useState, useEffect } from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { SettingCard } from "@/components/ui/setting-card";
import { SettingRow } from "@/components/ui/setting-row";
import { useUserCredentials } from "@/hooks/useUserCredentials";
import { toast } from "@/components/ui/sonner";
import { parseApiError } from "@/utils/apiErrorUtils";
import { trackEvent } from '@/lib/posthog';
import { 
  Save, Trash2, ExternalLink, Loader2, 
  Key, Bot, CheckCircle, XCircle, ShieldCheck
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface KeyValidation {
  success: boolean;
  message: string;
}

const AnthropicIntegrationSettings = () => {
  const { 
    getCredentialStatus, 
    setCredential, 
    deleteCredential,
    isServiceConfigured,
    isSystemKeyActive,
    isLoading: isCredLoading 
  } = useUserCredentials();
  
  const [apiKey, setApiKey] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [keyValidation, setKeyValidation] = useState<KeyValidation | null>(null);
  
  const hasCredentials = isServiceConfigured('anthropic');
  const systemKeyActive = isSystemKeyActive('anthropic');

  useEffect(() => {
    getCredentialStatus('anthropic');
  }, [getCredentialStatus]);

  const handleSaveCredentials = async () => {
    const trimmedKey = apiKey.trim();
    if (!trimmedKey) {
      toast.error('API key is required');
      return;
    }
    if (!trimmedKey.startsWith('sk-ant')) {
      toast.warning('Unusual key format', {
        description: 'Anthropic keys typically start with "sk-ant"'
      });
    }
    setIsSaving(true);
    try {
      await setCredential('anthropic', 'api_key', trimmedKey);
      toast.success('Anthropic API key saved securely');
      setApiKey('');
      setKeyValidation(null);
      await getCredentialStatus('anthropic');
      trackEvent('anthropic_credentials_saved');
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      const parsed = parseApiError(errorMsg);
      toast.error(parsed.title, { description: parsed.message });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteCredentials = async () => {
    setIsSaving(true);
    try {
      await deleteCredential('anthropic', 'api_key');
      toast.success('Anthropic API key removed');
      setKeyValidation(null);
      await getCredentialStatus('anthropic');
      trackEvent('anthropic_credentials_deleted');
    } catch {
      toast.error('Failed to remove API key');
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestConnection = async () => {
    setIsValidating(true);
    setKeyValidation(null);
    try {
      const { data, error } = await supabase.functions.invoke('anthropic-key-validate', {});
      
      if (error) {
        const parsed = parseApiError(error.message);
        setKeyValidation({ success: false, message: parsed.title });
        toast.error('Connection test failed', { description: parsed.message });
      } else if (data?.success) {
        setKeyValidation({ success: true, message: 'Connected!' });
        toast.success('Anthropic API key is valid');
        trackEvent('anthropic_connection_test_success');
      } else if (data?.error_code === 'ANTHROPIC_INVALID_KEY') {
        setKeyValidation({ success: false, message: 'Invalid key' });
        toast.error('Invalid API key', { 
          description: 'Please check your key at console.anthropic.com' 
        });
      } else if (data?.error_code === 'ANTHROPIC_NOT_CONFIGURED') {
        setKeyValidation({ success: false, message: 'Not configured' });
        toast.error('No API key configured', { description: 'Please add your Anthropic API key first.' });
      } else {
        const errorMsg = data?.error || 'Unknown error';
        const parsed = parseApiError(errorMsg);
        setKeyValidation({ success: false, message: parsed.title });
        toast.error('Connection test failed', { description: parsed.message });
      }
    } catch (err) {
      const parsed = parseApiError(err instanceof Error ? err.message : 'Unknown error');
      setKeyValidation({ success: false, message: parsed.title });
      toast.error('Connection test failed', { description: parsed.message });
    } finally {
      setIsValidating(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Connection Status Card */}
      <SettingCard label="Connection">
        <div className="flex items-center gap-3 mb-3">
          <Bot className="h-5 w-5 text-on-surface-variant" />
          <div className="flex-1">
            <h4 className="text-body-sm text-on-surface font-medium">
              {systemKeyActive ? 'System Key Active' : hasCredentials ? 'Configured' : 'Not Connected'}
            </h4>
            <p className="text-[10px] text-on-surface-variant">
              {systemKeyActive
                ? 'A system-wide key is configured by your administrator'
                : 'Claude AI - Anthropic\'s flagship models'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {keyValidation && (
              <span className={`text-[10px] flex items-center gap-1 ${keyValidation.success ? 'text-success' : 'text-destructive'}`}>
                {keyValidation.success ? <CheckCircle className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                {keyValidation.message}
              </span>
            )}
            {hasCredentials && !systemKeyActive && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={handleTestConnection}
                    disabled={isValidating}
                    className="w-8 h-8 flex items-center justify-center rounded-m3-full text-on-surface-variant hover:bg-on-surface/[0.08] disabled:opacity-50"
                  >
                    {isValidating ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                  </button>
                </TooltipTrigger>
                <TooltipContent className="text-[10px]">Test connection</TooltipContent>
              </Tooltip>
            )}
            {systemKeyActive ? (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary flex items-center gap-1">
                <ShieldCheck className="h-3 w-3" /> System
              </span>
            ) : hasCredentials ? (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-success/10 text-success">Active</span>
            ) : (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-warning/10 text-warning">Not Set</span>
            )}
          </div>
        </div>
      </SettingCard>

      {/* Credentials Card - hidden when system key is active */}
      {!systemKeyActive && (
        <SettingCard label="API Key">
          <div className="flex items-center gap-3 mb-3">
            <Key className="h-5 w-5 text-on-surface-variant" />
            <div className="flex-1">
              <h4 className="text-body-sm text-on-surface font-medium">
                {hasCredentials ? 'API Key Configured' : 'Add API Key'}
              </h4>
              <p className="text-[10px] text-on-surface-variant">
                {hasCredentials 
                  ? 'Your Anthropic API key is stored securely' 
                  : 'Get your API key from console.anthropic.com'}
              </p>
            </div>
          </div>
          
          <div className="space-y-3">
            <SettingRow label="API Key" description="Your Anthropic API key">
              <div className="flex items-center gap-2">
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder={hasCredentials ? "••••••••" : "sk-ant-..."}
                  autoComplete="off"
                  className="h-8 w-48 px-2 bg-surface-container rounded-m3-sm border border-outline-variant text-body-sm text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </SettingRow>
            
            <div className="flex items-center justify-between pt-2">
              <a 
                href="https://console.anthropic.com/settings/keys" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-[10px] text-primary hover:underline flex items-center gap-1"
              >
                Get API Key <ExternalLink className="h-3 w-3" />
              </a>
              <div className="flex items-center gap-2">
                {hasCredentials && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={handleDeleteCredentials}
                        disabled={isSaving || isCredLoading}
                        className="w-8 h-8 flex items-center justify-center rounded-m3-full text-on-surface-variant hover:bg-on-surface/[0.08] hover:text-destructive disabled:opacity-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent className="text-[10px]">Remove API key</TooltipContent>
                  </Tooltip>
                )}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={handleSaveCredentials}
                      disabled={isSaving || isCredLoading || !apiKey.trim()}
                      className="w-8 h-8 flex items-center justify-center rounded-m3-full text-primary hover:bg-on-surface/[0.08] disabled:opacity-50"
                    >
                      {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent className="text-[10px]">Save API key</TooltipContent>
                </Tooltip>
              </div>
            </div>
          </div>
        </SettingCard>
      )}

      {/* Info Card */}
      <SettingCard label="About Claude">
        <div className="space-y-2 text-[10px] text-on-surface-variant">
          <p>
            Claude is Anthropic's AI assistant, known for being helpful, harmless, and honest.
            Claude models excel at analysis, writing, coding, and reasoning tasks.
          </p>
          <p>
            Your API key is encrypted and stored securely. It is never exposed to the frontend.
          </p>
          <a 
            href="https://docs.anthropic.com/en/docs/intro-to-claude" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-primary hover:underline flex items-center gap-1 mt-2"
          >
            Learn more about Claude <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </SettingCard>
    </div>
  );
};

export default AnthropicIntegrationSettings;
