// @ts-nocheck
import { useCallback, useRef } from 'react';
import { useSupabase } from './useSupabase';
import { useConversationRun } from './useConversationRun';
import { useCascadeRun } from '@/contexts/CascadeRunContext';
import { useApiCallContext } from '@/contexts/ApiCallContext';
import { useLiveApiDashboard } from '@/contexts/LiveApiDashboardContext';
import { useExecutionTracing } from './useExecutionTracing';
import { useModels } from './useModels';
import { toast } from '@/components/ui/sonner';
import { notify } from '@/contexts/ToastHistoryContext';
import { parseApiError, isQuotaError, formatErrorForDisplay } from '@/utils/apiErrorUtils';
import { buildSystemVariablesForRun } from '@/utils/resolveSystemVariables';
import { supabase as supabaseClient } from '@/integrations/supabase/client';
import { executePostAction } from '@/services/actionExecutors';
import { validateActionResponse, extractJsonFromResponse } from '@/utils/actionValidation';
import { trackEvent, trackException } from '@/lib/posthog';
import { CONTEXT_VARIABLE_KEYS } from '@/config/contextVariables';

// Constants for Manus task polling
const MANUS_POLL_INTERVAL_MS = 2000;
const MANUS_TASK_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

/**
 * Custom error class for Manus tasks to preserve error_code through error chain
 */
class ManusError extends Error {
  constructor(message, errorCode, taskId = null, taskUrl = null) {
    super(message);
    this.name = 'ManusError';
    this.error_code = errorCode;
    this.task_id = taskId;
    this.task_url = taskUrl;
  }
}

// Helper to get a usable message from a prompt
const getPromptMessage = (prompt, fallbackMessage = 'Execute this prompt') => {
  const userPrompt = prompt.input_user_prompt?.trim();
  const adminPrompt = prompt.input_admin_prompt?.trim();
  
  if (userPrompt) return userPrompt;
  if (adminPrompt) return adminPrompt;
  
  // Use configurable fallback - prevents 400 errors
  return fallbackMessage;
};

// Pre-flight validation for prompts
const validatePromptContent = (prompts) => {
  const issues = [];
  
  for (const prompt of prompts) {
    const userPrompt = prompt.input_user_prompt?.trim();
    const adminPrompt = prompt.input_admin_prompt?.trim();
    
    if (!userPrompt && !adminPrompt) {
      issues.push({
        promptRowId: prompt.row_id,
        promptName: prompt.prompt_name,
        issue: 'no_content',
        message: 'No user or admin prompt content',
      });
    }
  }
  
  return issues;
};

