import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Hook for managing user credentials via the credentials-manager edge function.
 * Credentials are encrypted at rest and never returned to the frontend.
 * Only status (configured/not configured) is exposed.
 */
export const useUserCredentials = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [credentialStatus, setCredentialStatus] = useState({});
  const [configuredServices, setConfiguredServices] = useState([]);

  /**
   * Invoke the credentials-manager edge function
   */
  const invokeCredentialsManager = useCallback(async (action, params = {}) => {
    const { data, error } = await supabase.functions.invoke('credentials-manager', {
      body: { action, ...params }
    });

    if (error) {
      console.error('[useUserCredentials] Edge function error:', error);
      throw error;
    }

    if (data?.error) {
      console.error('[useUserCredentials] API error:', data.error);
      throw new Error(data.error);
    }

    return data;
  }, []);

  /**
   * Get the configuration status for a service (e.g., 'confluence')
   * Returns an object like { email: true, api_token: false }
   */
  const getCredentialStatus = useCallback(async (service) => {
    setIsLoading(true);
    try {
      const data = await invokeCredentialsManager('get_status', { service });
      const status = data?.status || {};
      setCredentialStatus(prev => ({ ...prev, [service]: status }));
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
  const setCredential = useCallback(async (service, key, value) => {
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
  const deleteCredential = useCallback(async (service, key = null) => {
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
  const listConfiguredServices = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await invokeCredentialsManager('list_services');
      const services = data?.services || [];
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
  const refreshStatus = useCallback(async (service) => {
    return getCredentialStatus(service);
  }, [getCredentialStatus]);

  /**
   * Check if a service is fully configured
   * For Confluence: both email and api_token must be set
   * For Gemini/Google: api_key must be set
   * For Manus: api_key must be set
   */
  const isServiceConfigured = useCallback((service) => {
    const status = credentialStatus[service];
    if (!status) return false;

    if (service === 'confluence') {
      return status.email === true && status.api_token === true;
    }

    if (service === 'gemini' || service === 'google') {
      return status.api_key === true;
    }

  if (service === 'manus') {
    return status.api_key === true;
  }

  if (service === 'openai') {
    return status.api_key === true;
  }

  if (service === 'anthropic') {
    return status.api_key === true;
  }

  if (service === 'figma') {
    return status.access_token === true;
  }

  // For other services, check if any key is configured
  return Object.values(status).some(v => v === true);
  }, [credentialStatus]);

  return {
    isLoading,
    credentialStatus,
    configuredServices,
    getCredentialStatus,
    setCredential,
    deleteCredential,
    listConfiguredServices,
    refreshStatus,
    isServiceConfigured
  };
};

export default useUserCredentials;
