import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/** Health status for a single assistant */
export interface AssistantHealth {
  assistant_row_id: string;
  assistant_name: string;
  prompt_name: string;
  status: 'healthy' | 'degraded' | 'broken' | 'not_configured';
  vector_store: {
    status: 'exists' | 'missing' | 'not_configured';
    id?: string;
    error?: string;
  };
  files: {
    total_in_db: number;
    healthy: number;
    missing_openai: number;
    missing_storage: number;
    details: Array<{
      row_id: string;
      original_filename: string;
      openai_file_id: string | null;
      storage_path: string;
      status: 'healthy' | 'missing_openai' | 'missing_storage' | 'orphaned';
      error?: string;
    }>;
  };
  errors: string[];
}

/** Response from resource-health edge function */
interface HealthResponse {
  status?: 'not_configured';
  message?: string;
  assistants?: AssistantHealth[];
  error?: string;
}

interface CacheEntry {
  data: AssistantHealth;
  timestamp: number;
}

/** Type guard to validate AssistantHealth response structure */
function isAssistantHealth(data: unknown): data is AssistantHealth {
  if (!data || typeof data !== 'object') return false;
  const obj = data as Record<string, unknown>;
  return (
    typeof obj.assistant_row_id === 'string' &&
    typeof obj.status === 'string' &&
    ['healthy', 'degraded', 'broken', 'not_configured'].includes(obj.status as string)
  );
}

interface UseResourceHealthReturn {
  health: AssistantHealth | null;
  isChecking: boolean;
  isRepairing: boolean;
  error: string | null;
  checkHealth: (forceRefresh?: boolean) => Promise<AssistantHealth | null>;
  repair: () => Promise<unknown>;
  invalidateCache: () => void;
}

/**
 * Hook for checking and repairing OpenAI resource health for an assistant
 */
