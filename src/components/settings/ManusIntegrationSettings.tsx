import { useState, useEffect } from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { SettingCard } from "@/components/ui/setting-card";
import { SettingRow } from "@/components/ui/setting-row";
import { SettingDivider } from "@/components/ui/setting-divider";
import { useUserCredentials } from "@/hooks/useUserCredentials";
import { toast } from "@/components/ui/sonner";
import { toast as sonnerToast } from "sonner";
import { parseApiError } from "@/utils/apiErrorUtils";
import { trackEvent } from '@/lib/posthog';
import { 
  Save, Trash2, ExternalLink, Loader2, 
  Zap, Key, Bot, CheckCircle, XCircle
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const ManusIntegrationSettings = () => {
  const { 
    getCredentialStatus, 
    setCredential, 
    deleteCredential,
    isServiceConfigured,
    isLoading: isCredLoading 
  } = useUserCredentials();
  
  const [apiKey, setApiKey] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState(null);
  const [keyValidation, setKeyValidation] = useState(null);
  const [isWebhookRegistered, setIsWebhookRegistered] = useState(false);
  
  const hasCredentials = isServiceConfigured('manus');

  // Fetch credential status on mount
  useEffect(() => {
    getCredentialStatus('manus');
  }, [getCredentialStatus]);

  const handleSaveCredentials = async () => {
    const trimmedKey = apiKey.trim();
    if (!trimmedKey) {
      toast.error('API key is required');
      return;
    }
    setIsSaving(true);
    try {
      // Save trimmed key to prevent whitespace/newline issues
      await setCredential('manus', 'api_key', trimmedKey);
      toast.success('Manus API key saved securely');
      setApiKey('');
      setConnectionStatus(null); // Reset status after saving new key
      await getCredentialStatus('manus');
      trackEvent('manus_credentials_saved');
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
      await deleteCredential('manus', 'api_key');
      toast.success('Manus API key removed');
      setConnectionStatus(null);
      setKeyValidation(null);
      setIsWebhookRegistered(false);
      await getCredentialStatus('manus');
      trackEvent('manus_credentials_deleted');
    } catch (error) {
      toast.error('Failed to remove API key');
    } finally {
      setIsSaving(false);
    }
  };

  // Test connection by validating API key with Manus
  const handleTestConnection = async () => {
    setIsValidating(true);
    setKeyValidation(null);
    try {
      const { data, error } = await supabase.functions.invoke('manus-key-validate', {});
      
      if (error) {
        const parsed = parseApiError(error.message);
        setKeyValidation({ success: false, message: parsed.title });
        toast.error('Connection test failed', { description: parsed.message });
      } else if (data?.manus_ok) {
        setKeyValidation({ 
          success: true, 
          message: 'Connected!',
          fingerprint: data.fingerprint,
          projectCount: data.project_count
        });
        toast.success('Manus API key is valid', { 
          description: data.project_count > 0 ? `${data.project_count} project(s) found` : undefined 
        });
        trackEvent('manus_connection_test_success');
      } else if (data?.error_code === 'MANUS_INVALID_KEY') {
        setKeyValidation({ success: false, message: 'Invalid key' });
        toast.error('Invalid API key', { 
          description: 'Manus rejected the configured key. Please generate a new key from manus.ai.' 
        });
        trackEvent('manus_connection_test_failed', { error_code: 'MANUS_INVALID_KEY' });
      } else if (data?.error_code === 'MANUS_NOT_CONFIGURED') {
        setKeyValidation({ success: false, message: 'Not configured' });
        toast.error('No API key configured', { description: 'Please add your Manus API key first.' });
      } else {
        const errorMsg = data?.error || 'Unknown error';
        const parsed = parseApiError(errorMsg);
        setKeyValidation({ success: false, message: parsed.title });
        toast.error('Connection test failed', { description: parsed.message });
      }
    } catch (err) {
      const parsed = parseApiError(err.message);
      setKeyValidation({ success: false, message: parsed.title });
      toast.error('Connection test failed', { description: parsed.message });
    } finally {
      setIsValidating(false);
    }
  };

  const handleRegisterWebhook = async () => {
    setIsTesting(true);
    setConnectionStatus(null);
    try {
      const { data, error } = await supabase.functions.invoke('manus-webhook-register', {});
      
      if (error) {
        const parsed = parseApiError(error.message);
        setConnectionStatus({ success: false, message: parsed.title });
        toast.error(parsed.title, { description: parsed.message });
        sonnerToast.error(parsed.title, { description: parsed.message });
      } else if (data?.error) {
        // Edge function returned an error in the response body (string or object)
        const errorMsg = typeof data.error === 'string' 
          ? data.error 
          : data.error?.message || JSON.stringify(data.error);
        const parsed = parseApiError(errorMsg);
        setConnectionStatus({ success: false, message: parsed.title });
        toast.error(parsed.title, { description: parsed.message });
        sonnerToast.error(parsed.title, { description: parsed.message });
      } else if (data?.message && !data?.success) {
        // Some edge functions return { message: "error" } format
        const parsed = parseApiError(data.message);
        setConnectionStatus({ success: false, message: parsed.title });
        toast.error(parsed.title, { description: parsed.message });
        sonnerToast.error(parsed.title, { description: parsed.message });
      } else if (data?.success) {
        setConnectionStatus({ success: true, message: 'Connected!' });
        setIsWebhookRegistered(true);
        toast.success('Webhook registered successfully');
        sonnerToast.success('Webhook registered successfully');
        trackEvent('manus_webhook_registered');
      } else {
        const errorMsg = 'Manus registration failed';
        const parsed = parseApiError(errorMsg);
        setConnectionStatus({ success: false, message: parsed.title });
        toast.error(parsed.title, { description: parsed.message });
        sonnerToast.error(parsed.title, { description: parsed.message });
      }
    } catch (err) {
      const parsed = parseApiError(err.message);
      setConnectionStatus({ success: false, message: parsed.title });
      toast.error(parsed.title, { description: parsed.message });
      sonnerToast.error(parsed.title, { description: parsed.message });
    } finally {
      setIsTesting(false);
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
              {hasCredentials ? 'Configured' : 'Not Connected'}
            </h4>
            <p className="text-[10px] text-on-surface-variant">
              Manus AI - Agentic task automation
            </p>
          </div>
          <div className="flex items-center gap-2">
            {keyValidation && (
              <span className={`text-[10px] flex items-center gap-1 ${keyValidation.success ? 'text-green-600' : 'text-red-500'}`}>
                {keyValidation.success ? <CheckCircle className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                {keyValidation.message}
              </span>
            )}
            {hasCredentials && (
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
            {hasCredentials ? (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-500/10 text-green-600">Active</span>
            ) : (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600">Not Set</span>
            )}
          </div>
        </div>
      </SettingCard>

      {/* Credentials Card */}
      <SettingCard label="API Key">
        <div className="flex items-center gap-3 mb-3">
          <Key className="h-5 w-5 text-on-surface-variant" />
          <div className="flex-1">
            <h4 className="text-body-sm text-on-surface font-medium">
              {hasCredentials ? 'API Key Configured' : 'Add API Key'}
            </h4>
            <p className="text-[10px] text-on-surface-variant">
              {hasCredentials 
                ? 'Your Manus API key is stored securely' 
                : 'Get your API key from manus.ai dashboard'}
            </p>
          </div>
        </div>
        
        <div className="space-y-3">
          <SettingRow label="API Key" description="Your Manus API key">
            <div className="flex items-center gap-2">
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={hasCredentials ? "••••••••" : "Enter API key"}
                autoComplete="off"
                className="h-8 w-48 px-2 bg-surface-container rounded-m3-sm border border-outline-variant text-body-sm text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </SettingRow>
          
          <div className="flex items-center justify-between pt-2">
            <a 
              href="https://manus.ai/dashboard" 
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

      {/* Webhook Registration Card */}
      {hasCredentials && (
        <SettingCard label="Webhook">
          <SettingRow 
            label="Register Webhook" 
            description="Enable real-time task updates from Manus"
          >
            <div className="flex items-center gap-2">
              {connectionStatus && (
                <span className={`text-[10px] ${connectionStatus.success ? 'text-green-600' : 'text-red-500'}`}>
                  {connectionStatus.message}
                </span>
              )}
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={handleRegisterWebhook}
                    disabled={isTesting}
                    className="w-8 h-8 flex items-center justify-center rounded-m3-full text-on-surface-variant hover:bg-on-surface/[0.08] disabled:opacity-50"
                  >
                    {isTesting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
                  </button>
                </TooltipTrigger>
                <TooltipContent className="text-[10px]">Register Webhook</TooltipContent>
              </Tooltip>
            </div>
          </SettingRow>
          
          <SettingDivider />
          
          <div className="px-1 py-2">
            <p className="text-[10px] text-on-surface-variant">
              After registering the webhook, Manus will send real-time updates when tasks complete. 
              You only need to do this once per API key.
            </p>
          </div>
        </SettingCard>
      )}

      {/* Info Card */}
      <SettingCard label="About Manus">
        <div className="space-y-2 text-[10px] text-on-surface-variant">
          <p>
            Manus is an agentic AI that can autonomously complete complex tasks like research, 
            data analysis, and content creation.
          </p>
          <p>
            When you select a Manus model for a prompt, the task will be sent to Manus and 
            you'll receive the results via webhook when complete.
          </p>
          <a 
            href="https://manus.ai/docs" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-primary hover:underline flex items-center gap-1 mt-2"
          >
            Learn more about Manus <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </SettingCard>
    </div>
  );
};

export default ManusIntegrationSettings;
