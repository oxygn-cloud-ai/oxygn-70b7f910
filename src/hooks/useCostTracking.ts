import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface ModelPricing {
  cost_per_1k_input_tokens: number;
  cost_per_1k_output_tokens: number;
}

interface TopLevelPrompt {
  row_id: string;
  prompt_name: string;
}

interface TokenUsage {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
}

interface RecordCostParams {
  promptRowId: string;
  model: string;
  usage?: TokenUsage;
  responseId?: string;
  finishReason?: string;
  latencyMs?: number;
  promptName?: string;
}

interface CostMetadata {
  model: string;
  tokens_input: number;
  tokens_output: number;
  tokens_total: number;
  cost_input_usd: number;
  cost_output_usd: number;
  cost_total_usd: number;
  response_id?: string;
  finish_reason?: string;
  latency_ms?: number;
  timestamp: string;
  pricing: ModelPricing;
}

interface ModelBreakdown {
  calls: number;
  cost: number;
  tokens: number;
}

interface LifetimeCosts {
  totalCalls: number;
  totalTokensInput: number;
  totalTokensOutput: number;
  totalTokens: number;
  totalCostUsd: number;
  modelBreakdown: Record<string, ModelBreakdown>;
  firstCall: string | null;
  lastCall: string | null;
}

interface PromptCostInfo {
  row_id: string;
  name: string;
  cost: number;
  tokens: number;
  calls: number;
}

interface UserCostInfo {
  user_id: string;
  cost: number;
  tokens: number;
  calls: number;
}

interface DateCostInfo {
  date: string;
  cost: number;
  tokens: number;
  calls: number;
}

interface PlatformCostOptions {
  startDate?: string;
  endDate?: string;
  groupBy?: 'day' | 'week' | 'month';
}

interface PlatformCosts {
  totalCost: number;
  totalTokens: number;
  totalCalls: number;
  byPrompt: PromptCostInfo[];
  byUser: UserCostInfo[];
  byDate: DateCostInfo[];
}

interface UseCostTrackingReturn {
  recordCost: (params: RecordCostParams) => Promise<CostMetadata | null>;
  getLifetimeCosts: (topLevelPromptRowId: string) => Promise<LifetimeCosts | null>;
  getPlatformCosts: (options?: PlatformCostOptions) => Promise<PlatformCosts | null>;
  getModelPricing: (modelId: string) => Promise<ModelPricing>;
}

/**
 * Hook for tracking AI call costs
 * Records costs to q_ai_costs table and updates prompt metadata
 */
export const useCostTracking = (): UseCostTrackingReturn => {
  const { user } = useAuth();

  /**
   * Fetch pricing for a model from q_models table
   */
  const getModelPricing = useCallback(async (modelId: string): Promise<ModelPricing> => {
    try {
      // Try exact match first from q_models table
      let { data, error } = await supabase
        .from(import.meta.env.VITE_MODELS_TBL)
        .select('input_cost_per_million, output_cost_per_million')
        .eq('model_id', modelId)
        .maybeSingle();

      if (!data && !error) {
        // Try partial match using api_model_id
        const { data: apiMatch } = await supabase
          .from(import.meta.env.VITE_MODELS_TBL)
          .select('input_cost_per_million, output_cost_per_million')
          .eq('api_model_id', modelId)
          .maybeSingle();
        
        data = apiMatch;
      }

      if (data) {
        // Convert from per-million to per-1k tokens
        return { 
          cost_per_1k_input_tokens: (parseFloat(String(data.input_cost_per_million)) || 0) / 1000,
          cost_per_1k_output_tokens: (parseFloat(String(data.output_cost_per_million)) || 0) / 1000
        };
      }

      return { cost_per_1k_input_tokens: 0, cost_per_1k_output_tokens: 0 };
    } catch (error) {
      console.error('Error fetching model pricing:', error);
      return { cost_per_1k_input_tokens: 0, cost_per_1k_output_tokens: 0 };
    }
  }, []);

  /**
   * Find the top-level prompt for a given prompt
   */
  const findTopLevelPrompt = useCallback(async (promptRowId: string): Promise<TopLevelPrompt | null> => {
    try {
      let currentId: string | null = promptRowId;
      let currentPrompt: { row_id: string; prompt_name: string; parent_row_id: string | null } | null = null;
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
   */
  const recordCost = useCallback(async ({
    promptRowId,
    model,
    usage = {},
    responseId,
    finishReason,
    latencyMs,
    promptName,
  }: RecordCostParams): Promise<CostMetadata | null> => {
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
   */
  const getLifetimeCosts = useCallback(async (topLevelPromptRowId: string): Promise<LifetimeCosts | null> => {
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

      const modelBreakdown: Record<string, ModelBreakdown> = {};
      let totalTokensInput = 0;
      let totalTokensOutput = 0;
      let totalTokens = 0;
      let totalCostUsd = 0;

      data.forEach(record => {
        totalTokensInput += record.tokens_input || 0;
        totalTokensOutput += record.tokens_output || 0;
        totalTokens += record.tokens_total || 0;
        totalCostUsd += parseFloat(String(record.cost_total_usd)) || 0;

        if (!modelBreakdown[record.model]) {
          modelBreakdown[record.model] = { calls: 0, cost: 0, tokens: 0 };
        }
        modelBreakdown[record.model].calls++;
        modelBreakdown[record.model].cost += parseFloat(String(record.cost_total_usd)) || 0;
        modelBreakdown[record.model].tokens += record.tokens_total || 0;
      });

      const sortedDates = data.map(r => new Date(r.created_at)).sort((a, b) => a.getTime() - b.getTime());

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
   */
  const getPlatformCosts = useCallback(async (options: PlatformCostOptions = {}): Promise<PlatformCosts | null> => {
    const { startDate, endDate } = options;

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
      const byPrompt: Record<string, PromptCostInfo> = {};
      const byUser: Record<string, UserCostInfo> = {};
      const byDate: Record<string, DateCostInfo> = {};
      let totalCost = 0;
      let totalTokens = 0;

      data?.forEach((record: { 
        top_level_prompt_row_id: string;
        top_level_prompt_name_snapshot: string;
        user_id: string | null;
        cost_total_usd: string | number;
        tokens_total: number;
        created_at: string;
      }) => {
        totalCost += parseFloat(String(record.cost_total_usd)) || 0;
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
        byPrompt[promptKey].cost += parseFloat(String(record.cost_total_usd)) || 0;
        byPrompt[promptKey].tokens += record.tokens_total || 0;
        byPrompt[promptKey].calls++;

        // By user
        const userKey = record.user_id || 'anonymous';
        if (!byUser[userKey]) {
          byUser[userKey] = { user_id: userKey, cost: 0, tokens: 0, calls: 0 };
        }
        byUser[userKey].cost += parseFloat(String(record.cost_total_usd)) || 0;
        byUser[userKey].tokens += record.tokens_total || 0;
        byUser[userKey].calls++;

        // By date
        const dateKey = new Date(record.created_at).toISOString().split('T')[0];
        if (!byDate[dateKey]) {
          byDate[dateKey] = { date: dateKey, cost: 0, tokens: 0, calls: 0 };
        }
        byDate[dateKey].cost += parseFloat(String(record.cost_total_usd)) || 0;
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
