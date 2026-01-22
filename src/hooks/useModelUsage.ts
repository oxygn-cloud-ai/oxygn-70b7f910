import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Hook to fetch cumulative usage stats per model from q_ai_costs table
 */
export const useModelUsage = (options = {}) => {
  const { period = 'all' } = options; // 'all' | '30days' | '7days'
  const [usage, setUsage] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  const fetchUsage = useCallback(async () => {
    try {
      if (isMountedRef.current) setIsLoading(true);
      
      let query = supabase
        .from(import.meta.env.VITE_AI_COSTS_TBL || 'q_ai_costs')
        .select('model, tokens_input, tokens_output, cost_total_usd');
      
      // Apply date filter based on period
      if (period === '30days') {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        query = query.gte('created_at', thirtyDaysAgo.toISOString());
      } else if (period === '7days') {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        query = query.gte('created_at', sevenDaysAgo.toISOString());
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      
      // Aggregate by model
      const aggregated = {};
      (data || []).forEach(row => {
        const modelId = row.model || 'unknown';
        if (!aggregated[modelId]) {
          aggregated[modelId] = {
            totalInputTokens: 0,
            totalOutputTokens: 0,
            totalTokens: 0,
            totalCost: 0,
            callCount: 0
          };
        }
        aggregated[modelId].totalInputTokens += row.tokens_input || 0;
        aggregated[modelId].totalOutputTokens += row.tokens_output || 0;
        aggregated[modelId].totalTokens += (row.tokens_input || 0) + (row.tokens_output || 0);
        aggregated[modelId].totalCost += parseFloat(row.cost_total_usd) || 0;
        aggregated[modelId].callCount += 1;
      });
      
      if (isMountedRef.current) setUsage(aggregated);
    } catch (error) {
      console.error('Error fetching model usage:', error);
      if (isMountedRef.current) setUsage({});
    } finally {
      if (isMountedRef.current) setIsLoading(false);
    }
  }, [period]);

  useEffect(() => {
    fetchUsage();
  }, [fetchUsage]);

  const getUsageForModel = useCallback((modelId) => {
    // Try exact match first
    if (usage[modelId]) return usage[modelId];
    
    // Try partial match (e.g., 'gpt-4o-mini' matches 'gpt-4o-mini-2024-07-18')
    for (const [key, value] of Object.entries(usage)) {
      if (key.startsWith(modelId) || modelId.startsWith(key)) {
        return value;
      }
    }
    
    return { totalInputTokens: 0, totalOutputTokens: 0, totalTokens: 0, totalCost: 0, callCount: 0 };
  }, [usage]);

  return {
    usage,
    isLoading,
    getUsageForModel,
    refetch: fetchUsage
  };
};
