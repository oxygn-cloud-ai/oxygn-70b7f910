import React, { useState, useEffect } from 'react';
import { Key, Trash2, Loader2, Save, Figma, Bot, Sparkles, FileText, Cpu } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { SettingCard } from '@/components/ui/setting-card';
import { SettingRow } from '@/components/ui/setting-row';
import { SettingDivider } from '@/components/ui/setting-divider';
import { useUserCredentials } from '@/hooks/useUserCredentials';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/components/ui/sonner';
import { trackEvent } from '@/lib/posthog';

interface ServiceConfig {
  service: string;
  label: string;
  icon: React.ElementType;
  keys: { key: string; label: string; placeholder: string }[];
}

const SERVICES: ServiceConfig[] = [
  {
    service: 'openai',
    label: 'OpenAI',
    icon: Key,
    keys: [{ key: 'api_key', label: 'API Key', placeholder: 'sk-...' }],
  },
  {
    service: 'anthropic',
    label: 'Anthropic',
    icon: Bot,
    keys: [{ key: 'api_key', label: 'API Key', placeholder: 'sk-ant-...' }],
  },
  {
    service: 'gemini',
    label: 'Google Gemini',
    icon: Sparkles,
    keys: [{ key: 'api_key', label: 'API Key', placeholder: 'Enter API key...' }],
  },
  {
    service: 'manus',
    label: 'Manus AI',
    icon: Cpu,
    keys: [{ key: 'api_key', label: 'API Key', placeholder: 'Enter API key...' }],
  },
  {
    service: 'figma',
    label: 'Figma',
    icon: Figma,
    keys: [{ key: 'access_token', label: 'Access Token', placeholder: 'figd_...' }],
  },
  {
    service: 'confluence',
    label: 'Confluence',
    icon: FileText,
    keys: [
      { key: 'email', label: 'Email', placeholder: 'user@example.com' },
      { key: 'api_token', label: 'API Token', placeholder: 'Enter token...' },
    ],
  },
];

const SystemApiKeysSection: React.FC = () => {
  const { isAdmin } = useAuth();
  const {
    systemCredentialStatus,
    getSystemCredentialStatus,
    setSystemCredential,
    deleteSystemCredential,
    isLoading,
  } = useUserCredentials();

  const [inputValues, setInputValues] = useState<Record<string, Record<string, string>>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);

  // Load system credential status for all services on mount
  useEffect(() => {
    SERVICES.forEach(svc => {
      getSystemCredentialStatus(svc.service);
    });
  }, [getSystemCredentialStatus]);

  if (!isAdmin) {
    return (
      <div className="p-4 text-body-sm text-on-surface-variant">
        Admin access required to manage system API keys.
      </div>
    );
  }

  const handleSave = async (service: string, key: string) => {
    const value = inputValues[service]?.[key]?.trim();
    if (!value) {
      toast.error('Please enter a value');
      return;
    }
    const saveId = `${service}.${key}`;
    setSavingKey(saveId);
    try {
      await setSystemCredential(service, key, value);
      setInputValues(prev => ({
        ...prev,
        [service]: { ...prev[service], [key]: '' },
      }));
      toast.success(`System ${service} ${key} saved`);
      trackEvent('system_credential_saved', { service, key });
    } catch (error) {
      toast.error('Failed to save system credential');
    } finally {
      setSavingKey(null);
    }
  };

  const handleDelete = async (service: string, key: string) => {
    const saveId = `${service}.${key}`;
    setSavingKey(saveId);
    try {
      await deleteSystemCredential(service, key);
      toast.success(`System ${service} ${key} removed`);
      trackEvent('system_credential_deleted', { service, key });
    } catch (error) {
      toast.error('Failed to remove system credential');
    } finally {
      setSavingKey(null);
    }
  };

  const setInput = (service: string, key: string, value: string) => {
    setInputValues(prev => ({
      ...prev,
      [service]: { ...prev[service], [key]: value },
    }));
  };

  return (
    <div className="space-y-4">
      <SettingCard label="About">
        <p className="text-body-sm text-on-surface-variant">
          System API keys are used by all users in the workspace. When a system key is set,
          individual users do not need to configure their own keys for that service.
        </p>
        <p className="text-[10px] text-on-surface-variant mt-1">
          All keys are encrypted at rest and never exposed to the frontend.
        </p>
      </SettingCard>

      {SERVICES.map(svc => {
        const Icon = svc.icon;
        const svcStatus = systemCredentialStatus[svc.service] || {};

        return (
          <SettingCard key={svc.service} label={svc.label}>
            <div className="flex items-center gap-3 mb-3">
              <Icon className="h-5 w-5 text-on-surface-variant" />
            </div>

            <div className="space-y-3">
              {svc.keys.map((keyConfig, idx) => {
                const isConfigured = svcStatus[keyConfig.key] === true;
                const isBusy = savingKey === `${svc.service}.${keyConfig.key}`;
                const inputVal = inputValues[svc.service]?.[keyConfig.key] || '';

                return (
                  <React.Fragment key={keyConfig.key}>
                    {idx > 0 && <SettingDivider />}
                    <SettingRow
                      label={keyConfig.label}
                      description={isConfigured ? 'System key is set' : 'Not configured'}
                    >
                      {isConfigured ? (
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-500/10 text-green-500">
                            Active
                          </span>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                onClick={() => handleDelete(svc.service, keyConfig.key)}
                                disabled={isBusy || isLoading}
                                className="w-8 h-8 flex items-center justify-center rounded-m3-full text-on-surface-variant hover:bg-on-surface/[0.08] hover:text-destructive disabled:opacity-50"
                              >
                                {isBusy ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Trash2 className="h-4 w-4" />
                                )}
                              </button>
                            </TooltipTrigger>
                            <TooltipContent className="text-[10px]">Remove system key</TooltipContent>
                          </Tooltip>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <input
                            type="password"
                            value={inputVal}
                            onChange={e => setInput(svc.service, keyConfig.key, e.target.value)}
                            placeholder={keyConfig.placeholder}
                            autoComplete="off"
                            className="h-8 w-48 px-2 bg-surface-container rounded-m3-sm border border-outline-variant text-body-sm text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-1 focus:ring-primary"
                          />
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                onClick={() => handleSave(svc.service, keyConfig.key)}
                                disabled={isBusy || isLoading || !inputVal.trim()}
                                className="w-8 h-8 flex items-center justify-center rounded-m3-full text-on-surface-variant hover:bg-primary/10 hover:text-primary disabled:opacity-50"
                              >
                                {isBusy ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Save className="h-4 w-4" />
                                )}
                              </button>
                            </TooltipTrigger>
                            <TooltipContent className="text-[10px]">Save system key</TooltipContent>
                          </Tooltip>
                        </div>
                      )}
                    </SettingRow>
                  </React.Fragment>
                );
              })}
            </div>
          </SettingCard>
        );
      })}
    </div>
  );
};

export default SystemApiKeysSection;