export const useCascadeExecutor = () => {
  const supabase = useSupabase();
  const { runConversation, cancelRun } = useConversationRun();
  const { registerCall } = useApiCallContext();
  const { resetCumulativeStats, addCall, removeCall } = useLiveApiDashboard();
  const { startTrace, createSpan, completeSpan, failSpan, completeTrace } = useExecutionTracing();
  const { getProviderForModel, isManusModel } = useModels();
  const manusTaskCancelRef = useRef(false);
  const {
    startCascade,
    updateProgress,
    markPromptComplete,
    markPromptSkipped,
    completeCascade,
    isCancelled,
    checkPaused,
    showError,
    showActionPreview,
    skipAllPreviews,
    registerCancelHandler, // For true OpenAI cancellation
    // Question prompt methods for run-mode question interrupts
    showQuestion,
    addCollectedQuestionVar,
  } = useCascadeRun();

  /**
   * Execute a Manus task and wait for completion via realtime subscription
   */
  const runManusTask = useCallback(async ({
    prompt,
    userMessage,
    templateVariables,
    traceId,
  }) => {
    const startTime = Date.now();
    manusTaskCancelRef.current = false;

    // Build request metadata for logging
    const requestMetadata = {
      provider: 'manus',
      task_mode: prompt.task_mode || 'adaptive',
      prompt_row_id: prompt.row_id,
      prompt_name: prompt.prompt_name,
      model: prompt.model,
      user_message_preview: userMessage?.substring(0, 100),
      system_prompt_preview: prompt.input_admin_prompt?.substring(0, 100),
      has_system_prompt: !!prompt.input_admin_prompt,
      trace_id: traceId,
    };

    // Call manus-task-create edge function
    const { data: createData, error: createError } = await supabaseClient.functions.invoke('manus-task-create', {
      body: {
        prompt_row_id: prompt.row_id,
        user_message: userMessage,
        system_prompt: prompt.input_admin_prompt || '',  // Pass system_prompt to edge function
        template_variables: templateVariables,
        trace_id: traceId,
        task_mode: prompt.task_mode || 'adaptive',
      },
    });

    // Preserve error_code in thrown error
    if (createError || !createData?.task_id) {
      const errorMessage = createError?.message || createData?.error || 'Failed to create Manus task';
      const errorCode = createData?.error_code || 'MANUS_CREATE_FAILED';
      
      toast.error('Failed to create Manus task', {
        description: errorMessage,
        source: 'useCascadeExecutor.runManusTask',
        errorCode: errorCode,
        details: JSON.stringify({
          error: errorMessage,
          error_code: errorCode,
          recoverable: createData?.recoverable || false,
          request: requestMetadata,
        }, null, 2),
      });
      
      throw new ManusError(errorMessage, errorCode);
    }

    const taskId = createData.task_id;
    
    // Track in live dashboard
    const callId = addCall({
      provider: 'manus',
      model: prompt.model,
      promptName: prompt.prompt_name,
      manusTaskId: taskId,
      manusTaskUrl: createData.task_url,
      status: 'running',
    });

    // Task started toast with full details
    toast.info(`Manus task started`, {
      description: prompt.prompt_name,
      source: 'useCascadeExecutor.runManusTask',
      details: JSON.stringify({
        task_id: taskId,
        task_url: createData.task_url,
        request: requestMetadata,
        request_metadata: createData.request_metadata,
      }, null, 2),
    });

    // Set up realtime subscription and wait for completion
    return new Promise((resolve, reject) => {
      let subscription = null;
      let pollInterval = null;
      let timeoutId = null;

      const cleanup = () => {
        if (subscription) {
          supabaseClient.removeChannel(subscription);
        }
        if (pollInterval) {
          clearInterval(pollInterval);
        }
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
      };

      const handleTaskComplete = (task) => {
        cleanup();
        removeCall(callId); // Clean up live dashboard entry
        const latency = Date.now() - startTime;

        if (task.status === 'completed') {
          toast.success('Manus task completed', {
            description: prompt.prompt_name,
            source: 'useCascadeExecutor.runManusTask',
            details: JSON.stringify({
              task_id: task.task_id,
              task_url: task.task_url,
              latency_ms: latency,
              response_length: task.result_message?.length || 0,
              attachment_count: task.attachments?.length || 0,
              request: requestMetadata,
            }, null, 2),
          });

          resolve({
            response: task.result_message || '',
            taskId: task.task_id,
            taskUrl: task.task_url,
            attachments: task.attachments || [],
            latency_ms: latency,
          });
        } else if (task.status === 'failed' || task.status === 'cancelled') {
          const errorCode = task.error_code || `MANUS_TASK_${task.status.toUpperCase()}`;
          
          toast.error(`Manus task ${task.status}`, {
            description: task.stop_reason || prompt.prompt_name,
            source: 'useCascadeExecutor.runManusTask',
            errorCode: errorCode,
            details: JSON.stringify({
              task_id: task.task_id,
              task_url: task.task_url,
              status: task.status,
              stop_reason: task.stop_reason,
              error_code: errorCode,
              latency_ms: latency,
              request: requestMetadata,
            }, null, 2),
          });
          
          reject(new ManusError(
            task.stop_reason || `Manus task ${task.status}`,
            errorCode,
            task.task_id,
            task.task_url
          ));
        } else if (task.requires_input) {
          // Handle 'ask' stop_reason
          const errorCode = 'MANUS_REQUIRES_INPUT';
          
          toast.error('Manus requires interactive input', {
            description: 'This task mode is not supported in cascade runs',
            source: 'useCascadeExecutor.runManusTask',
            errorCode: errorCode,
            details: JSON.stringify({
              task_id: task.task_id,
              task_url: task.task_url,
              error_code: errorCode,
              request: requestMetadata,
            }, null, 2),
          });
          
          reject(new ManusError(
            'Manus requires interactive input',
            errorCode,
            task.task_id,
            task.task_url
          ));
        }
      };

      // Set up realtime subscription
      subscription = supabaseClient
        .channel('manus-task-' + taskId)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'q_manus_tasks',
            filter: 'task_id=eq.' + taskId,
          },
          (payload) => {
            if (payload.new && ['completed', 'failed', 'cancelled'].includes(payload.new.status)) {
              handleTaskComplete(payload.new);
            } else if (payload.new?.requires_input) {
              handleTaskComplete(payload.new);
            }
          }
        )
        .subscribe();

      // Poll as backup (in case realtime misses an update)
      pollInterval = setInterval(async () => {
        if (manusTaskCancelRef.current) {
          cleanup();
          const errorCode = 'MANUS_TASK_CANCELLED';
          
          toast.info('Manus task cancelled', {
            description: 'Cancelled by user',
            source: 'useCascadeExecutor.runManusTask',
            details: JSON.stringify({
              task_id: taskId,
              elapsed_ms: Date.now() - startTime,
              error_code: errorCode,
              request: requestMetadata,
            }, null, 2),
          });
          
          reject(new ManusError('Manus task cancelled by user', errorCode, taskId));
          return;
        }

        const { data: task } = await supabaseClient
          .from('q_manus_tasks')
          .select('*')
          .eq('task_id', taskId)
          .maybeSingle();

        if (task && ['completed', 'failed', 'cancelled'].includes(task.status)) {
          handleTaskComplete(task);
        } else if (task?.requires_input) {
          handleTaskComplete(task);
        }
      }, MANUS_POLL_INTERVAL_MS);

      // Timeout after 30 minutes
      timeoutId = setTimeout(() => {
        cleanup();
        const errorCode = 'MANUS_TIMEOUT';
        
        toast.error('Manus task timed out', {
          description: 'Task exceeded 30 minute limit',
          source: 'useCascadeExecutor.runManusTask',
          errorCode: errorCode,
          details: JSON.stringify({
            task_id: taskId,
            timeout_ms: MANUS_TASK_TIMEOUT_MS,
            error_code: errorCode,
            request: requestMetadata,
          }, null, 2),
        });
        
        reject(new ManusError('Manus task timed out after 30 minutes', errorCode, taskId));
      }, MANUS_TASK_TIMEOUT_MS);
    });
  }, [addCall, removeCall]);

  // Fetch hierarchy of prompts starting from a top-level prompt
  const fetchCascadeHierarchy = useCallback(async (topLevelRowId) => {
    if (!supabase) return null;

    const promptsTable = import.meta.env.VITE_PROMPTS_TBL;
    
    // Fetch all prompts in the hierarchy using recursive approach
    const levels = [];
    let currentLevelIds = [topLevelRowId];
    let allPrompts = [];

    // First, get the top-level prompt
    const { data: topPrompt, error: topError } = await supabase
      .from(promptsTable)
      .select('*')
      .eq('row_id', topLevelRowId)
      .eq('is_deleted', false)
      .maybeSingle();

    if (topError || !topPrompt) {
      console.error('Error fetching top-level prompt:', topError);
      return null;
    }

    levels.push({ level: 0, prompts: [topPrompt] });
    allPrompts.push(topPrompt);

    // Recursively fetch children level by level
    let levelNum = 1;
    while (currentLevelIds.length > 0) {
      const { data: children, error: childError } = await supabase
        .from(promptsTable)
        .select('*')
        .in('parent_row_id', currentLevelIds)
        .eq('is_deleted', false)
        .order('position_lex', { ascending: true });

      if (childError) {
        console.error('Error fetching children:', childError);
        break;
      }

      if (!children || children.length === 0) {
        break;
      }

      levels.push({ level: levelNum, prompts: children });
      allPrompts = [...allPrompts, ...children];
      currentLevelIds = children.map(c => c.row_id);
      levelNum++;
    }

    return {
      levels,
      totalPrompts: allPrompts.length,
      totalLevels: levels.length,
    };
  }, [supabase]);

  // Build cascade context variables from accumulated responses
  // Also includes q.ref[UUID] resolution for already-executed prompts
  const buildCascadeVariables = useCallback((accumulatedResponses, currentLevel, prompt, parentData, user, promptDataMap = new Map(), topLevelData = null) => {
    // Start with system variables (q.today, q.user.name, etc.)
    // Pass topLevelData separately from parentData for correct resolution
    const vars = buildSystemVariablesForRun({
      promptData: prompt,
      parentData: parentData,
      topLevelData: topLevelData,
      user: user,
      storedVariables: prompt?.system_variables || {},
    });

    // Previous response (most recent)
    if (accumulatedResponses.length > 0) {
      const lastResponse = accumulatedResponses[accumulatedResponses.length - 1];
      vars['cascade_previous_response'] = lastResponse.response || '';
      vars['cascade_previous_name'] = lastResponse.promptName || '';
      // Also set as q.previous.response for consistency
      vars['q.previous.response'] = lastResponse.response || '';
      vars['q.previous.name'] = lastResponse.promptName || '';
    }

    // All responses as JSON
    vars['cascade_all_responses'] = JSON.stringify(accumulatedResponses.map(r => ({
      level: r.level,
      promptName: r.promptName,
      response: r.response,
    })));

    // Current cascade metadata
    vars['cascade_level'] = String(currentLevel);
    vars['cascade_prompt_count'] = String(accumulatedResponses.length);

    // Level-specific responses
    accumulatedResponses.forEach((r, idx) => {
      vars[`cascade_level_${r.level}_response_${idx}`] = r.response || '';
    });

    // Add q.ref[UUID] variables from already-executed prompts in this cascade
    // IMPORTANT: Skip context variables - they should use runtime values, not stale stored snapshots
    // CONTEXT_VARIABLE_KEYS imported from @/config/contextVariables
    
    promptDataMap.forEach((data, promptId) => {
      vars[`q.ref[${promptId}].output_response`] = data.output_response || '';
      vars[`q.ref[${promptId}].user_prompt_result`] = data.user_prompt_result || '';
      vars[`q.ref[${promptId}].prompt_name`] = data.prompt_name || '';
      vars[`q.ref[${promptId}].input_admin_prompt`] = data.input_admin_prompt || '';
      vars[`q.ref[${promptId}].input_user_prompt`] = data.input_user_prompt || '';
      
      // Include system variables from referenced prompt, but skip context variables
      if (data.system_variables && typeof data.system_variables === 'object') {
        Object.entries(data.system_variables).forEach(([key, val]) => {
          // Skip context variables from q.ref resolution
          if (!CONTEXT_VARIABLE_KEYS.includes(key)) {
            vars[`q.ref[${promptId}].${key}`] = String(val || '');
          }
        });
      }
    });

    return vars;
  }, []);

  // Wait while paused
  const waitWhilePaused = useCallback(async () => {
    while (checkPaused()) {
      await new Promise(resolve => setTimeout(resolve, 200));
      if (isCancelled()) return false;
    }
    return true;
  }, [checkPaused, isCancelled]);

  const getRetryDelayMs = useCallback((err) => {
    const retryAfterS = err?.retry_after_s;
    if (typeof retryAfterS === 'number' && retryAfterS > 0) {
      return Math.ceil(retryAfterS * 1000) + 250;
    }

    const msg = err?.message || '';
    const match = /try again in ([0-9.]+)s/i.exec(msg);
    if (match) {
      const s = Number.parseFloat(match[1]);
      if (!Number.isNaN(s) && s > 0) return Math.ceil(s * 1000) + 250;
    }

    if (err?.status === 429) return 2500;
    return 0;
  }, []);

  // Execute the cascade run
  const executeCascade = useCallback(async (topLevelRowId, parentAssistantRowId) => {
    // Register with ApiCallContext for NavigationGuard protection
    const cleanupCall = registerCall();
    
    // Register cancel handler for true OpenAI cancellation + Manus task cancellation
    const unregisterCancel = registerCancelHandler(() => {
      cancelRun();
      manusTaskCancelRef.current = true;
    });
    
    if (!supabase) {
      cleanupCall();
      toast.error('Database not available', {
        source: 'useCascadeExecutor.executeCascade',
        errorCode: 'SUPABASE_UNAVAILABLE',
      });
      return;
    }

    const cascadeStartTime = Date.now();

    // Notify cascade start
    toast.info('Starting cascade run...', {
      description: 'Fetching prompt hierarchy',
      source: 'useCascadeExecutor',
      details: JSON.stringify({ topLevelRowId, parentAssistantRowId }, null, 2),
    });

    // Fetch cascade fallback setting
    let cascadeFallbackMessage = 'Execute this prompt';
    try {
      const { data: settingsData } = await supabase
        .from(import.meta.env.VITE_SETTINGS_TBL)
        .select('setting_value')
        .eq('setting_key', 'cascade_empty_prompt_fallback')
        .maybeSingle();
      
      if (settingsData?.setting_value) {
        cascadeFallbackMessage = settingsData.setting_value;
      }
    } catch (err) {
      // Use default if setting not found
      console.log('Using default cascade fallback message');
    }

    // Fetch hierarchy
    const hierarchy = await fetchCascadeHierarchy(topLevelRowId);
    if (!hierarchy) {
      toast.error('Failed to fetch prompt hierarchy', {
        source: 'useCascadeExecutor.fetchCascadeHierarchy',
        errorCode: 'HIERARCHY_FETCH_FAILED',
        details: JSON.stringify({ topLevelRowId }, null, 2),
      });
      return;
    }

    // Get current user for variable resolution
    let currentUser = null;
    try {
      const { data: { user } } = await supabaseClient.auth.getUser();
      if (user) {
        // Fetch profile for display name
        const { data: profile } = await supabase
          .from('profiles')
          .select('display_name, email')
          .eq('id', user.id)
          .maybeSingle();
        
        currentUser = {
          id: user.id,
          email: user.email,
          display_name: profile?.display_name || user.email?.split('@')[0] || 'Unknown',
        };
      }
    } catch (err) {
      console.warn('Could not fetch user for variable resolution:', err);
    }

    // Get top-level parent data for variable resolution
    const topLevelPrompt = hierarchy.levels[0]?.prompts[0] || null;

    // Build parent lookup map for immediate parent resolution
    // This allows each prompt to correctly identify its IMMEDIATE parent, not just the top-level
    const promptLookupMap = new Map();
    hierarchy.levels.forEach(level => {
      level.prompts.forEach(prompt => {
        promptLookupMap.set(prompt.row_id, {
          row_id: prompt.row_id,
          prompt_name: prompt.prompt_name,
          parent_row_id: prompt.parent_row_id,
        });
      });
    });

    // Helper to get immediate parent data for a specific prompt
    // First checks local lookup map (fast), then falls back to DB query if needed
    const getImmediateParent = async (prompt) => {
      if (!prompt.parent_row_id) return null;
      
      // Try the local lookup map first (covers all prompts in current hierarchy)
      const localParent = promptLookupMap.get(prompt.parent_row_id);
      if (localParent) return localParent;
      
      // Fallback: parent exists but is outside the current hierarchy (edge case)
      // Query the database to resolve orphaned parent references
      try {
        const { data: parentPrompt } = await supabase
          .from(import.meta.env.VITE_PROMPTS_TBL || 'q_prompts')
          .select('row_id, prompt_name, parent_row_id')
          .eq('row_id', prompt.parent_row_id)
          .eq('is_deleted', false)
          .maybeSingle();
        
        if (parentPrompt) {
          console.warn('Parent resolved via DB fallback (not in cascade hierarchy):', parentPrompt.prompt_name);
          return parentPrompt;
        }
      } catch (err) {
        console.warn('Failed to fetch parent from DB:', err);
      }
      
      return null;
    };

    // Count non-excluded prompts for accurate progress
    // Also exclude the top-level assistant (level 0) since it's the context, not a runnable prompt
    const nonExcludedPrompts = hierarchy.levels
      .flatMap((l, idx) => l.prompts.map(p => ({ ...p, levelIdx: idx })))
      .filter(p => !p.exclude_from_cascade && !(p.levelIdx === 0 && p.is_assistant));

    const excludedPrompts = hierarchy.levels
      .flatMap(l => l.prompts)
      .filter(p => p.exclude_from_cascade);

    // Also identify assistant prompts at level 0 (they're the context, not runnable)
    const assistantPrompts = hierarchy.levels[0]?.prompts.filter(p => p.is_assistant) || [];

    if (nonExcludedPrompts.length === 0) {
      toast.error('No child prompts to run in cascade', {
        source: 'useCascadeExecutor',
        errorCode: 'NO_PROMPTS',
        details: JSON.stringify({
          totalLevels: hierarchy.totalLevels,
          excludedCount: excludedPrompts.length,
        }, null, 2),
      });
      return;
    }

    // Notify hierarchy loaded
    toast.success('Cascade hierarchy loaded', {
      description: `${nonExcludedPrompts.length} prompts across ${hierarchy.totalLevels} levels`,
      source: 'useCascadeExecutor',
      details: JSON.stringify({
        totalPrompts: hierarchy.totalPrompts,
        runnablePrompts: nonExcludedPrompts.length,
        excludedPrompts: excludedPrompts.length,
        levels: hierarchy.totalLevels,
        promptNames: nonExcludedPrompts.map(p => p.prompt_name),
      }, null, 2),
    });

    // Pre-flight validation: check for prompts without content
    const validationIssues = validatePromptContent(nonExcludedPrompts);
    if (validationIssues.length > 0) {
      console.warn('Cascade pre-flight validation issues:', validationIssues);
      toast.warning(
        `${validationIssues.length} prompt(s) have no content - using fallback messages`,
        { 
          description: validationIssues.map(i => i.promptName).join(', '),
          source: 'useCascadeExecutor.validatePromptContent',
          errorCode: 'CONTENT_VALIDATION_WARNING',
          details: JSON.stringify(validationIssues, null, 2),
        }
      );
    }

    // Initialize cascade state with correct count
    resetCumulativeStats(); // Reset cumulative token/cost stats for dashboard
    startCascade(hierarchy.totalLevels, nonExcludedPrompts.length);
    
    // Track cascade start
    trackEvent('cascade_started', {
      top_level_prompt_id: topLevelRowId,
      top_level_prompt_name: topLevelPrompt?.prompt_name,
      total_levels: hierarchy.totalLevels,
      total_prompts: nonExcludedPrompts.length,
      excluded_prompts: excludedPrompts.length,
    });

    // Start execution trace for the cascade
    let traceId = null;
    let contextSnapshot = {};
    try {
      const traceResult = await startTrace({
        entry_prompt_row_id: topLevelRowId,
        execution_type: 'cascade_top',
      });
      
      if (traceResult.success) {
        traceId = traceResult.trace_id;
        contextSnapshot = traceResult.context_snapshot || {};
        console.log('Execution trace started:', traceId);
      } else if (traceResult.code === 'CONCURRENT_EXECUTION') {
        toast.error('Cannot start cascade', {
          description: traceResult.error,
          source: 'useCascadeExecutor',
        });
        cleanupCall();
        return;
      } else {
        console.warn('Failed to start trace, continuing without tracing:', traceResult.error);
      }
    } catch (traceErr) {
      console.warn('Trace start failed, continuing without tracing:', traceErr);
    }

    // Mark excluded prompts as skipped immediately and create skipped spans
    for (const excludedPrompt of excludedPrompts) {
      markPromptSkipped(excludedPrompt.row_id, excludedPrompt.prompt_name);
      
      // Create a skipped span for tracing completeness
      if (traceId) {
        try {
          const skipSpanResult = await createSpan({
            trace_id: traceId,
            prompt_row_id: excludedPrompt.row_id,
            span_type: 'generation',
          });
          if (skipSpanResult.success) {
            await completeSpan({
              span_id: skipSpanResult.span_id,
              status: 'skipped',
              output: 'Excluded from cascade via exclude_from_cascade flag',
              latency_ms: 0,
            });
          }
        } catch (spanErr) {
          console.warn('Failed to create skipped span for excluded prompt:', spanErr);
        }
      }
      
      toast.info(`Skipped: ${excludedPrompt.prompt_name}`, {
        description: 'Excluded from cascade',
        source: 'useCascadeExecutor',
        details: JSON.stringify({
          promptRowId: excludedPrompt.row_id,
          reason: 'exclude_from_cascade flag is true',
        }, null, 2),
      });
    }

    const accumulatedResponses = [];
    let promptIndex = 0;
    
    // Track executed prompts for q.ref[UUID] resolution within cascade
    const promptDataMap = new Map();

    try {
      // Process ALL levels starting from level 0 (top-level prompt)
      for (let levelIdx = 0; levelIdx < hierarchy.levels.length; levelIdx++) {
        const level = hierarchy.levels[levelIdx];

        for (const prompt of level.prompts) {
          // Skip if excluded from cascade
          if (prompt.exclude_from_cascade) {
            console.log(`Skipping excluded prompt: ${prompt.prompt_name}`);
            continue;
          }


          // Check if cancelled (toast is shown by context's cancel function)
          if (isCancelled()) {
            completeCascade();
            return;
          }

          // Wait if paused (toast is shown by context's cancel function if cancelled while paused)
          const shouldContinue = await waitWhilePaused();
          if (!shouldContinue) {
            completeCascade();
            return;
          }

          promptIndex++;
          updateProgress(levelIdx, prompt.prompt_name, promptIndex, prompt.row_id);

          const promptStartTime = Date.now();

          // Notify prompt starting
          toast.info(`Running: ${prompt.prompt_name}`, {
            description: `Prompt ${promptIndex} of ${nonExcludedPrompts.length} (Level ${levelIdx})`,
            source: 'useCascadeExecutor',
            details: JSON.stringify({
              promptRowId: prompt.row_id,
              promptName: prompt.prompt_name,
              level: levelIdx,
              index: promptIndex,
              total: nonExcludedPrompts.length,
              model: prompt.model || '(uses default)',
            }, null, 2),
          });

          // Build template variables from accumulated context AND system variables
          // Pass promptDataMap for q.ref[UUID] resolution of already-executed prompts
          // FIXED: Use immediate parent (not topLevelPrompt) for correct q.parent.prompt.name resolution
          const immediateParent = await getImmediateParent(prompt);
          const templateVars = buildCascadeVariables(accumulatedResponses, levelIdx, prompt, immediateParent, currentUser, promptDataMap, topLevelPrompt);
          
          // Debug logging for variable resolution verification
          console.log('Cascade variable resolution:', {
            promptName: prompt.prompt_name,
            immediateParentName: immediateParent?.prompt_name || '(none)',
            topLevelName: topLevelPrompt?.prompt_name || '(none)',
            resolvedVars: {
              'q.parent.prompt.name': templateVars['q.parent.prompt.name'] || '(empty)',
              'q.toplevel.prompt.name': templateVars['q.toplevel.prompt.name'] || '(empty)',
            }
          });

          // Fetch user-defined variables for this prompt
          const { data: userVariables } = await supabase
            .from(import.meta.env.VITE_PROMPT_VARIABLES_TBL || 'q_prompt_variables')
            .select('variable_name, variable_value, default_value')
            .eq('prompt_row_id', prompt.row_id);

          // Build user variables map
          const userVarsMap = (userVariables || []).reduce((acc, v) => {
            if (v.variable_name) {
              acc[v.variable_name] = v.variable_value || v.default_value || '';
            }
            return acc;
          }, {});

          // Merge user variables into template vars
          const mergedTemplateVars = {
            ...templateVars,
            ...userVarsMap,
          };

          // Log variables to notifications
          notify.info(`Variables for: ${prompt.prompt_name}`, {
            description: `${Object.keys(mergedTemplateVars).length} variables resolved (${Object.keys(userVarsMap).length} user vars)`,
            source: 'useCascadeExecutor.executeCascade',
            details: JSON.stringify({
              promptRowId: prompt.row_id,
              promptName: prompt.prompt_name,
              level: levelIdx,
              variableCount: Object.keys(mergedTemplateVars).length,
              userVariableCount: Object.keys(userVarsMap).length,
              variables: mergedTemplateVars,
            }, null, 2),
          });

          let success = false;
          let retryCount = 0;
          const maxRetries = 3;
          let currentSpanId = null;

          let rateLimitWaits = 0;
          const maxRateLimitWaits = 12;

          while (!success && retryCount < maxRetries) {
            // Create span for this attempt
            if (traceId) {
              try {
                const spanResult = await createSpan({
                  trace_id: traceId,
                  prompt_row_id: prompt.row_id,
                  span_type: retryCount > 0 ? 'retry' : 'generation',
                  attempt_number: retryCount + 1,
                  previous_attempt_span_id: currentSpanId,
                });
                if (spanResult.success) {
                  currentSpanId = spanResult.span_id;
                }
              } catch (spanErr) {
                console.warn('Failed to create span:', spanErr);
              }
            }

            try {
              // Refresh the auth session before each prompt to prevent token expiration
              try {
                const { error: refreshError } = await supabaseClient.auth.refreshSession();
                if (refreshError) {
                  console.warn('Session refresh warning:', refreshError.message);
                }
              } catch (refreshErr) {
                console.warn('Session refresh failed, continuing with existing session:', refreshErr);
              }

              // Build the user message - fallback to admin prompt or configured default if empty
              const userMessage = getPromptMessage(prompt, cascadeFallbackMessage);

              // Pass input_admin_prompt as a template variable for system context
              const extendedTemplateVars = {
                ...mergedTemplateVars,
                cascade_admin_prompt: prompt.input_admin_prompt || '',
              };

              // Detect if this prompt uses a Manus model
              const promptModel = prompt.model;
              const isManus = promptModel && isManusModel(promptModel);
              
              let result;
              
              if (isManus) {
                // Use Manus task execution path
                console.log(`Cascade: Using Manus provider for ${prompt.prompt_name}`);
                result = await runManusTask({
                  prompt,
                  userMessage,
                  templateVariables: extendedTemplateVars,
                  traceId,
                });
              } else {
                // Standard OpenAI conversation path
                result = await runConversation({
                  conversationRowId: parentAssistantRowId,
                  childPromptRowId: prompt.row_id,
                  userMessage: userMessage,
                  threadMode: 'new', // Force new thread for cascade isolation
                  childThreadStrategy: 'parent', // Use parent thread for context continuity
                  template_variables: extendedTemplateVars,
                  store_in_history: false,
                });
              }

              // Question handling loop for question nodes
              const MAX_QUESTION_ATTEMPTS = prompt.question_config?.max_questions || 10;
              let questionAttempts = 0;
              
              while (result?.interrupted && result.interruptType === 'question' && questionAttempts < MAX_QUESTION_ATTEMPTS) {
                questionAttempts++;
                
                const answer = await showQuestion({
                  question: result.interruptData.question,
                  variableName: result.interruptData.variableName,
                  description: result.interruptData.description,
                  promptName: prompt.prompt_name,
                  maxQuestions: MAX_QUESTION_ATTEMPTS,
                });
                
                if (answer === null) {
                  // User cancelled - stop cascade
                  console.log('User cancelled question - stopping cascade');
                  completeCascade();
                  return;
                }
                
                // Track in context state
                addCollectedQuestionVar(result.interruptData.variableName, answer);
                
                // Add to template vars for downstream prompts
                mergedTemplateVars[result.interruptData.variableName] = answer;
                
                // Resume with answer
                result = await runConversation({
                  conversationRowId: parentAssistantRowId,
                  childPromptRowId: prompt.row_id,
                  userMessage: null,
                  template_variables: { ...extendedTemplateVars, [result.interruptData.variableName]: answer },
                  store_in_history: false,
                  // Resume parameters
                  resumeResponseId: result.interruptData.responseId,
                  resumeAnswer: answer,
                  resumeVariableName: result.interruptData.variableName,
                  resumeCallId: result.interruptData.callId,
                });
                
                if (isCancelled()) {
                  completeCascade();
                  return;
                }
              }

              // Handle GPT-5 background mode: wait for completion via polling/realtime
              if (result?.interrupted && result.interruptType === 'long_running') {
                const bgResponseId = result.interruptData?.responseId;
                if (!bgResponseId) {
                  console.error('executeCascade: No responseId in long_running interrupt data');
                  result = { response: null };
                } else {
                  try {
                    toast.info(`Background processing: ${prompt.prompt_name}`, {
                      description: 'Waiting for background processing to complete...',
                      source: 'useCascadeExecutor',
                    });

                    const bgResult: BackgroundWaitResult = await waitForBackgroundResponse(bgResponseId);

                    if (bgResult.success && bgResult.response != null) {
                      result = {
                        response: bgResult.response,
                        response_id: bgResult.response_id || bgResponseId,
                      };

                      // Update the prompt output in DB (same as executeChildCascade)
                      await supabase
                        .from(import.meta.env.VITE_PROMPTS_TBL)
                        .update({
                          output_response: bgResult.response,
                          user_prompt_result: bgResult.response,
                          updated_at: new Date().toISOString(),
                        })
                        .eq('row_id', prompt.row_id);
                    } else {
                      // Fallback: check if webhook/poll already updated the prompt directly
                      const { data: freshPrompt } = await supabase
                        .from(import.meta.env.VITE_PROMPTS_TBL)
                        .select('output_response')
                        .eq('row_id', prompt.row_id)
                        .maybeSingle();

                      if (freshPrompt?.output_response != null && freshPrompt.output_response !== '') {
                        console.log('executeCascade: Recovered response from prompt DB fallback');
                        result = {
                          response: freshPrompt.output_response,
                          response_id: bgResponseId,
                        };
                      } else {
                        console.error('executeCascade: Background response failed and no DB fallback available');
                        result = { response: null };
                      }
                    }
                  } catch (bgError: unknown) {
                    console.error('executeCascade: Background wait error:', bgError);
                    result = { response: null };
                  }
                }
              }
              
              // If still interrupted after max attempts, treat as error
              if (result?.interrupted) {
                console.error('Max questions exceeded for prompt:', prompt.prompt_name);
                // Continue with cascade but mark as failed
                result = { success: false, error: 'Max questions exceeded' };
              }

              // Check if cancelled during the call
              if (result?.cancelled) {
                console.log('Prompt was cancelled by user');
                if (traceId) {
                  try {
                    await completeTrace({ trace_id: traceId, status: 'cancelled' });
                  } catch (traceErr) {
                    console.warn('Failed to complete trace as cancelled:', traceErr);
                  }
                }
                completeCascade();
                return;
              }

              // Also check the cancel flag (user might have clicked stop)
              if (isCancelled()) {
                console.log('Cascade cancelled by user');
                completeCascade();
                return;
              }

              if (result?.response != null) {
                const promptElapsedMs = Date.now() - promptStartTime;
                
                // Complete the span successfully
                if (traceId && currentSpanId) {
                  try {
                    await completeSpan({
                      span_id: currentSpanId,
                      status: 'success',
                      openai_response_id: result.response_id,
                      output: result.response,
                      latency_ms: promptElapsedMs,
                      usage_tokens: result.usage ? {
                        input: result.usage.input_tokens || result.usage.prompt_tokens || 0,
                        output: result.usage.output_tokens || result.usage.completion_tokens || 0,
                        total: result.usage.total_tokens || ((result.usage.input_tokens || result.usage.prompt_tokens || 0) + (result.usage.output_tokens || result.usage.completion_tokens || 0)),
                      } : undefined,
                    });
                    // Update context snapshot for subsequent prompts
                    contextSnapshot[prompt.row_id] = result.response;
                  } catch (spanErr) {
                    console.warn('Failed to complete span:', spanErr);
                  }
                }
                
                accumulatedResponses.push({
                  level: levelIdx,
                  promptRowId: prompt.row_id,
                  promptName: prompt.prompt_name,
                  response: result.response,
                });

                // Store in promptDataMap for q.ref[UUID] resolution in subsequent prompts
                promptDataMap.set(prompt.row_id, {
                  output_response: result.response,
                  user_prompt_result: result.response,
                  prompt_name: prompt.prompt_name,
                  input_admin_prompt: prompt.input_admin_prompt || '',
                  input_user_prompt: prompt.input_user_prompt || '',
                  system_variables: prompt.system_variables || {},
                });

                markPromptComplete(prompt.row_id, prompt.prompt_name, result.response);

                // Yield to event loop to keep UI responsive during cascade
                await new Promise(resolve => setTimeout(resolve, 0));

                // Update the prompt's user_prompt_result and output_response in database
                const updateData = { 
                  user_prompt_result: result.response,
                  output_response: result.response 
                };

                // Handle action nodes: parse JSON response and execute post-action
                // Safety: run if node_type is 'action' OR if post_action is configured (DB trigger ensures consistency)
                const hasPostAction = !!prompt.post_action;
                const isActionEffective = prompt.node_type === 'action' || hasPostAction;
                
                if (isActionEffective && result.response && hasPostAction) {
                  // Warn if state is inconsistent
                  if (hasPostAction && prompt.node_type !== 'action') {
                    console.warn(`Cascade: Prompt ${prompt.row_id} has post_action but node_type='${prompt.node_type}'. Executing anyway.`);
                  }
                  try {
                    // Extract JSON from response
                    let jsonResponse;
                    try {
                      jsonResponse = extractJsonFromResponse(result.response);
                    } catch (parseError) {
                      // Provide detailed parsing error
                      const responsePreview = result.response.substring(0, 300);
                      const expectedPath = prompt.post_action_config?.json_path || 'sections';
                      
                      console.error('JSON parsing failed:', {
                        error: parseError.message,
                        responsePreview,
                        expectedPath,
                        promptName: prompt.prompt_name,
                      });
                      
                      toast.error(`Action node response is not valid JSON`, {
                        description: `${prompt.prompt_name}: ${parseError.message}`,
                        source: 'useCascadeExecutor.jsonParse',
                        details: JSON.stringify({
                          error: parseError.message,
                          responsePreview: responsePreview + (result.response.length > 300 ? '...' : ''),
                          responseLength: result.response.length,
                          expectedArrayPath: expectedPath,
                          tip: 'Ensure the AI prompt explicitly requests JSON output matching the schema',
                        }, null, 2),
                      });
                      
                      // Store error in last_action_result
                      updateData.last_action_result = {
                        status: 'failed',
                        error: `JSON parse error: ${parseError.message}`,
                        response_preview: responsePreview,
                        executed_at: new Date().toISOString(),
                      };
                      
                      throw parseError;
                    }
                    
                    updateData.extracted_variables = jsonResponse;

                    // Process variable assignments if configured (BEFORE post-action)
                    if (prompt.variable_assignments_config?.enabled && jsonResponse) {
                      try {
                        const { processVariableAssignments } = await import('@/services/actionExecutors');
                        const varResult = await processVariableAssignments({
                          supabase: supabaseClient,
                          promptRowId: prompt.row_id,
                          jsonResponse,
                          config: prompt.variable_assignments_config,
                          onVariablesChanged: (promptId) => {
                            window.dispatchEvent(new CustomEvent('q:prompt-variables-updated', { 
                              detail: { promptRowId: promptId } 
                            }));
                          },
                        });
                        if (varResult.processed > 0) {
                          toast.success(`Updated ${varResult.processed} variable(s)`, {
                            source: 'useCascadeExecutor.variableAssignments',
                          });
                        }
                        if (varResult.errors?.length > 0) {
                          console.warn('Variable assignment errors:', varResult.errors);
                        }
                      } catch (varError) {
                        console.warn('Variable assignments failed:', varError);
                      }
                    }
                    // Execute post-action if configured
                    if (prompt.post_action) {
                      const actionConfig = prompt.post_action_config || {};
                      
                      // Use shared validation utility
                      const validation = validateActionResponse(jsonResponse, actionConfig, prompt.post_action);
                      
                      if (!validation.valid) {
                        toast.error(`Action validation failed`, {
                          description: validation.error,
                          source: 'useCascadeExecutor.preValidation',
                          details: JSON.stringify({
                            configuredPath: actionConfig.json_path,
                            valueAtPath: validation.valueAtPath,
                            availableArrays: validation.availableArrays,
                            responseKeys: validation.responseKeys,
                            suggestion: validation.suggestion,
                          }, null, 2),
                        });
                        
                        updateData.last_action_result = {
                          status: 'failed',
                          error: validation.error,
                          available_arrays: validation.availableArrays,
                          executed_at: new Date().toISOString(),
                        };
                        
                        // Continue to next prompt - don't execute action
                        continue;
                      }
                      
                      if (validation.isEmpty) {
                        toast.warning(`Array at "${validation.jsonPath}" is empty - no children will be created`, {
                          source: 'useCascadeExecutor.preValidation',
                        });
                        
                        // Create a span to track the empty array case
                        if (traceId) {
                          try {
                            const emptySpanResult = await createSpan({
                              trace_id: traceId,
                              prompt_row_id: prompt.row_id,
                              span_type: 'action',
                            });
                            if (emptySpanResult.success) {
                              await completeSpan({
                                span_id: emptySpanResult.span_id,
                                status: 'success',
                                output: `Action skipped: Array at "${validation.jsonPath}" is empty`,
                                latency_ms: 0,
                              });
                            }
                          } catch (spanErr) {
                            console.warn('Failed to create span for empty array case:', spanErr);
                          }
                        }
                      }
                      
                      // Show preview unless skip_preview is true or skipAllPreviews is enabled
                      const skipPreview = actionConfig.skip_preview === true || skipAllPreviews;
                      
                      if (!skipPreview && prompt.post_action === 'create_children_json') {
                        const confirmed = await showActionPreview({
                          jsonResponse,
                          config: prompt.post_action_config,
                          promptName: prompt.prompt_name,
                        });
                        
                        if (!confirmed) {
                          toast.info('Action cancelled by user');
                          
                          updateData.last_action_result = {
                            status: 'cancelled',
                            reason: 'user_cancelled',
                            executed_at: new Date().toISOString(),
                          };
                          
                          // Save the update and continue to next prompt
                          await supabase
                            .from(import.meta.env.VITE_PROMPTS_TBL)
                            .update(updateData)
                            .eq('row_id', prompt.row_id);
                          
                          continue;
                        }
                      }
                      
                      const actionResult = await executePostAction({
                        supabase,
                        prompt,
                        jsonResponse,
                        actionId: prompt.post_action,
                        config: prompt.post_action_config,
                        context: { userId: currentUser?.id },
                      });

                      // Store execution result
                      updateData.last_action_result = {
                        status: actionResult.success ? 'success' : 'failed',
                        created_count: actionResult.createdCount || 0,
                        target_parent_id: actionResult.targetParentRowId,
                        message: actionResult.message,
                        error: actionResult.error || null,
                        executed_at: new Date().toISOString(),
                      };

                      if (actionResult.success) {
                        toast.success(`Action completed: ${actionResult.message}`, {
                          source: 'useCascadeExecutor.postAction',
                          details: JSON.stringify({
                            action: prompt.post_action,
                            createdCount: actionResult.createdCount,
                            targetParent: actionResult.targetParentRowId,
                            children: actionResult.children?.slice(0, 5).map(c => c.prompt_name),
                          }, null, 2),
                        });
                        
                        // Dispatch event to refresh tree after action creates children
                        if (actionResult.createdCount > 0) {
                          window.dispatchEvent(new CustomEvent('tree-refresh-needed', {
                            detail: { 
                              reason: 'post_action',
                              createdCount: actionResult.createdCount,
                              parentRowId: actionResult.targetParentRowId || prompt.row_id,
                            }
                          }));
                        }
                      } else {
                        toast.warning(`Action failed: ${actionResult.error}`, {
                          source: 'useCascadeExecutor.postAction',
                          details: JSON.stringify({
                            action: prompt.post_action,
                            config: prompt.post_action_config,
                            error: actionResult.error,
                          }, null, 2),
                        });
                      }
                    }
                  } catch (jsonError) {
                    // Only log if not already handled above
                    if (!updateData.last_action_result) {
                      console.warn('Action node error:', jsonError);
                      toast.warning(`Action node error: ${jsonError.message}`, {
                        description: prompt.prompt_name,
                        source: 'useCascadeExecutor',
                      });
                    }
                  }
                }

                await supabase
                  .from(import.meta.env.VITE_PROMPTS_TBL)
                  .update(updateData)
                  .eq('row_id', prompt.row_id);

                // Dispatch event to refresh the UI if this prompt is currently selected
                window.dispatchEvent(new CustomEvent('prompt-result-updated', {
                  detail: { promptRowId: prompt.row_id }
                }));

                // Notify prompt completed
                toast.success(`Completed: ${prompt.prompt_name}`, {
                  description: `${promptElapsedMs}ms • ${result.response.length} chars`,
                  source: 'useCascadeExecutor',
                  details: JSON.stringify({
                    promptRowId: prompt.row_id,
                    promptName: prompt.prompt_name,
                    level: levelIdx,
                    index: promptIndex,
                    elapsedMs: promptElapsedMs,
                    responseLength: result.response.length,
                    responsePreview: result.response.substring(0, 200) + (result.response.length > 200 ? '...' : ''),
                    tokensInput: result.usage?.input_tokens || null,
                    tokensOutput: result.usage?.output_tokens || null,
                    model: result.model || prompt.model || 'unknown',
                    isActionNode: prompt.node_type === 'action',
                  }, null, 2),
                });

                success = true;
              } else {
                throw new Error('No response received');
              }
            } catch (error) {
              console.error('Cascade prompt error:', error);

              const delayMs = getRetryDelayMs(error);
              const isRateLimited = delayMs > 0;

              // Fail the span with error evidence (only if not rate limited, to avoid double-fail)
              if (traceId && currentSpanId && !isRateLimited) {
                try {
                  await failSpan({
                    span_id: currentSpanId,
                    error_evidence: {
                      error_type: error.name || 'Error',
                      error_message: error.message,
                      error_code: error.code || error.status?.toString(),
                      retry_recommended: retryCount < maxRetries,
                    },
                  });
                } catch (spanErr) {
                  console.warn('Failed to fail span:', spanErr);
                }
              }

              if (isRateLimited) {
                rateLimitWaits++;
                if (rateLimitWaits > maxRateLimitWaits) {
                  toast.error(`Rate limit exceeded for: ${prompt.prompt_name}`, {
                    description: `Max retries (${maxRateLimitWaits}) exceeded`,
                    source: 'useCascadeExecutor',
                    errorCode: 'RATE_LIMIT_MAX_RETRIES',
                    details: JSON.stringify({
                      promptRowId: prompt.row_id,
                      promptName: prompt.prompt_name,
                      rateLimitWaits,
                      maxRateLimitWaits,
                      error: error.message,
                    }, null, 2),
                  });
                  throw error;
                }
                toast.warning(`Rate limited: ${prompt.prompt_name}`, {
                  description: `Waiting ${Math.round(delayMs / 1000)}s before retry (${rateLimitWaits}/${maxRateLimitWaits})`,
                  source: 'useCascadeExecutor',
                  errorCode: 'RATE_LIMITED',
                  details: JSON.stringify({
                    promptRowId: prompt.row_id,
                    promptName: prompt.prompt_name,
                    delayMs,
                    rateLimitWaits,
                    maxRateLimitWaits,
                  }, null, 2),
                });
                
                // Fail the current span before retrying to avoid orphaned running spans
                if (traceId && currentSpanId) {
                  try {
                    await failSpan({
                      span_id: currentSpanId,
                      error_evidence: {
                        error_type: 'RATE_LIMITED',
                        error_message: `Rate limited, waiting ${Math.round(delayMs / 1000)}s before retry`,
                        error_code: '429',
                        retry_recommended: true,
                      },
                    });
                  } catch (spanErr) {
                    console.warn('Failed to fail span for rate limit:', spanErr);
                  }
                }
                
                console.log(`Rate limited; waiting ${delayMs}ms before retrying...`);
                await new Promise(resolve => setTimeout(resolve, delayMs));
                continue;
              }

              retryCount++;

              // Notify retry attempt
              if (retryCount < maxRetries) {
                toast.warning(`Retrying: ${prompt.prompt_name}`, {
                  description: `Attempt ${retryCount + 1} of ${maxRetries}`,
                  source: 'useCascadeExecutor',
                  errorCode: 'RETRY_ATTEMPT',
                  details: JSON.stringify({
                    promptRowId: prompt.row_id,
                    promptName: prompt.prompt_name,
                    retryCount,
                    maxRetries,
                    error: error.message,
                    errorStack: error.stack,
                  }, null, 2),
                });
              }

              if (retryCount >= maxRetries) {
                // Parse error for user-friendly display
                const parsed = parseApiError(error);
                const formatted = formatErrorForDisplay(error, prompt.prompt_name);
                
                // For non-recoverable errors like quota exceeded, show immediately and stop
                if (isQuotaError(error)) {
                  toast.error(formatted.title, {
                    description: formatted.description,
                    duration: 10000,
                    source: 'useCascadeExecutor',
                    errorCode: parsed.code,
                  });
                  completeCascade();
                  return;
                }
                
                // Notify max retries reached with friendly message
                toast.error(formatted.title, {
                  description: formatted.description,
                  source: 'useCascadeExecutor',
                  errorCode: parsed.code,
                  details: JSON.stringify({
                    promptRowId: prompt.row_id,
                    promptName: prompt.prompt_name,
                    retryCount,
                    maxRetries,
                    errorCode: parsed.code,
                    error: error.message,
                  }, null, 2),
                });

                // Show error dialog with user-friendly message
                const action = await showError(
                  { name: prompt.prompt_name, rowId: prompt.row_id },
                  formatted.description
                );

                if (action === 'stop') {
                  toast.error('Cascade run stopped by user', {
                    description: `Stopped at ${prompt.prompt_name}`,
                    source: 'useCascadeExecutor',
                    errorCode: 'USER_STOPPED',
                    details: JSON.stringify({
                      stoppedAtPrompt: prompt.prompt_name,
                      completedPrompts: promptIndex - 1,
                      totalPrompts: nonExcludedPrompts.length,
                      elapsedMs: Date.now() - cascadeStartTime,
                    }, null, 2),
                  });
                  completeCascade();
                  return;
                } else if (action === 'skip') {
                  // Complete the span as skipped before continuing
                  if (traceId && currentSpanId) {
                    try {
                      await completeSpan({
                        span_id: currentSpanId,
                        status: 'skipped',
                        output: `User skipped after error: ${error.message}`,
                        latency_ms: Date.now() - promptStartTime,
                      });
                    } catch (spanErr) {
                      console.warn('Failed to complete span as skipped:', spanErr);
                    }
                  }
                  
                  // Skip this prompt and continue
                  accumulatedResponses.push({
                    level: levelIdx,
                    promptRowId: prompt.row_id,
                    promptName: prompt.prompt_name,
                    response: `[SKIPPED: ${error.message}]`,
                    skipped: true,
                  });
                  toast.warning(`Skipped: ${prompt.prompt_name}`, {
                    description: 'User chose to skip after error',
                    source: 'useCascadeExecutor',
                    errorCode: 'USER_SKIPPED',
                    details: JSON.stringify({
                      promptRowId: prompt.row_id,
                      promptName: prompt.prompt_name,
                      error: error.message,
                    }, null, 2),
                  });
                  success = true;
                } else if (action === 'retry') {
                  retryCount = 0; // Reset retry count and try again
                  rateLimitWaits = 0; // Also reset rate limit waits on user retry
                  toast.info(`Retrying: ${prompt.prompt_name}`, {
                    description: 'User requested retry',
                    source: 'useCascadeExecutor',
                    details: JSON.stringify({
                      promptRowId: prompt.row_id,
                      promptName: prompt.prompt_name,
                    }, null, 2),
                  });
                }
              }
            }
          }
        }
        
        // Yield to event loop between levels to keep UI responsive
        await new Promise(resolve => setTimeout(resolve, 0));
      }

      const totalElapsedMs = Date.now() - cascadeStartTime;

      // Complete execution trace
      if (traceId) {
        try {
          await completeTrace({ trace_id: traceId, status: 'completed' });
        } catch (traceErr) {
          console.warn('Failed to complete trace:', traceErr);
        }
      }

      // Complete cascade
      completeCascade();
      toast.success(`Cascade run completed!`, {
        description: `${accumulatedResponses.length} prompts in ${Math.round(totalElapsedMs / 1000)}s`,
        source: 'useCascadeExecutor',
        details: JSON.stringify({
          completedPrompts: accumulatedResponses.length,
          skippedPrompts: accumulatedResponses.filter(r => r.skipped).length,
          totalElapsedMs,
          promptSummary: accumulatedResponses.map(r => ({
            name: r.promptName,
            level: r.level,
            skipped: r.skipped || false,
            responseLength: r.response?.length || 0,
          })),
        }, null, 2),
      });
      
      // Track cascade completion
      trackEvent('cascade_completed', {
        top_level_prompt_id: topLevelRowId,
        top_level_prompt_name: topLevelPrompt?.prompt_name,
        total_prompts_run: accumulatedResponses.length,
        skipped_prompts: accumulatedResponses.filter(r => r.skipped).length,
        elapsed_ms: totalElapsedMs,
        success: true,
      });

    } catch (error) {
      console.error('Cascade execution error:', error);
      
      // Complete trace with failed status
      if (traceId) {
        try {
          await completeTrace({ 
            trace_id: traceId, 
            status: 'failed',
            error_summary: error.message,
          });
        } catch (traceErr) {
          console.warn('Failed to complete trace on error:', traceErr);
        }
      }
      
      completeCascade();
      toast.error(`Cascade failed: ${error.message}`, {
        source: 'useCascadeExecutor',
        errorCode: 'CASCADE_FAILED',
        details: JSON.stringify({
          error: error.message,
          errorStack: error.stack,
          completedPrompts: accumulatedResponses.length,
          elapsedMs: Date.now() - cascadeStartTime,
        }, null, 2),
      });
      
      // Track cascade failure
      trackEvent('cascade_completed', {
        top_level_prompt_id: topLevelRowId,
        top_level_prompt_name: topLevelPrompt?.prompt_name,
        total_prompts_run: accumulatedResponses.length,
        elapsed_ms: Date.now() - cascadeStartTime,
        success: false,
        error_message: error.message,
      });
      trackException(error, {
        context: 'cascade_execution',
        top_level_prompt_id: topLevelRowId,
      });
    } finally {
      // Unregister cancel handler and ApiCallContext
      unregisterCancel();
      cleanupCall();
    }
  }, [
    supabase,
    fetchCascadeHierarchy,
    startCascade,
    updateProgress,
    markPromptComplete,
    markPromptSkipped,
    completeCascade,
    isCancelled,
    waitWhilePaused,
    buildCascadeVariables,
    runConversation,
    cancelRun,
    showError,
    getRetryDelayMs,
    registerCall,
    registerCancelHandler,
    startTrace,
    createSpan,
    completeSpan,
    failSpan,
    completeTrace,
    showActionPreview,
    skipAllPreviews,
    isManusModel,
    runManusTask,
  ]);

  // Check if a prompt has children (for showing cascade button)
  const hasChildren = useCallback(async (promptRowId) => {
    if (!supabase) return false;

    const { count, error } = await supabase
      .from(import.meta.env.VITE_PROMPTS_TBL)
      .select('row_id', { count: 'exact', head: true })
      .eq('parent_row_id', promptRowId)
      .eq('is_deleted', false);

    if (error) {
      console.error('Error checking children:', error);
      return false;
    }

    return (count || 0) > 0;
  }, [supabase]);

  /**
   * Execute a mini-cascade on newly created child prompts (Auto-Run Children feature)
   * 
   * @param {Array} children - Array of newly created child prompt objects
   * @param {Object} parentPrompt - The parent prompt that created these children
   * @param {Object} options - Execution options
   * @param {number} options.maxDepth - Maximum recursion depth (default 99)
   * @param {number} options.currentDepth - Current recursion depth (default 0)
   * @param {Object} options.inheritedVariables - Variables to pass to children
    * @returns {Promise<{ success: boolean, results: Array, depthLimitReached?: boolean }>}
    */

  interface BackgroundWaitResult {
    response: string | null;
    success: boolean;
    response_id?: string;
  }

  /**
   * Wait for a background (GPT-5) response via Realtime subscription + polling fallback.
   * Mirrors the proven pattern from runManusTask (line 177).
   */
  const waitForBackgroundResponse = async (
    responseId: string,
    timeoutMs: number = 600_000,
    pollIntervalMs: number = 10_000
  ): Promise<BackgroundWaitResult> => {
    return new Promise<BackgroundWaitResult>((resolve) => {
      let resolved = false;
      let subscription: ReturnType<typeof supabaseClient.channel> | null = null;
      let pollTimer: ReturnType<typeof setInterval> | null = null;
      let cancelCheckTimer: ReturnType<typeof setInterval> | null = null;
      let timeoutTimer: ReturnType<typeof setTimeout> | null = null;

      const cleanup = () => {
        if (subscription) {
          supabaseClient.removeChannel(subscription);
          subscription = null;
        }
        if (pollTimer) {
          clearInterval(pollTimer);
          pollTimer = null;
        }
        if (cancelCheckTimer) {
          clearInterval(cancelCheckTimer);
          cancelCheckTimer = null;
        }
        if (timeoutTimer) {
          clearTimeout(timeoutTimer);
          timeoutTimer = null;
        }
      };

      const finish = (result: BackgroundWaitResult) => {
        if (resolved) return;
        resolved = true;
        cleanup();
        resolve(result);
      };

      // 1. Realtime subscription on q_pending_responses (same pattern as runManusTask)
      subscription = supabaseClient
        .channel(`bg-wait-${responseId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'q_pending_responses',
            filter: `response_id=eq.${responseId}`,
          },
          (payload) => {
            const row = payload.new;
            console.log(`[waitForBg] Realtime event for ${responseId}: status=${row?.status}`);
            if (row?.status === 'completed') {
              finish({ response: row.output_text ?? '', success: true, response_id: responseId });
            } else if (row && ['failed', 'cancelled', 'incomplete'].includes(row.status)) {
              console.error(`[waitForBg] Realtime: terminal status ${row.status} for ${responseId}`, row.error);
              finish({ response: null, success: false });
            }
          }
        )
        .subscribe((status) => {
          console.log(`[waitForBg] Channel status for ${responseId}: ${status}`);
        });

      // 2. Polling fallback (every pollIntervalMs)
      const doPoll = async () => {
        if (resolved) return;
        try {
          // DB check first
          const { data, error: dbError } = await supabaseClient
            .from('q_pending_responses')
            .select('status, output_text, error')
            .eq('response_id', responseId)
            .maybeSingle();

          if (dbError) {
            console.warn(`[waitForBg] DB poll error for ${responseId}:`, dbError.message);
          } else if (data?.status === 'completed') {
            console.log(`[waitForBg] DB poll: completed for ${responseId}`);
            finish({ response: data.output_text ?? '', success: true, response_id: responseId });
            return;
          } else if (data && ['failed', 'cancelled', 'incomplete'].includes(data.status)) {
            console.log(`[waitForBg] DB poll: terminal ${data.status} for ${responseId}`);
            finish({ response: null, success: false });
            return;
          }

          // Edge function poll as fallback
          const { data: pollData, error: pollError } = await supabaseClient
            .functions.invoke('poll-openai-response', {
              body: { response_id: responseId },
            });

          if (pollError) {
            console.warn(`[waitForBg] Edge poll error for ${responseId}:`, pollError.message);
          } else if (pollData?.status === 'completed') {
            console.log(`[waitForBg] Edge poll: completed for ${responseId}`);
            finish({ response: pollData.output_text ?? '', success: true, response_id: responseId });
          }
        } catch (e) {
          console.warn(`[waitForBg] Poll exception for ${responseId}:`, e);
        }
      };

      pollTimer = setInterval(doPoll, pollIntervalMs);

      // 3. Cancellation check (every second)
      cancelCheckTimer = setInterval(() => {
        if (resolved) return;
        if (isCancelled()) {
          console.log(`[waitForBg] Cancelled for ${responseId}`);
          finish({ response: null, success: false });
        }
      }, 1000);

      // 4. Timeout
      timeoutTimer = setTimeout(() => {
        if (resolved) return;
        console.error(`[waitForBg] Timed out after ${timeoutMs}ms for ${responseId}`);
        finish({ response: null, success: false });
      }, timeoutMs);

      // 5. Immediate initial check (don't wait for first poll interval)
      doPoll();
    });
  };

   const executeChildCascade = useCallback(async (
    children,
    parentPrompt,
    options = {}
  ) => {
    const { 
      maxDepth = 99, 
      currentDepth = 0,
      inheritedVariables = {},
      traceId: passedTraceId = null, // Optional: trace ID from parent cascade for unified tracing
    } = options;

    if (!children || children.length === 0) {
      return { success: true, results: [] };
    }
    
    // Start our own trace if none was passed (standalone executeChildCascade call)
    let traceId = passedTraceId;
    let ownTrace = false;
    if (!traceId && parentPrompt?.row_id) {
      try {
        const traceResult = await startTrace({
          entry_prompt_row_id: parentPrompt.row_id,
          execution_type: 'cascade_child',
        });
        if (traceResult.success) {
          traceId = traceResult.trace_id;
          ownTrace = true;
          console.log('Started standalone child cascade trace:', traceId);
        }
      } catch (traceErr) {
        console.warn('Failed to start child cascade trace:', traceErr);
      }
    }

    // Depth limit check
    if (currentDepth >= maxDepth) {
      console.warn(`Auto-cascade depth limit (${maxDepth}) reached at depth ${currentDepth}, stopping recursion`);
      toast.warning(`Auto-cascade depth limit reached (${maxDepth} levels)`);
      trackEvent('auto_cascade_depth_limit', {
        max_depth: maxDepth,
        current_depth: currentDepth,
        parent_prompt_id: parentPrompt?.row_id,
      });
      // Complete our own trace before early return
      if (ownTrace && traceId) {
        try {
          await completeTrace({ trace_id: traceId, status: 'completed' });
        } catch (err) {
          console.warn('Failed to complete trace on depth limit:', err);
        }
      }
      return { success: true, results: [], depthLimitReached: true };
    }

    // Get parent's assistant row_id for conversation context
    const { data: parentAssistant } = await supabaseClient
      .from('q_assistants')
      .select('row_id')
      .eq('prompt_row_id', parentPrompt.row_id)
      .maybeSingle();

    const parentAssistantRowId = parentAssistant?.row_id;
    const results = [];

    console.log(`executeChildCascade: Running ${children.length} children at depth ${currentDepth}`);

    for (let idx = 0; idx < children.length; idx++) {
      const child = children[idx];
      
      // Check for cancellation
      if (isCancelled()) {
        console.log('Auto-cascade cancelled by user');
        break;
      }

      // Wait if paused
      const shouldContinue = await waitWhilePaused();
      if (!shouldContinue) {
        console.log('Auto-cascade stopped during pause');
        break;
      }

      // Get the child's full data (in case we only have minimal data from action result)
      const { data: childPrompt, error: fetchError } = await supabaseClient
        .from(import.meta.env.VITE_PROMPTS_TBL)
        .select('*')
        .eq('row_id', child.row_id)
        .maybeSingle();

      if (fetchError || !childPrompt) {
        console.error('executeChildCascade: Child prompt not found:', child.row_id, fetchError);
        results.push({
          promptRowId: child.row_id,
          promptName: child.prompt_name || 'Unknown',
          success: false,
          error: 'Prompt not found',
        });
        continue;
      }

      // Update progress to highlight the currently running child prompt (O(1) with indexed loop)
      updateProgress(
        currentDepth,
        childPrompt.prompt_name || 'Untitled',
        idx + 1,
        childPrompt.row_id
      );

      // Build user message
      const userMessage = getPromptMessage(childPrompt, 'Execute this prompt');

      // Fetch child's variables
      const { data: childVars } = await supabaseClient
        .from(import.meta.env.VITE_PROMPT_VARIABLES_TBL || 'q_prompt_variables')
        .select('variable_name, variable_value, default_value')
        .eq('prompt_row_id', childPrompt.row_id);

      const childVariablesMap = {};
      (childVars || []).forEach(v => {
        if (v.variable_name) {
          childVariablesMap[v.variable_name] = v.variable_value || v.default_value || '';
        }
      });

      // Merge inherited variables with child's own (child's take precedence)
      const templateVariables = {
        ...inheritedVariables,
        ...childVariablesMap,
      };

      // Create span for this child execution if we have a trace
      let childSpanId = null;
      if (traceId) {
        try {
          const spanResult = await createSpan({
            trace_id: traceId,
            prompt_row_id: childPrompt.row_id,
            span_type: 'generation',
          });
          if (spanResult.success) {
            childSpanId = spanResult.span_id;
          }
        } catch (spanErr) {
          console.warn('Failed to create span for child:', spanErr);
        }
      }
      
      const childStartTime = Date.now();

      try {
        // Detect if this child uses a Manus model
        const childModel = childPrompt.model;
        const isManus = childModel && isManusModel(childModel);
        
        let result;
        
        if (isManus) {
          // Use Manus task execution path
          console.log(`executeChildCascade: Using Manus provider for ${childPrompt.prompt_name}`);
          result = await runManusTask({
            prompt: childPrompt,
            userMessage,
            templateVariables,
            traceId,
          });
        } else {
          // Standard OpenAI conversation path
          result = await runConversation({
            conversationRowId: parentAssistantRowId,
            childPromptRowId: childPrompt.row_id,
            userMessage,
            threadMode: 'new',
            childThreadStrategy: 'parent',
            template_variables: templateVariables,
            store_in_history: false,
          });

          // Handle GPT-5 background mode: wait for completion
          if (result?.interrupted && result?.interruptType === 'long_running') {
            const bgResponseId = result.interruptData?.responseId;
            if (!bgResponseId) {
              console.error('executeChildCascade: No responseId in long_running interrupt data');
              result = { response: null };
            } else {
              try {
                console.log(`executeChildCascade: Child ${childPrompt.prompt_name} went to background mode (${bgResponseId}), waiting...`);

                toast.info(`Waiting for background response: ${childPrompt.prompt_name}`);

                const bgResult: BackgroundWaitResult = await waitForBackgroundResponse(bgResponseId);

                if (bgResult.success && bgResult.response != null) {
                  result = {
                    response: bgResult.response,
                    response_id: bgResult.response_id || bgResponseId,
                  };
                } else {
                  // Fallback: check if webhook/poll already updated the prompt directly
                  const { data: freshChild } = await supabaseClient
                    .from(import.meta.env.VITE_PROMPTS_TBL)
                    .select('output_response')
                    .eq('row_id', childPrompt.row_id)
                    .maybeSingle();

                  if (freshChild?.output_response != null && freshChild.output_response !== '') {
                    console.log('executeChildCascade: Recovered response from prompt DB fallback');
                    result = {
                      response: freshChild.output_response,
                      response_id: bgResponseId,
                    };
                  } else {
                    console.error('executeChildCascade: Background response failed and no DB fallback available');
                    result = { response: null };
                  }
                }
              } catch (bgError: unknown) {
                console.error('executeChildCascade: Background wait error:', bgError);
                result = { response: null };
              }
            }
          }
        }

        const promptResult = {
          promptRowId: childPrompt.row_id,
          promptName: childPrompt.prompt_name,
          success: result?.response != null,
          response: result?.response,
        };
        results.push(promptResult);
        
        // Complete span with success
        if (childSpanId) {
          const latencyMs = Date.now() - childStartTime;
          await completeSpan({
            span_id: childSpanId,
            status: result?.response != null ? 'success' : 'failed',
            openai_response_id: result?.response_id,
            output: result?.response,
            latency_ms: latencyMs,
            // usage_tokens: only populated for streaming results from runConversation;
            // background-mode results (waitForBackgroundResponse) never include usage data
            usage_tokens: result?.usage ? {
              input: result.usage.input_tokens || result.usage.prompt_tokens || 0,
              output: result.usage.output_tokens || result.usage.completion_tokens || 0,
              total: result.usage.total_tokens || ((result.usage.input_tokens || result.usage.prompt_tokens || 0) + (result.usage.output_tokens || result.usage.completion_tokens || 0)),
            } : undefined,
          }).catch(err => console.warn('Failed to complete child span:', err));
        }

        // Update the child prompt's output in database
        if (result?.response != null) {
          await supabaseClient
            .from(import.meta.env.VITE_PROMPTS_TBL)
            .update({
              user_prompt_result: result.response,
              output_response: result.response,
            })
            .eq('row_id', childPrompt.row_id);

          // If this child is an action node with post_action and has auto_run_children enabled
          const hasPostAction = !!childPrompt.post_action;
          const isActionNode = childPrompt.node_type === 'action' || hasPostAction;

          if (isActionNode && hasPostAction && childPrompt.auto_run_children) {
            try {
              // Extract JSON and execute post-action
              const jsonData = extractJsonFromResponse(result.response);
              
              if (jsonData) {
                // Process variable assignments if configured
                if (childPrompt.variable_assignments_config?.enabled) {
                  const { processVariableAssignments } = await import('@/services/actionExecutors');
                  await processVariableAssignments({
                    supabase: supabaseClient,
                    promptRowId: childPrompt.row_id,
                    jsonResponse: jsonData,
                    config: childPrompt.variable_assignments_config,
                    onVariablesChanged: (promptId) => {
                      window.dispatchEvent(new CustomEvent('q:prompt-variables-updated', { 
                        detail: { promptRowId: promptId } 
                      }));
                    },
                  });
                }

                // Execute post-action
                const actionResult = await executePostAction({
                  supabase: supabaseClient,
                  prompt: childPrompt,
                  jsonResponse: jsonData,
                  actionId: childPrompt.post_action,
                  config: childPrompt.post_action_config,
                  context: { userId: childPrompt.owner_id },
                });

                // Recursive auto-cascade if children were created
                if (actionResult.success && (actionResult.children?.length > 0 || actionResult.createdCount > 0)) {
                  let grandchildren = actionResult.children;
                  
                  // DB fallback if children array is empty despite createdCount > 0
                  if ((!grandchildren || grandchildren.length === 0) && actionResult.createdCount > 0) {
                    console.warn(`executeChildCascade: grandchildren array empty despite createdCount=${actionResult.createdCount}, fetching from DB`);
                    const gcParentId = actionResult.placement === 'children'
                      ? childPrompt.row_id
                      : (actionResult.targetParentRowId || childPrompt.row_id);
                    const { data: dbGrandchildren } = await supabaseClient
                      .from(import.meta.env.VITE_PROMPTS_TBL)
                      .select('row_id, prompt_name')
                      .eq('parent_row_id', gcParentId)
                      .eq('is_deleted', false)
                      .order('position_lex', { ascending: true });
                    grandchildren = dbGrandchildren || [];
                  }
                  
                  if (grandchildren.length > 0) {
                    console.log(`executeChildCascade: Recursing for ${grandchildren.length} grandchildren at depth ${currentDepth + 1}`);
                  
                    const recursiveResult = await executeChildCascade(
                      grandchildren,
                      childPrompt,
                      {
                        maxDepth,
                        currentDepth: currentDepth + 1,
                        inheritedVariables: templateVariables,
                        traceId,
                      }
                    );

                  // Add recursive results
                  results.push(...recursiveResult.results);
                  
                    if (recursiveResult.depthLimitReached) {
                      return { success: true, results, depthLimitReached: true };
                    }
                  }
                }
              }
            } catch (actionError) {
              console.error('executeChildCascade: Error in child action execution:', actionError);
              // Continue to next child, don't fail the whole cascade
            }
          }
        }

        if (promptResult.success) {
          toast.success(`Auto-run: ${childPrompt.prompt_name}`, {
            description: `Depth ${currentDepth + 1}`,
            source: 'executeChildCascade',
          });
        }

      } catch (error) {
        console.error('executeChildCascade: Error running child prompt:', childPrompt.row_id, error);
        
        // Fail span if we have one
        if (childSpanId) {
          await failSpan({
            span_id: childSpanId,
            error_evidence: {
              error_type: error.name || 'Error',
              error_message: error.message,
              retry_recommended: false,
            },
          }).catch(err => console.warn('Failed to fail child span:', err));
        }
        
        results.push({
          promptRowId: childPrompt.row_id,
          promptName: childPrompt.prompt_name,
          success: false,
          error: error.message,
        });
        // Continue to next child, don't fail the whole cascade
      }
    }

    trackEvent('auto_cascade_children_run', {
      parent_prompt_id: parentPrompt?.row_id,
      children_count: children.length,
      success_count: results.filter(r => r.success).length,
      current_depth: currentDepth,
    });

    // Complete our own trace if we started one
    if (ownTrace && traceId) {
      const hasErrors = results.some(r => !r.success);
      try {
        await completeTrace({
          trace_id: traceId,
          status: hasErrors ? 'failed' : 'completed',
          error_summary: hasErrors ? `${results.filter(r => !r.success).length} child prompts failed` : undefined,
        });
      } catch (traceErr) {
        console.warn('Failed to complete child cascade trace:', traceErr);
      }
    }

    return { success: true, results };
  }, [runConversation, isCancelled, waitWhilePaused, waitForBackgroundResponse, createSpan, completeSpan, failSpan, startTrace, completeTrace, isManusModel, runManusTask]);

  return {
    executeCascade,
    fetchCascadeHierarchy,
    hasChildren,
    executeChildCascade,
  };
};