export const useResourceHealth = (assistantRowId: string | null): UseResourceHealthReturn => {
  const [health, setHealth] = useState<AssistantHealth | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [isRepairing, setIsRepairing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cacheRef = useRef<Record<string, CacheEntry>>({});

  // Check if cached result is still valid
  const getCachedHealth = useCallback((id: string): AssistantHealth | null => {
    const cached = cacheRef.current[id];
    if (!cached) return null;
    if (Date.now() - cached.timestamp > CACHE_TTL_MS) {
      delete cacheRef.current[id];
      return null;
    }
    return cached.data;
  }, []);

  // Store result in cache
  const setCachedHealth = useCallback((id: string, data: AssistantHealth): void => {
    cacheRef.current[id] = {
      data,
      timestamp: Date.now(),
    };
  }, []);

  // Invalidate cache for an assistant
  const invalidateCache = useCallback((id: string): void => {
    delete cacheRef.current[id];
  }, []);

  // Check health of a single assistant
  const checkHealth = useCallback(async (forceRefresh = false): Promise<AssistantHealth | null> => {
    if (!assistantRowId) return null;

    // Return cached result if available and not forcing refresh
    if (!forceRefresh) {
      const cached = getCachedHealth(assistantRowId);
      if (cached) {
        setHealth(cached);
        return cached;
      }
    }

    setIsChecking(true);
    setError(null);

    try {
      const { data, error: invokeError } = await supabase.functions.invoke<HealthResponse>('resource-health', {
        body: {
          action: 'check_assistant',
          assistant_row_id: assistantRowId,
        },
      });

      if (invokeError) {
        throw new Error(invokeError.message);
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      // Handle graceful "not_configured" status - not an error, just unavailable
      if (data?.status === 'not_configured') {
        const notConfiguredHealth: AssistantHealth = {
          assistant_row_id: assistantRowId,
          assistant_name: 'Unknown',
          prompt_name: 'Unknown',
          status: 'not_configured',
          vector_store: { status: 'not_configured' },
          files: { total_in_db: 0, healthy: 0, missing_openai: 0, missing_storage: 0, details: [] },
          errors: [],
        };
        setHealth(notConfiguredHealth);
        // Don't cache not_configured so it re-checks after key is added
        return notConfiguredHealth;
      }

      // Normal health response - validate structure before assignment
      if (isAssistantHealth(data)) {
        setHealth(data);
        setCachedHealth(assistantRowId, data);
        return data;
      } else {
        console.error('[useResourceHealth] Invalid response structure:', data);
        throw new Error('Invalid health check response');
      }
    } catch (err) {
      console.error('[useResourceHealth] Check error:', err);
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      return null;
    } finally {
      setIsChecking(false);
    }
  }, [assistantRowId, getCachedHealth, setCachedHealth]);

  // Repair an assistant's resources
  const repair = useCallback(async (): Promise<unknown> => {
    if (!assistantRowId) return null;

    setIsRepairing(true);
    setError(null);

    try {
      const { data, error: invokeError } = await supabase.functions.invoke('resource-health', {
        body: {
          action: 'repair_assistant',
          assistant_row_id: assistantRowId,
        },
      });

      if (invokeError) {
        throw new Error(invokeError.message);
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      // Invalidate cache and re-check health after repair
      invalidateCache(assistantRowId);
      await checkHealth(true);

      return data;
    } catch (err) {
      console.error('[useResourceHealth] Repair error:', err);
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      return null;
    } finally {
      setIsRepairing(false);
    }
  }, [assistantRowId, invalidateCache, checkHealth]);

  // Auto-check on mount (with cache)
  useEffect(() => {
    if (assistantRowId) {
      checkHealth(false);
    }
  }, [assistantRowId, checkHealth]);

  return {
    health,
    isChecking,
    isRepairing,
    error,
    checkHealth,
    repair,
    invalidateCache: () => invalidateCache(assistantRowId || ''),
  };
};

/** Response type for check_all action */
interface AllHealthResponse {
  status?: 'not_configured';
  message?: string;
  assistants?: AssistantHealth[];
  error?: string;
}

interface UseAllResourceHealthReturn {
  assistants: AssistantHealth[];
  isChecking: boolean;
  error: string | null;
  checkAll: () => Promise<AssistantHealth[]>;
  repairAssistant: (assistantRowId: string) => Promise<unknown>;
}

/**
 * Hook for checking health of all assistants (bulk operation)
 */
export const useAllResourceHealth = (): UseAllResourceHealthReturn => {
  const [assistants, setAssistants] = useState<AssistantHealth[]>([]);
  const [isChecking, setIsChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkAll = useCallback(async (): Promise<AssistantHealth[]> => {
    setIsChecking(true);
    setError(null);

    try {
      const { data, error: invokeError } = await supabase.functions.invoke<AllHealthResponse>('resource-health', {
        body: { action: 'check_all' },
      });

      if (invokeError) {
        throw new Error(invokeError.message);
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      // Handle graceful "not_configured" status - return empty array, no error
      if (data?.status === 'not_configured') {
        console.log('[useAllResourceHealth] OpenAI not configured, showing empty assistants list');
        setAssistants([]);
        return [];
      }

      const assistantsList = data?.assistants || [];
      setAssistants(assistantsList);
      return assistantsList;
    } catch (err) {
      console.error('[useAllResourceHealth] Check error:', err);
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      return [];
    } finally {
      setIsChecking(false);
    }
  }, []);

  // Repair a specific assistant and refresh list
  const repairAssistant = useCallback(async (assistantRowId: string): Promise<unknown> => {
    try {
      const { data, error: invokeError } = await supabase.functions.invoke('resource-health', {
        body: {
          action: 'repair_assistant',
          assistant_row_id: assistantRowId,
        },
      });

      if (invokeError) {
        throw new Error(invokeError.message);
      }

      // Check for error in response body
      if (data?.error) {
        throw new Error(data.error);
      }

      // Refresh the list after repair
      await checkAll();

      return data;
    } catch (err) {
      console.error('[useAllResourceHealth] Repair error:', err);
      throw err;
    }
  }, [checkAll]);

  return {
    assistants,
    isChecking,
    error,
    checkAll,
    repairAssistant,
  };
};

export default useResourceHealth;
