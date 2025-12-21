import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Hook for tracking AI call costs
 * Records costs to q_ai_costs table and updates prompt metadata
 */
export const useCostTracking = () => {
  const { user } = useAuth();

  /**
   * Fetch pricing for a model
   * @param {string} modelId - Model ID
   * @returns {Promise<{cost_per_1k_input_tokens: number, cost_per_1k_output_tokens: number}>}
   */
  const getModelPricing = useCallback(async (modelId) => {
    try {
      // Try exact match first
      let { data, error } = await supabase
        .from(import.meta.env.VITE_MODEL_PRICING_TBL)
        .select('cost_per_1k_input_tokens, cost_per_1k_output_tokens')
        .eq('model_id', modelId)
        .maybeSingle();

      if (!data && !error) {
        // Try partial match (e.g., "gpt-4o" matches "gpt-4o-2024-05-13")
        const baseModel = modelId.split('-').slice(0, 2).join('-');
        const { data: partialMatch } = await supabase
          .from(import.meta.env.VITE_MODEL_PRICING_TBL)
          .select('cost_per_1k_input_tokens, cost_per_1k_output_tokens')
          .ilike('model_id', `${baseModel}%`)
          .limit(1)
          .maybeSingle();
        
        data = partialMatch;
      }

      return data || { cost_per_1k_input_tokens: 0, cost_per_1k_output_tokens: 0 };
    } catch (error) {
      console.error('Error fetching model pricing:', error);
      return { cost_per_1k_input_tokens: 0, cost_per_1k_output_tokens: 0 };
    }
  }, []);

  /**
   * Find the top-level prompt for a given prompt
   * @param {string} promptRowId - Current prompt ID
   * @returns {Promise<{row_id: string, prompt_name: string} | null>}
   */
  const findTopLevelPrompt = useCallback(async (promptRowId) => {
    try {
      let currentId = promptRowId;
      let currentPrompt = null;
      let iterations = 0;
      const maxIterations = 20; // Prevent infinite loops

      while (currentId && iterations < maxIterations) {
        const { data, error } = await supabase
          .from(import.meta.env.VITE_PROMPTS_TBL)
          .select('row_id, prompt_name, parent_row_id')
          .eq('row_id', currentId)
          .maybeSingle();

        if (error || !data) break;

        currentPrompt = data;
        
        if (!data.parent_row_id) {
          // Found top level
          return { row_id: data.row_id, prompt_name: data.prompt_name };
        }
        
        currentId = data.parent_row_id;
        iterations++;
      }

      // Return current as fallback
      return currentPrompt ? { row_id: currentPrompt.row_id, prompt_name: currentPrompt.prompt_name } : null;
    } catch (error) {
      console.error('Error finding top-level prompt:', error);
      return null;
    }
  }, []);

  /**
   * Record an AI call cost
   * @param {Object} params
   * @param {string} params.promptRowId - The prompt that made the call
   * @param {string} params.model - Model used
   * @param {Object} params.usage - Token usage from AI response
   * @param {string} params.responseId - AI response ID
   * @param {string} params.finishReason - Finish reason
   * @param {number} params.latencyMs - Request latency
   * @param {string} params.promptName - Current prompt name
   */
  const recordCost = useCallback(async ({
    promptRowId,
    model,
    usage = {},
    responseId,
    finishReason,
    latencyMs,
    promptName,
  }) => {
    try {
      // Get pricing for the model
      const pricing = await getModelPricing(model);
      
      // Calculate costs
      const tokensInput = usage.prompt_tokens || 0;
      const tokensOutput = usage.completion_tokens || 0;
      const tokensTotal = usage.total_tokens || tokensInput + tokensOutput;
      
      const costInput = (tokensInput / 1000) * pricing.cost_per_1k_input_tokens;
      const costOutput = (tokensOutput / 1000) * pricing.cost_per_1k_output_tokens;
      const costTotal = costInput + costOutput;

      // Find top-level prompt
      const topLevel = await findTopLevelPrompt(promptRowId);

      // Insert cost record
      const { error: insertError } = await supabase
        .from(import.meta.env.VITE_AI_COSTS_TBL)
        .insert({
          prompt_row_id: promptRowId,
          top_level_prompt_row_id: topLevel?.row_id || promptRowId,
          user_id: user?.id || null,
          model,
          tokens_input: tokensInput,
          tokens_output: tokensOutput,
          tokens_total: tokensTotal,
          cost_input_usd: costInput,
          cost_output_usd: costOutput,
          cost_total_usd: costTotal,
          response_id: responseId,
          finish_reason: finishReason,
          latency_ms: latencyMs,
          prompt_name_snapshot: promptName,
          top_level_prompt_name_snapshot: topLevel?.prompt_name || promptName,
        });

      if (insertError) {
        console.error('Error recording cost:', insertError);
        return null;
      }

      // Update prompt's last_ai_call_metadata
      const metadata = {
        model,
        tokens_input: tokensInput,
        tokens_output: tokensOutput,
        tokens_total: tokensTotal,
        cost_input_usd: costInput,
        cost_output_usd: costOutput,
        cost_total_usd: costTotal,
        response_id: responseId,
        finish_reason: finishReason,
        latency_ms: latencyMs,
        timestamp: new Date().toISOString(),
      };

      const { error: updateError } = await supabase
        .from(import.meta.env.VITE_PROMPTS_TBL)
        .update({ last_ai_call_metadata: metadata })
        .eq('row_id', promptRowId);

      if (updateError) {
        console.error('Error updating prompt metadata:', updateError);
      }

      return {
        ...metadata,
        pricing,
      };
    } catch (error) {
      console.error('Error in recordCost:', error);
      return null;
    }
  }, [user, getModelPricing, findTopLevelPrompt]);

  /**
   * Get lifetime costs for a prompt and all its children
   * @param {string} topLevelPromptRowId - Top-level prompt ID
   * @returns {Promise<Object>}
   */
  const getLifetimeCosts = useCallback(async (topLevelPromptRowId) => {
    try {
      const { data, error } = await supabase
        .from(import.meta.env.VITE_AI_COSTS_TBL)
        .select('tokens_input, tokens_output, tokens_total, cost_total_usd, model, created_at')
        .eq('top_level_prompt_row_id', topLevelPromptRowId);

      if (error) throw error;

      if (!data || data.length === 0) {
        return {
          totalCalls: 0,
          totalTokensInput: 0,
          totalTokensOutput: 0,
          totalTokens: 0,
          totalCostUsd: 0,
          modelBreakdown: {},
          firstCall: null,
          lastCall: null,
        };
      }

      const modelBreakdown = {};
      let totalTokensInput = 0;
      let totalTokensOutput = 0;
      let totalTokens = 0;
      let totalCostUsd = 0;

      data.forEach(record => {
        totalTokensInput += record.tokens_input || 0;
        totalTokensOutput += record.tokens_output || 0;
        totalTokens += record.tokens_total || 0;
        totalCostUsd += parseFloat(record.cost_total_usd) || 0;

        if (!modelBreakdown[record.model]) {
          modelBreakdown[record.model] = { calls: 0, cost: 0, tokens: 0 };
        }
        modelBreakdown[record.model].calls++;
        modelBreakdown[record.model].cost += parseFloat(record.cost_total_usd) || 0;
        modelBreakdown[record.model].tokens += record.tokens_total || 0;
      });

      const sortedDates = data.map(r => new Date(r.created_at)).sort((a, b) => a - b);

      return {
        totalCalls: data.length,
        totalTokensInput,
        totalTokensOutput,
        totalTokens,
        totalCostUsd,
        modelBreakdown,
        firstCall: sortedDates[0]?.toISOString() || null,
        lastCall: sortedDates[sortedDates.length - 1]?.toISOString() || null,
      };
    } catch (error) {
      console.error('Error getting lifetime costs:', error);
      return null;
    }
  }, []);

  /**
   * Get platform-wide cost analytics
   * @param {Object} options - Query options
   * @returns {Promise<Object>}
   */
  const getPlatformCosts = useCallback(async (options = {}) => {
    const { startDate, endDate, groupBy = 'day' } = options;

    try {
      let query = supabase
        .from(import.meta.env.VITE_AI_COSTS_TBL)
        .select('*');

      if (startDate) {
        query = query.gte('created_at', startDate);
      }
      if (endDate) {
        query = query.lte('created_at', endDate);
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) throw error;

      // Aggregate by top-level prompt
      const byPrompt = {};
      const byUser = {};
      const byDate = {};
      let totalCost = 0;
      let totalTokens = 0;

      data?.forEach(record => {
        totalCost += parseFloat(record.cost_total_usd) || 0;
        totalTokens += record.tokens_total || 0;

        // By prompt
        const promptKey = record.top_level_prompt_row_id;
        if (!byPrompt[promptKey]) {
          byPrompt[promptKey] = {
            row_id: promptKey,
            name: record.top_level_prompt_name_snapshot,
            cost: 0,
            tokens: 0,
            calls: 0,
          };
        }
        byPrompt[promptKey].cost += parseFloat(record.cost_total_usd) || 0;
        byPrompt[promptKey].tokens += record.tokens_total || 0;
        byPrompt[promptKey].calls++;

        // By user
        const userKey = record.user_id || 'anonymous';
        if (!byUser[userKey]) {
          byUser[userKey] = { user_id: userKey, cost: 0, tokens: 0, calls: 0 };
        }
        byUser[userKey].cost += parseFloat(record.cost_total_usd) || 0;
        byUser[userKey].tokens += record.tokens_total || 0;
        byUser[userKey].calls++;

        // By date
        const dateKey = new Date(record.created_at).toISOString().split('T')[0];
        if (!byDate[dateKey]) {
          byDate[dateKey] = { date: dateKey, cost: 0, tokens: 0, calls: 0 };
        }
        byDate[dateKey].cost += parseFloat(record.cost_total_usd) || 0;
        byDate[dateKey].tokens += record.tokens_total || 0;
        byDate[dateKey].calls++;
      });

      return {
        totalCost,
        totalTokens,
        totalCalls: data?.length || 0,
        byPrompt: Object.values(byPrompt).sort((a, b) => b.cost - a.cost),
        byUser: Object.values(byUser).sort((a, b) => b.cost - a.cost),
        byDate: Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date)),
      };
    } catch (error) {
      console.error('Error getting platform costs:', error);
      return null;
    }
  }, []);

  return {
    recordCost,
    getLifetimeCosts,
    getPlatformCosts,
    getModelPricing,
  };
};

export default useCostTracking;
