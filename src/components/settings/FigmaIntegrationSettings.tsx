/**
 * Figma Integration Settings Component
 * Manages Figma personal access token configuration
 */

import { useState, useEffect } from 'react';
import { Figma, Trash2, Loader2, ExternalLink, Zap, ShieldCheck } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { SettingCard } from '@/components/ui/setting-card';
import { SettingRow } from '@/components/ui/setting-row';
import { useUserCredentials } from '@/hooks/useUserCredentials';
import { useFigmaFiles } from '@/hooks/useFigmaFiles';
import { toast } from '@/components/ui/sonner';
import { trackEvent } from '@/lib/posthog';

const FigmaIntegrationSettings: React.FC = () => {
  const { 
    credentialStatus, 
    getCredentialStatus, 
    setCredential, 
    deleteCredential,
    isSystemKeyActive,
    isLoading: isCredLoading 
  } = useUserCredentials();
  const { testConnection, connectionStatus } = useFigmaFiles();
  
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [accessToken, setAccessToken] = useState('');

  useEffect(() => {
    getCredentialStatus('figma');
  }, [getCredentialStatus]);

  const figmaStatus = credentialStatus['figma'] || {};
  const isConfigured = figmaStatus.access_token === true;
  const systemKeyActive = isSystemKeyActive('figma');

  const handleSaveToken = async () => {
    if (!accessToken.trim()) {
      toast.error('Please enter an access token');
      return;
    }
    if (!accessToken.trim().startsWith('figd_')) {
      toast.error('Invalid token format', {
        description: 'Figma personal access tokens should start with "figd_"'
      });
      return;
    }
    setIsSaving(true);
    try {
      await setCredential('figma', 'access_token', accessToken.trim());
      setAccessToken('');
      toast.success('Figma access token saved');
      trackEvent('figma_access_token_saved');
    } catch {
      toast.error('Failed to save access token');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteToken = async () => {
    setIsSaving(true);
    try {
      await deleteCredential('figma', 'access_token');
      toast.success('Figma access token removed');
      trackEvent('figma_access_token_deleted');
    } catch {
      toast.error('Failed to remove access token');
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    try {
      await testConnection();
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Status Card */}
      <SettingCard label="Connection">
        <div className="flex items-center gap-3 mb-3">
          <Figma className="h-5 w-5 text-on-surface-variant" />
          <div className="flex-1">
            <h4 className="text-body-sm text-on-surface font-medium">
              {systemKeyActive ? 'System Key Active' : isConfigured ? 'Connected' : 'Not Connected'}
            </h4>
            <p className="text-[10px] text-on-surface-variant">
              {systemKeyActive
                ? 'A system-wide key is configured by your administrator'
                : isConfigured 
                  ? 'Your access token is securely stored' 
                  : 'Add your Figma personal access token to attach design files'}
            </p>
          </div>
          {systemKeyActive ? (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary flex items-center gap-1">
              <ShieldCheck className="h-3 w-3" /> System
            </span>
          ) : isConfigured ? (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-success/10 text-success">Active</span>
          ) : (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-warning/10 text-warning">Not Set</span>
          )}
        </div>
        
        {/* Test Connection Button */}
        {(isConfigured || systemKeyActive) && !systemKeyActive && (
          <div className="pt-2 border-t border-outline-variant">
            <button
              onClick={handleTestConnection}
              disabled={isTesting}
              className="flex items-center gap-2 text-[10px] text-primary hover:underline disabled:opacity-50"
            >
              {isTesting ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Zap className="h-3 w-3" />
              )}
              Test Connection
            </button>
          </div>
        )}
      </SettingCard>

      {/* Access Token Card - hidden when system key is active */}
      {!systemKeyActive && (
        <SettingCard label="Access Token">
          <div className="space-y-3">
            <SettingRow 
              label="Personal Access Token" 
              description={isConfigured ? "Token is securely stored" : "Required for accessing Figma files"}
            >
              {isConfigured ? (
                <div className="flex items-center gap-2">
                  <span className="text-body-sm text-on-surface font-mono">figd_••••••••••••</span>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={handleDeleteToken}
                        disabled={isSaving || isCredLoading}
                        className="w-8 h-8 flex items-center justify-center rounded-m3-full text-on-surface-variant hover:bg-on-surface/[0.08] hover:text-destructive disabled:opacity-50"
                      >
                        {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent className="text-[10px]">Remove Access Token</TooltipContent>
                  </Tooltip>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <input
                    type="password"
                    value={accessToken}
                    onChange={(e) => setAccessToken(e.target.value)}
                    placeholder="figd_..."
                    autoComplete="off"
                    className="h-8 w-48 px-2 bg-surface-container rounded-m3-sm border border-outline-variant text-body-sm text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={handleSaveToken}
                        disabled={isSaving || isCredLoading || !accessToken.trim()}
                        className="w-8 h-8 flex items-center justify-center rounded-m3-full text-on-surface-variant hover:bg-primary/10 hover:text-primary disabled:opacity-50"
                      >
                        {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Figma className="h-4 w-4" />}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent className="text-[10px]">Save Access Token</TooltipContent>
                  </Tooltip>
                </div>
              )}
            </SettingRow>

            <div className="pt-2 border-t border-outline-variant">
              <a
                href="https://www.figma.com/developers/api#access-tokens"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-[10px] text-primary hover:underline"
              >
                <ExternalLink className="h-3 w-3" />
                Get a personal access token from Figma
              </a>
            </div>
          </div>
        </SettingCard>
      )}

      {/* Info Card */}
      <SettingCard label="About">
        <div className="space-y-2">
          <p className="text-body-sm text-on-surface-variant">
            The Figma personal access token allows you to attach Figma design files to your prompts 
            and access file metadata through the AI chat interface.
          </p>
          <p className="text-[10px] text-on-surface-variant">
            Your access token is encrypted and stored securely. It is never exposed to the frontend.
          </p>
        </div>
      </SettingCard>
    </div>
  );
};

export default FigmaIntegrationSettings;
