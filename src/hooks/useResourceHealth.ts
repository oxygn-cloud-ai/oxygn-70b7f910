import { useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

interface AssistantHealth {
  row_id: string;
  openai_assistant_id: string | null;
  assistant_exists: boolean;
  vector_store_exists: boolean;
  issues: string[];
  [key: string]: unknown;
}

interface CacheEntry {
  data: AssistantHealth;
  timestamp: number;
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

interface UseAllResourceHealthReturn {
  assistants: AssistantHealth[];
  isChecking: boolean;
  error: string | null;
  checkAll: () => Promise<AssistantHealth[]>;
  repairAssistant: (assistantRowId: string) => Promise<unknown>;
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
      const { data, error: invokeError } = await supabase.functions.invoke('resource-health', {
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

      setHealth(data);
      setCachedHealth(assistantRowId, data);
      return data;
    } catch (err) {
      console.error('[useResourceHealth] Check error:', err);
      setError((err as Error).message);
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
      setError((err as Error).message);
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
    invalidateCache: () => assistantRowId && invalidateCache(assistantRowId),
  };
};

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
      const { data, error: invokeError } = await supabase.functions.invoke('resource-health', {
        body: { action: 'check_all' },
      });

      if (invokeError) {
        throw new Error(invokeError.message);
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      setAssistants(data?.assistants || []);
      return data?.assistants || [];
    } catch (err) {
      console.error('[useAllResourceHealth] Check error:', err);
      setError((err as Error).message);
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
