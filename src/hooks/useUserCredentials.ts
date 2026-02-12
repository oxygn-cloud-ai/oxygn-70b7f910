// @ts-nocheck
import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Per-service credential status: maps credential_key -> boolean
 */
type ServiceStatus = Record<string, boolean>;

/**
 * Map of service names to their credential status
 */
type CredentialStatusMap = Record<string, ServiceStatus>;

/**
 * Map of service names to their system credential status
 */
type SystemCredentialStatusMap = Record<string, ServiceStatus>;

/**
 * Response shape from get_status action
 */
interface GetStatusResponse {
  success?: boolean;
  status?: ServiceStatus;
  systemConfigured?: boolean;
  error?: string;
}

/**
 * Response shape from get_system_status action
 */
interface GetSystemStatusResponse {
  success?: boolean;
  status?: ServiceStatus;
  error?: string;
}

/**
 * Hook for managing user and system credentials via the credentials-manager edge function.
 * Credentials are encrypted at rest and never returned to the frontend.
 * Only status (configured/not configured) is exposed.
 */
export const useUserCredentials = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [credentialStatus, setCredentialStatus] = useState<CredentialStatusMap>({});
  const [systemCredentialStatus, setSystemCredentialStatus] = useState<SystemCredentialStatusMap>({});
  const [configuredServices, setConfiguredServices] = useState<string[]>([]);
  // Tracks whether a system key exists per service (from get_status response)
  const [systemConfiguredMap, setSystemConfiguredMap] = useState<Record<string, boolean>>({});

  /**
   * Invoke the credentials-manager edge function
   */
  const invokeCredentialsManager = useCallback(async (action: string, params: Record<string, unknown> = {}): Promise<Record<string, unknown>> => {
    const { data, error } = await supabase.functions.invoke('credentials-manager', {
      body: { action, ...params }
    });

    if (error) {
      console.error('[useUserCredentials] Edge function error:', error);
      throw error;
    }

    if (data?.error) {
      console.error('[useUserCredentials] API error:', data.error);
      throw new Error(data.error as string);
    }

    return data as Record<string, unknown>;
  }, []);

  /**
   * Get the configuration status for a service (e.g., 'confluence')
   * Returns an object like { email: true, api_token: false }
   * Also sets systemConfiguredMap for this service
   */
  const getCredentialStatus = useCallback(async (service: string): Promise<ServiceStatus> => {
    setIsLoading(true);
    try {
      const data = await invokeCredentialsManager('get_status', { service }) as GetStatusResponse;
      const status = data?.status || {};
      const systemConfigured = data?.systemConfigured === true;
      setCredentialStatus(prev => ({ ...prev, [service]: status }));
      setSystemConfiguredMap(prev => ({ ...prev, [service]: systemConfigured }));
      return status;
    } catch (error) {
      console.error('[useUserCredentials] Failed to get credential status:', error);
      return {};
    } finally {
      setIsLoading(false);
    }
  }, [invokeCredentialsManager]);

  /**
   * Set a credential for a service (will be encrypted server-side)
   */
  const setCredential = useCallback(async (service: string, key: string, value: string): Promise<boolean> => {
    setIsLoading(true);
    try {
      await invokeCredentialsManager('set', { service, key, value });
      // Refresh status after setting
      await getCredentialStatus(service);
      return true;
    } catch (error) {
      console.error('[useUserCredentials] Failed to set credential:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [invokeCredentialsManager, getCredentialStatus]);

  /**
   * Delete a credential (or all credentials for a service if key is omitted)
   */
  const deleteCredential = useCallback(async (service: string, key: string | null = null): Promise<boolean> => {
    setIsLoading(true);
    try {
      await invokeCredentialsManager('delete', { service, key });
      // Refresh status after deleting
      await getCredentialStatus(service);
      return true;
    } catch (error) {
      console.error('[useUserCredentials] Failed to delete credential:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [invokeCredentialsManager, getCredentialStatus]);

  /**
   * List all services that have configured credentials
   */
  const listConfiguredServices = useCallback(async (): Promise<string[]> => {
    setIsLoading(true);
    try {
      const data = await invokeCredentialsManager('list_services');
      const services = (data?.services as string[]) || [];
      setConfiguredServices(services);
      return services;
    } catch (error) {
      console.error('[useUserCredentials] Failed to list services:', error);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, [invokeCredentialsManager]);

  /**
   * Refresh status for a specific service
   */
  const refreshStatus = useCallback(async (service: string): Promise<ServiceStatus> => {
    return getCredentialStatus(service);
  }, [getCredentialStatus]);

  /**
   * Check if a service is fully configured (user OR system key)
   */
  const isServiceConfigured = useCallback((service: string): boolean => {
    // If system key is configured, service is available
    if (systemConfiguredMap[service]) return true;

    const status = credentialStatus[service];
    if (!status) return false;

    if (service === 'confluence') {
      return status.email === true && status.api_token === true;
    }

    if (service === 'figma') {
      return status.access_token === true;
    }

    // All others use api_key
    if (service === 'gemini' || service === 'google' || service === 'manus' ||
        service === 'openai' || service === 'anthropic') {
      return status.api_key === true;
    }

    // For other services, check if any key is configured
    return Object.values(status).some(v => v === true);
  }, [credentialStatus, systemConfiguredMap]);

  /**
   * Check if a system key is configured for a service
   */
  const isSystemKeyActive = useCallback((service: string): boolean => {
    return systemConfiguredMap[service] === true;
  }, [systemConfiguredMap]);

  // ====== System credential methods (admin-only) ======

  /**
   * Get system credential status for a service
   */
  const getSystemCredentialStatus = useCallback(async (service: string): Promise<ServiceStatus> => {
    setIsLoading(true);
    try {
      const data = await invokeCredentialsManager('get_system_status', { service }) as GetSystemStatusResponse;
      const status = data?.status || {};
      setSystemCredentialStatus(prev => ({ ...prev, [service]: status }));
      return status;
    } catch (error) {
      console.error('[useUserCredentials] Failed to get system credential status:', error);
      return {};
    } finally {
      setIsLoading(false);
    }
  }, [invokeCredentialsManager]);

  /**
   * Set a system-wide credential (admin only)
   */
  const setSystemCredential = useCallback(async (service: string, key: string, value: string): Promise<boolean> => {
    setIsLoading(true);
    try {
      await invokeCredentialsManager('set_system', { service, key, value });
      await getSystemCredentialStatus(service);
      return true;
    } catch (error) {
      console.error('[useUserCredentials] Failed to set system credential:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [invokeCredentialsManager, getSystemCredentialStatus]);

  /**
   * Delete a system-wide credential (admin only)
   */
  const deleteSystemCredential = useCallback(async (service: string, key?: string): Promise<boolean> => {
    setIsLoading(true);
    try {
      await invokeCredentialsManager('delete_system', { service, key: key ?? null });
      await getSystemCredentialStatus(service);
      return true;
    } catch (error) {
      console.error('[useUserCredentials] Failed to delete system credential:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [invokeCredentialsManager, getSystemCredentialStatus]);

  return {
    isLoading,
    credentialStatus,
    systemCredentialStatus,
    configuredServices,
    getCredentialStatus,
    setCredential,
    deleteCredential,
    listConfiguredServices,
    refreshStatus,
    isServiceConfigured,
    isSystemKeyActive,
    getSystemCredentialStatus,
    setSystemCredential,
    deleteSystemCredential,
  };
};

export default useUserCredentials;
