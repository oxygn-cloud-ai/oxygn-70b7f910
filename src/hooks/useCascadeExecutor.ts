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

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface CascadePrompt {
  row_id: string;
  prompt_name: string;
  parent_row_id?: string | null;
  input_admin_prompt?: string | null;
  input_user_prompt?: string | null;
  output_response?: string | null;
  model?: string | null;
  node_type?: string | null;
  is_assistant?: boolean;
  exclude_from_cascade?: boolean;
  post_action?: string | null;
  post_action_config?: Record<string, unknown> | null;
  auto_run_children?: boolean;
  question_config?: { max_questions?: number };
  variable_assignments_config?: { enabled?: boolean };
  system_variables?: Record<string, unknown>;
  task_mode?: string;
  owner_id?: string | null;
  position_lex?: string;
}

export interface CascadeLevel {
  level: number;
  prompts: CascadePrompt[];
}

export interface CascadeHierarchy {
  levels: CascadeLevel[];
  totalPrompts: number;
  totalLevels: number;
}

export interface AccumulatedResponse {
  level: number;
  promptRowId: string;
  promptName: string;
  response: string;
  skipped?: boolean;
}

export interface PromptLookupData {
  row_id: string;
  prompt_name: string;
  parent_row_id?: string | null;
}

export interface PromptDataMapEntry {
  output_response: string;
  user_prompt_result: string;
  prompt_name: string;
  input_admin_prompt: string;
  input_user_prompt: string;
  system_variables: Record<string, unknown>;
}

export interface ManusTaskResult {
  response: string;
  taskId: string;
  taskUrl: string;
  attachments: unknown[];
  latency_ms: number;
}

export interface ChildCascadeResult {
  promptRowId: string;
  promptName: string;
  success: boolean;
  response?: string;
  error?: string;
}

export interface ChildCascadeOptions {
  maxDepth?: number;
  currentDepth?: number;
  inheritedVariables?: Record<string, string>;
  traceId?: string | null;
}

export interface UserInfo {
  id: string;
  email?: string;
  display_name: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const MANUS_POLL_INTERVAL_MS = 2000;
const MANUS_TASK_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

// ─────────────────────────────────────────────────────────────────────────────
// Custom Error
// ─────────────────────────────────────────────────────────────────────────────

class ManusError extends Error {
  error_code: string;
  task_id: string | null;
  task_url: string | null;

  constructor(message: string, errorCode: string, taskId: string | null = null, taskUrl: string | null = null) {
    super(message);
    this.name = 'ManusError';
    this.error_code = errorCode;
    this.task_id = taskId;
    this.task_url = taskUrl;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const getPromptMessage = (prompt: CascadePrompt, fallbackMessage: string = 'Execute this prompt'): string => {
  const userPrompt = prompt.input_user_prompt?.trim();
  const adminPrompt = prompt.input_admin_prompt?.trim();
  
  if (userPrompt) return userPrompt;
  if (adminPrompt) return adminPrompt;
  
  return fallbackMessage;
};

interface ValidationIssue {
  promptRowId: string;
  promptName: string;
  issue: string;
  message: string;
}

const validatePromptContent = (prompts: CascadePrompt[]): ValidationIssue[] => {
  const issues: ValidationIssue[] = [];
  
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

// ─────────────────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────────────────

export const useCascadeExecutor = () => {
  const supabase = useSupabase();
  const { runConversation, cancelRun } = useConversationRun();
  const { registerCall } = useApiCallContext();
  const { resetCumulativeStats, addCall, removeCall } = useLiveApiDashboard();
  const { startTrace, createSpan, completeSpan, failSpan, completeTrace } = useExecutionTracing();
  const { isManusModel } = useModels();
  const manusTaskCancelRef = useRef<boolean>(false);
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
    registerCancelHandler,
    showQuestion,
    addCollectedQuestionVar,
  } = useCascadeRun();

  // Run Manus task
  const runManusTask = useCallback(async ({
    prompt,
    userMessage,
    templateVariables,
    traceId,
  }: {
    prompt: CascadePrompt;
    userMessage: string;
    templateVariables: Record<string, string>;
    traceId: string | null;
  }): Promise<ManusTaskResult> => {
    const startTime = Date.now();
    manusTaskCancelRef.current = false;

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

    const { data: createData, error: createError } = await supabaseClient.functions.invoke('manus-task-create', {
      body: {
        prompt_row_id: prompt.row_id,
        user_message: userMessage,
        system_prompt: prompt.input_admin_prompt || '',
        template_variables: templateVariables,
        trace_id: traceId,
        task_mode: prompt.task_mode || 'adaptive',
      },
    });

    if (createError || !createData?.task_id) {
      const errorMessage = createError?.message || createData?.error || 'Failed to create Manus task';
      const errorCode = createData?.error_code || 'MANUS_CREATE_FAILED';
      
      toast.error('Failed to create Manus task', {
        description: errorMessage,
      });
      
      throw new ManusError(errorMessage, errorCode);
    }

    const taskId = createData.task_id;
    
    const callId = addCall({
      provider: 'manus',
      model: prompt.model || undefined,
      promptName: prompt.prompt_name,
      manusTaskId: taskId,
      manusTaskUrl: createData.task_url,
      status: 'running',
    });

    toast.info(`Manus task started`, {
      description: prompt.prompt_name,
    });

    return new Promise((resolve, reject) => {
      let subscription: ReturnType<typeof supabaseClient.channel> | null = null;
      let pollInterval: ReturnType<typeof setInterval> | null = null;
      let timeoutId: ReturnType<typeof setTimeout> | null = null;

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

      interface ManusTask {
        task_id: string;
        task_url?: string;
        status: string;
        result_message?: string;
        attachments?: unknown[];
        stop_reason?: string;
        error_code?: string;
        requires_input?: boolean;
      }

      const handleTaskComplete = (task: ManusTask) => {
        cleanup();
        removeCall(callId);
        const latency = Date.now() - startTime;

        if (task.status === 'completed') {
          toast.success('Manus task completed', {
            description: prompt.prompt_name,
          });

          resolve({
            response: task.result_message || '',
            taskId: task.task_id,
            taskUrl: task.task_url || '',
            attachments: task.attachments || [],
            latency_ms: latency,
          });
        } else if (task.status === 'failed' || task.status === 'cancelled') {
          const errorCode = task.error_code || `MANUS_TASK_${task.status.toUpperCase()}`;
          
          toast.error(`Manus task ${task.status}`, {
            description: task.stop_reason || prompt.prompt_name,
          });
          
          reject(new ManusError(
            task.stop_reason || `Manus task ${task.status}`,
            errorCode,
            task.task_id,
            task.task_url || null
          ));
        } else if (task.requires_input) {
          const errorCode = 'MANUS_REQUIRES_INPUT';
          
          toast.error('Manus requires interactive input', {
            description: 'This task mode is not supported in cascade runs',
          });
          
          reject(new ManusError(
            'Manus requires interactive input',
            errorCode,
            task.task_id,
            task.task_url || null
          ));
        }
      };

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
            const newTask = payload.new as ManusTask;
            if (newTask && ['completed', 'failed', 'cancelled'].includes(newTask.status)) {
              handleTaskComplete(newTask);
            } else if (newTask?.requires_input) {
              handleTaskComplete(newTask);
            }
          }
        )
        .subscribe();

      pollInterval = setInterval(async () => {
        if (manusTaskCancelRef.current) {
          cleanup();
          const errorCode = 'MANUS_TASK_CANCELLED';
          
          toast.info('Manus task cancelled', {
            description: 'Cancelled by user',
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
          handleTaskComplete(task as ManusTask);
        } else if ((task as ManusTask)?.requires_input) {
          handleTaskComplete(task as ManusTask);
        }
      }, MANUS_POLL_INTERVAL_MS);

      timeoutId = setTimeout(() => {
        cleanup();
        const errorCode = 'MANUS_TIMEOUT';
        
        toast.error('Manus task timed out', {
          description: 'Task exceeded 30 minute limit',
        });
        
        reject(new ManusError('Manus task timed out after 30 minutes', errorCode, taskId));
      }, MANUS_TASK_TIMEOUT_MS);
    });
  }, [addCall, removeCall]);

  // Fetch cascade hierarchy
  const fetchCascadeHierarchy = useCallback(async (topLevelRowId: string): Promise<CascadeHierarchy | null> => {
    if (!supabase) return null;

    const promptsTable = import.meta.env.VITE_PROMPTS_TBL;
    
    const levels: CascadeLevel[] = [];
    let currentLevelIds = [topLevelRowId];
    let allPrompts: CascadePrompt[] = [];

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

    levels.push({ level: 0, prompts: [topPrompt as CascadePrompt] });
    allPrompts.push(topPrompt as CascadePrompt);

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

      levels.push({ level: levelNum, prompts: children as CascadePrompt[] });
      allPrompts = [...allPrompts, ...(children as CascadePrompt[])];
      currentLevelIds = children.map(c => c.row_id);
      levelNum++;
    }

    return {
      levels,
      totalPrompts: allPrompts.length,
      totalLevels: levels.length,
    };
  }, [supabase]);

  // Build cascade variables
  const buildCascadeVariables = useCallback((
    accumulatedResponses: AccumulatedResponse[],
    currentLevel: number,
    prompt: CascadePrompt,
    parentData: PromptLookupData | null,
    user: UserInfo | null,
    promptDataMap: Map<string, PromptDataMapEntry> = new Map(),
    topLevelData: CascadePrompt | null = null
  ): Record<string, string> => {
    const vars = buildSystemVariablesForRun({
      promptData: prompt,
      parentData: parentData,
      topLevelData: topLevelData,
      user: user,
      storedVariables: (prompt?.system_variables || {}) as Record<string, string>,
    });

    if (accumulatedResponses.length > 0) {
      const lastResponse = accumulatedResponses[accumulatedResponses.length - 1];
      vars['cascade_previous_response'] = lastResponse.response || '';
      vars['cascade_previous_name'] = lastResponse.promptName || '';
      vars['q.previous.response'] = lastResponse.response || '';
      vars['q.previous.name'] = lastResponse.promptName || '';
    }

    vars['cascade_all_responses'] = JSON.stringify(accumulatedResponses.map(r => ({
      level: r.level,
      promptName: r.promptName,
      response: r.response,
    })));

    vars['cascade_level'] = String(currentLevel);
    vars['cascade_prompt_count'] = String(accumulatedResponses.length);

    accumulatedResponses.forEach((r, idx) => {
      vars[`cascade_level_${r.level}_response_${idx}`] = r.response || '';
    });

    promptDataMap.forEach((data, promptId) => {
      vars[`q.ref[${promptId}].output_response`] = data.output_response || '';
      vars[`q.ref[${promptId}].user_prompt_result`] = data.user_prompt_result || '';
      vars[`q.ref[${promptId}].prompt_name`] = data.prompt_name || '';
      vars[`q.ref[${promptId}].input_admin_prompt`] = data.input_admin_prompt || '';
      vars[`q.ref[${promptId}].input_user_prompt`] = data.input_user_prompt || '';
      
      if (data.system_variables && typeof data.system_variables === 'object') {
        Object.entries(data.system_variables).forEach(([key, val]) => {
          if (!CONTEXT_VARIABLE_KEYS.includes(key)) {
            vars[`q.ref[${promptId}].${key}`] = String(val || '');
          }
        });
      }
    });

    return vars;
  }, []);

  // Wait while paused
  const waitWhilePaused = useCallback(async (): Promise<boolean> => {
    while (checkPaused()) {
      await new Promise(resolve => setTimeout(resolve, 200));
      if (isCancelled()) return false;
    }
    return true;
  }, [checkPaused, isCancelled]);

  const getRetryDelayMs = useCallback((err: unknown): number => {
    const error = err as { retry_after_s?: number; message?: string; status?: number };
    const retryAfterS = error?.retry_after_s;
    if (typeof retryAfterS === 'number' && retryAfterS > 0) {
      return Math.ceil(retryAfterS * 1000) + 250;
    }

    const msg = error?.message || '';
    const match = /try again in ([0-9.]+)s/i.exec(msg);
    if (match) {
      const s = Number.parseFloat(match[1]);
      if (!Number.isNaN(s) && s > 0) return Math.ceil(s * 1000) + 250;
    }

    if (error?.status === 429) return 2500;
    return 0;
  }, []);

  // Execute cascade - main function (abbreviated for file size, full logic preserved)
  const executeCascade = useCallback(async (topLevelRowId: string, parentAssistantRowId: string): Promise<void> => {
    const cleanupCall = registerCall();
    
    const unregisterCancel = registerCancelHandler(() => {
      cancelRun();
      manusTaskCancelRef.current = true;
    });
    
    if (!supabase) {
      cleanupCall();
      toast.error('Database not available');
      return;
    }

    const cascadeStartTime = Date.now();

    toast.info('Starting cascade run...', {
      description: 'Fetching prompt hierarchy',
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
    } catch {
      console.log('Using default cascade fallback message');
    }

    const hierarchy = await fetchCascadeHierarchy(topLevelRowId);
    if (!hierarchy) {
      toast.error('Failed to fetch prompt hierarchy');
      cleanupCall();
      unregisterCancel();
      return;
    }

    // Get current user
    let currentUser: UserInfo | null = null;
    try {
      const { data: { user } } = await supabaseClient.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('display_name, email')
          .eq('id', user.id)
          .maybeSingle();
        
        currentUser = {
          id: user.id,
          email: user.email || undefined,
          display_name: profile?.display_name || user.email?.split('@')[0] || 'Unknown',
        };
      }
    } catch (err) {
      console.warn('Could not fetch user for variable resolution:', err);
    }

    const topLevelPrompt = hierarchy.levels[0]?.prompts[0] || null;

    // Build parent lookup map
    const promptLookupMap = new Map<string, PromptLookupData>();
    hierarchy.levels.forEach(level => {
      level.prompts.forEach(prompt => {
        promptLookupMap.set(prompt.row_id, {
          row_id: prompt.row_id,
          prompt_name: prompt.prompt_name,
          parent_row_id: prompt.parent_row_id,
        });
      });
    });

    const getImmediateParent = async (prompt: CascadePrompt): Promise<PromptLookupData | null> => {
      if (!prompt.parent_row_id) return null;
      
      const localParent = promptLookupMap.get(prompt.parent_row_id);
      if (localParent) return localParent;
      
      try {
        const { data: parentPrompt } = await supabase
          .from(import.meta.env.VITE_PROMPTS_TBL || 'q_prompts')
          .select('row_id, prompt_name, parent_row_id')
          .eq('row_id', prompt.parent_row_id)
          .eq('is_deleted', false)
          .maybeSingle();
        
        if (parentPrompt) {
          return parentPrompt as PromptLookupData;
        }
      } catch (err) {
        console.warn('Failed to fetch parent from DB:', err);
      }
      
      return null;
    };

    interface PromptWithLevel extends CascadePrompt {
      levelIdx: number;
    }

    const nonExcludedPrompts = hierarchy.levels
      .flatMap((l, idx) => l.prompts.map(p => ({ ...p, levelIdx: idx } as PromptWithLevel)))
      .filter(p => !p.exclude_from_cascade && !(p.levelIdx === 0 && p.is_assistant));

    const excludedPrompts = hierarchy.levels
      .flatMap(l => l.prompts)
      .filter(p => p.exclude_from_cascade);

    if (nonExcludedPrompts.length === 0) {
      toast.error('No child prompts to run in cascade');
      cleanupCall();
      unregisterCancel();
      return;
    }

    // Pre-flight validation
    const validationIssues = validatePromptContent(nonExcludedPrompts);
    if (validationIssues.length > 0) {
      console.warn('Cascade pre-flight validation issues:', validationIssues);
      toast.warning(`${validationIssues.length} prompt(s) have no content - using fallback messages`);
    }

    resetCumulativeStats();
    startCascade(hierarchy.totalLevels, nonExcludedPrompts.length);
    
    trackEvent('cascade_started', {
      top_level_prompt_id: topLevelRowId,
      top_level_prompt_name: topLevelPrompt?.prompt_name,
      total_levels: hierarchy.totalLevels,
      total_prompts: nonExcludedPrompts.length,
      excluded_prompts: excludedPrompts.length,
    });

    // Start execution trace
    let traceId: string | null = null;
    try {
      const traceResult = await startTrace({
        entry_prompt_row_id: topLevelRowId,
        execution_type: 'cascade_top',
      });
      
      if (traceResult.success) {
        traceId = traceResult.trace_id || null;
      } else if (traceResult.code === 'CONCURRENT_EXECUTION') {
        toast.error('Cannot start cascade', {
          description: traceResult.error,
        });
        cleanupCall();
        unregisterCancel();
        return;
      }
    } catch (traceErr) {
      console.warn('Trace start failed, continuing without tracing:', traceErr);
    }

    // Mark excluded prompts as skipped
    for (const excludedPrompt of excludedPrompts) {
      markPromptSkipped(excludedPrompt.row_id, excludedPrompt.prompt_name);
      
      if (traceId) {
        try {
          const skipSpanResult = await createSpan({
            trace_id: traceId,
            prompt_row_id: excludedPrompt.row_id,
            span_type: 'generation',
          });
          if (skipSpanResult.success && skipSpanResult.span_id) {
            await completeSpan({
              span_id: skipSpanResult.span_id,
              status: 'skipped',
              output: 'Excluded from cascade via exclude_from_cascade flag',
              latency_ms: 0,
            });
          }
        } catch (spanErr) {
          console.warn('Failed to create skipped span:', spanErr);
        }
      }
    }

    const accumulatedResponses: AccumulatedResponse[] = [];
    let promptIndex = 0;
    const promptDataMap = new Map<string, PromptDataMapEntry>();

    try {
      for (let levelIdx = 0; levelIdx < hierarchy.levels.length; levelIdx++) {
        const level = hierarchy.levels[levelIdx];

        for (const prompt of level.prompts) {
          if (prompt.exclude_from_cascade) continue;
          if (levelIdx === 0 && prompt.is_assistant) continue;

          if (isCancelled()) {
            completeCascade();
            return;
          }

          const shouldContinue = await waitWhilePaused();
          if (!shouldContinue) {
            completeCascade();
            return;
          }

          promptIndex++;
          updateProgress(levelIdx, prompt.prompt_name, promptIndex, prompt.row_id);

          const promptStartTime = Date.now();

          const immediateParent = await getImmediateParent(prompt);
          const templateVars = buildCascadeVariables(accumulatedResponses, levelIdx, prompt, immediateParent, currentUser, promptDataMap, topLevelPrompt);

          // Fetch user-defined variables
          const { data: userVariables } = await supabase
            .from(import.meta.env.VITE_PROMPT_VARIABLES_TBL || 'q_prompt_variables')
            .select('variable_name, variable_value, default_value')
            .eq('prompt_row_id', prompt.row_id);

          interface UserVariable {
            variable_name?: string;
            variable_value?: string;
            default_value?: string;
          }

          const userVarsMap = ((userVariables || []) as UserVariable[]).reduce((acc, v) => {
            if (v.variable_name) {
              acc[v.variable_name] = v.variable_value || v.default_value || '';
            }
            return acc;
          }, {} as Record<string, string>);

          const mergedTemplateVars = {
            ...templateVars,
            ...userVarsMap,
          };

          let success = false;
          let retryCount = 0;
          const maxRetries = 3;
          let currentSpanId: string | null = null;
          let rateLimitWaits = 0;
          const maxRateLimitWaits = 12;

          while (!success && retryCount < maxRetries) {
            if (traceId) {
              try {
                const spanResult = await createSpan({
                  trace_id: traceId,
                  prompt_row_id: prompt.row_id,
                  span_type: retryCount > 0 ? 'retry' : 'generation',
                  attempt_number: retryCount + 1,
                  previous_attempt_span_id: currentSpanId || undefined,
                });
                if (spanResult.success) {
                  currentSpanId = spanResult.span_id || null;
                }
              } catch (spanErr) {
                console.warn('Failed to create span:', spanErr);
              }
            }

            try {
              try {
                await supabaseClient.auth.refreshSession();
              } catch (refreshErr) {
                console.warn('Session refresh failed:', refreshErr);
              }

              const userMessage = getPromptMessage(prompt, cascadeFallbackMessage);
              const extendedTemplateVars = {
                ...mergedTemplateVars,
                cascade_admin_prompt: prompt.input_admin_prompt || '',
              };

              const isManus = prompt.model && isManusModel(prompt.model);
              
              let result: { response?: string; response_id?: string; usage?: Record<string, number>; model?: string; interrupted?: boolean; interruptType?: string; interruptData?: { question: string; variableName: string; description?: string } } | undefined;
              
              if (isManus) {
                result = await runManusTask({
                  prompt,
                  userMessage,
                  templateVariables: extendedTemplateVars,
                  traceId,
                });
              } else {
                result = await runConversation({
                  conversationRowId: parentAssistantRowId,
                  childPromptRowId: prompt.row_id,
                  userMessage: userMessage,
                  threadMode: 'new',
                  childThreadStrategy: 'parent',
                  template_variables: extendedTemplateVars,
                  store_in_history: false,
                });
              }

              // Handle question interrupts
              const MAX_QUESTION_ATTEMPTS = prompt.question_config?.max_questions || 10;
              let questionAttempts = 0;
              
              while (result?.interrupted && result.interruptType === 'question' && questionAttempts < MAX_QUESTION_ATTEMPTS) {
                questionAttempts++;
                
                const answer = await showQuestion({
                  question: result.interruptData?.question || '',
                  variableName: result.interruptData?.variableName || '',
                  description: result.interruptData?.description,
                  promptName: prompt.prompt_name,
                  maxQuestions: MAX_QUESTION_ATTEMPTS,
                });
                
                if (answer === null) {
                  completeCascade();
                  return;
                }
                
                addCollectedQuestionVar(result.interruptData?.variableName || '', answer);
                
                result = await runConversation({
                  conversationRowId: parentAssistantRowId,
                  childPromptRowId: prompt.row_id,
                  userMessage: answer,
                  threadMode: 'continue',
                  childThreadStrategy: 'parent',
                  template_variables: extendedTemplateVars,
                  store_in_history: false,
                });
              }

              if (isCancelled()) {
                completeCascade();
                return;
              }

              if (result?.response) {
                const promptElapsedMs = Date.now() - promptStartTime;
                
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

                promptDataMap.set(prompt.row_id, {
                  output_response: result.response,
                  user_prompt_result: result.response,
                  prompt_name: prompt.prompt_name,
                  input_admin_prompt: prompt.input_admin_prompt || '',
                  input_user_prompt: prompt.input_user_prompt || '',
                  system_variables: (prompt.system_variables || {}) as Record<string, unknown>,
                });

                markPromptComplete(prompt.row_id, prompt.prompt_name, result.response);

                await new Promise(resolve => setTimeout(resolve, 0));

                const updateData: Record<string, unknown> = { 
                  user_prompt_result: result.response,
                  output_response: result.response 
                };

                // Handle action nodes
                const hasPostAction = !!prompt.post_action;
                const isActionEffective = prompt.node_type === 'action' || hasPostAction;
                
                if (isActionEffective && result.response && hasPostAction) {
                  try {
                    let jsonResponse: unknown;
                    try {
                      jsonResponse = extractJsonFromResponse(result.response);
                    } catch (parseError) {
                      const err = parseError as Error;
                      console.error('JSON parsing failed:', err.message);
                      updateData.last_action_result = {
                        status: 'failed',
                        error: `JSON parse error: ${err.message}`,
                        executed_at: new Date().toISOString(),
                      };
                      throw parseError;
                    }
                    
                    updateData.extracted_variables = jsonResponse;

                    // Process variable assignments
                    if (prompt.variable_assignments_config?.enabled && jsonResponse) {
                      try {
                        const { processVariableAssignments } = await import('@/services/actionExecutors');
                        await processVariableAssignments({
                          supabase: supabaseClient,
                          promptRowId: prompt.row_id,
                          jsonResponse,
                          config: prompt.variable_assignments_config,
                          onVariablesChanged: (promptId: string) => {
                            window.dispatchEvent(new CustomEvent('q:prompt-variables-updated', { 
                              detail: { promptRowId: promptId } 
                            }));
                          },
                        });
                      } catch (varError) {
                        console.warn('Variable assignments failed:', varError);
                      }
                    }

                    // Execute post-action
                    if (prompt.post_action) {
                      const actionConfig = prompt.post_action_config || {};
                      const validation = validateActionResponse(jsonResponse, actionConfig, prompt.post_action);
                      
                      if (!validation.valid) {
                        toast.error(`Action validation failed`, {
                          description: validation.error,
                        });
                        updateData.last_action_result = {
                          status: 'failed',
                          error: validation.error,
                          executed_at: new Date().toISOString(),
                        };
                        continue;
                      }
                      
                      const skipPreview = (actionConfig as { skip_preview?: boolean }).skip_preview === true || skipAllPreviews;
                      
                      if (!skipPreview && prompt.post_action === 'create_children_json') {
                        const confirmed = await showActionPreview({
                          jsonResponse,
                          config: prompt.post_action_config || {},
                          promptName: prompt.prompt_name,
                        });
                        
                        if (!confirmed) {
                          updateData.last_action_result = {
                            status: 'cancelled',
                            reason: 'user_cancelled',
                            executed_at: new Date().toISOString(),
                          };
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
                        config: prompt.post_action_config || {},
                        context: { userId: currentUser?.id },
                      });

                      updateData.last_action_result = {
                        status: actionResult.success ? 'success' : 'failed',
                        created_count: actionResult.createdCount || 0,
                        target_parent_id: actionResult.targetParentRowId,
                        message: actionResult.message,
                        error: actionResult.error || null,
                        executed_at: new Date().toISOString(),
                      };

                      if (actionResult.success && actionResult.createdCount > 0) {
                        window.dispatchEvent(new CustomEvent('tree-refresh-needed', {
                          detail: { 
                            reason: 'post_action',
                            createdCount: actionResult.createdCount,
                            parentRowId: actionResult.targetParentRowId || prompt.row_id,
                          }
                        }));
                      }
                    }
                  } catch (jsonError) {
                    if (!updateData.last_action_result) {
                      console.warn('Action node error:', jsonError);
                    }
                  }
                }

                await supabase
                  .from(import.meta.env.VITE_PROMPTS_TBL)
                  .update(updateData)
                  .eq('row_id', prompt.row_id);

                window.dispatchEvent(new CustomEvent('prompt-result-updated', {
                  detail: { promptRowId: prompt.row_id }
                }));

                toast.success(`Completed: ${prompt.prompt_name}`, {
                  description: `${Date.now() - promptStartTime}ms`,
                });

                success = true;
              } else {
                throw new Error('No response received');
              }
            } catch (error) {
              console.error('Cascade prompt error:', error);

              const delayMs = getRetryDelayMs(error);
              const isRateLimited = delayMs > 0;

              if (traceId && currentSpanId && !isRateLimited) {
                try {
                  await failSpan({
                    span_id: currentSpanId,
                    error_evidence: {
                      error_type: (error as Error).name || 'Error',
                      error_message: (error as Error).message,
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
                  toast.error(`Rate limit exceeded for: ${prompt.prompt_name}`);
                  break;
                }
                toast.warning(`Rate limited - waiting ${Math.round(delayMs / 1000)}s`);
                await new Promise(r => setTimeout(r, delayMs));
                continue;
              }

              retryCount++;
              if (retryCount >= maxRetries) {
                const action = await showError({
                  error: (error as Error).message,
                  promptName: prompt.prompt_name,
                  promptRowId: prompt.row_id,
                  retryCount,
                  maxRetries,
                });

                if (action === 'skip') {
                  markPromptSkipped(prompt.row_id, prompt.prompt_name);
                  success = true;
                } else if (action === 'stop') {
                  completeCascade();
                  return;
                } else if (action === 'retry') {
                  retryCount = 0;
                  rateLimitWaits = 0;
                }
              }
            }
          }
        }
        
        await new Promise(resolve => setTimeout(resolve, 0));
      }

      const totalElapsedMs = Date.now() - cascadeStartTime;

      if (traceId) {
        try {
          await completeTrace({ trace_id: traceId, status: 'completed' });
        } catch (traceErr) {
          console.warn('Failed to complete trace:', traceErr);
        }
      }

      completeCascade();
      toast.success(`Cascade run completed!`, {
        description: `${accumulatedResponses.length} prompts in ${Math.round(totalElapsedMs / 1000)}s`,
      });
      
      trackEvent('cascade_completed', {
        top_level_prompt_id: topLevelRowId,
        top_level_prompt_name: topLevelPrompt?.prompt_name,
        total_prompts_run: accumulatedResponses.length,
        elapsed_ms: totalElapsedMs,
        success: true,
      });

    } catch (error) {
      console.error('Cascade execution error:', error);
      
      if (traceId) {
        try {
          await completeTrace({ 
            trace_id: traceId, 
            status: 'failed',
            error_summary: (error as Error).message,
          });
        } catch (traceErr) {
          console.warn('Failed to complete trace on error:', traceErr);
        }
      }
      
      completeCascade();
      toast.error(`Cascade failed: ${(error as Error).message}`);
      
      trackEvent('cascade_completed', {
        top_level_prompt_id: topLevelRowId,
        top_level_prompt_name: topLevelPrompt?.prompt_name,
        total_prompts_run: accumulatedResponses.length,
        elapsed_ms: Date.now() - cascadeStartTime,
        success: false,
        error_message: (error as Error).message,
      });
      trackException(error, {
        context: 'cascade_execution',
        top_level_prompt_id: topLevelRowId,
      });
    } finally {
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
    showQuestion,
    addCollectedQuestionVar,
  ]);

  // Check if prompt has children
  const hasChildren = useCallback(async (promptRowId: string): Promise<boolean> => {
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

  // Execute child cascade
  const executeChildCascade = useCallback(async (
    children: Array<{ row_id: string; prompt_name?: string }>,
    parentPrompt: CascadePrompt,
    options: ChildCascadeOptions = {}
  ): Promise<{ success: boolean; results: ChildCascadeResult[]; depthLimitReached?: boolean }> => {
    const { 
      maxDepth = 99, 
      currentDepth = 0,
      inheritedVariables = {},
      traceId: passedTraceId = null,
    } = options;

    if (!children || children.length === 0) {
      return { success: true, results: [] };
    }
    
    let traceId = passedTraceId;
    let ownTrace = false;
    if (!traceId && parentPrompt?.row_id) {
      try {
        const traceResult = await startTrace({
          entry_prompt_row_id: parentPrompt.row_id,
          execution_type: 'cascade_child',
        });
        if (traceResult.success) {
          traceId = traceResult.trace_id || null;
          ownTrace = true;
        }
      } catch (traceErr) {
        console.warn('Failed to start child cascade trace:', traceErr);
      }
    }

    if (currentDepth >= maxDepth) {
      console.warn(`Auto-cascade depth limit (${maxDepth}) reached`);
      toast.warning(`Auto-cascade depth limit reached (${maxDepth} levels)`);
      if (ownTrace && traceId) {
        try {
          await completeTrace({ trace_id: traceId, status: 'completed' });
        } catch (err) {
          console.warn('Failed to complete trace:', err);
        }
      }
      return { success: true, results: [], depthLimitReached: true };
    }

    const { data: parentAssistant } = await supabaseClient
      .from('q_assistants')
      .select('row_id')
      .eq('prompt_row_id', parentPrompt.row_id)
      .maybeSingle();

    const parentAssistantRowId = parentAssistant?.row_id;
    const results: ChildCascadeResult[] = [];

    for (const child of children) {
      if (isCancelled()) break;

      const shouldContinue = await waitWhilePaused();
      if (!shouldContinue) break;

      const { data: childPrompt, error: fetchError } = await supabaseClient
        .from(import.meta.env.VITE_PROMPTS_TBL)
        .select('*')
        .eq('row_id', child.row_id)
        .maybeSingle();

      if (fetchError || !childPrompt) {
        results.push({
          promptRowId: child.row_id,
          promptName: child.prompt_name || 'Unknown',
          success: false,
          error: 'Prompt not found',
        });
        continue;
      }

      const typedChild = childPrompt as CascadePrompt;
      const userMessage = getPromptMessage(typedChild, 'Execute this prompt');

      interface ChildVariable {
        variable_name?: string;
        variable_value?: string;
        default_value?: string;
      }

      const { data: childVars } = await supabaseClient
        .from(import.meta.env.VITE_PROMPT_VARIABLES_TBL || 'q_prompt_variables')
        .select('variable_name, variable_value, default_value')
        .eq('prompt_row_id', typedChild.row_id);

      const childVariablesMap: Record<string, string> = {};
      ((childVars || []) as ChildVariable[]).forEach(v => {
        if (v.variable_name) {
          childVariablesMap[v.variable_name] = v.variable_value || v.default_value || '';
        }
      });

      const templateVariables = {
        ...inheritedVariables,
        ...childVariablesMap,
      };

      let childSpanId: string | null = null;
      if (traceId) {
        try {
          const spanResult = await createSpan({
            trace_id: traceId,
            prompt_row_id: typedChild.row_id,
            span_type: 'generation',
          });
          if (spanResult.success) {
            childSpanId = spanResult.span_id || null;
          }
        } catch (spanErr) {
          console.warn('Failed to create span for child:', spanErr);
        }
      }
      
      const childStartTime = Date.now();

      try {
        const isManus = typedChild.model && isManusModel(typedChild.model);
        
        let result: { response?: string; response_id?: string; usage?: Record<string, number> } | undefined;
        
        if (isManus) {
          result = await runManusTask({
            prompt: typedChild,
            userMessage,
            templateVariables,
            traceId,
          });
        } else {
          result = await runConversation({
            conversationRowId: parentAssistantRowId,
            childPromptRowId: typedChild.row_id,
            userMessage,
            threadMode: 'new',
            childThreadStrategy: 'parent',
            template_variables: templateVariables,
            store_in_history: false,
          });
        }

        results.push({
          promptRowId: typedChild.row_id,
          promptName: typedChild.prompt_name,
          success: !!result?.response,
          response: result?.response,
        });
        
        if (childSpanId) {
          const latencyMs = Date.now() - childStartTime;
          await completeSpan({
            span_id: childSpanId,
            status: result?.response ? 'success' : 'failed',
            openai_response_id: result?.response_id,
            output: result?.response,
            latency_ms: latencyMs,
          }).catch(err => console.warn('Failed to complete child span:', err));
        }

        if (result?.response) {
          await supabaseClient
            .from(import.meta.env.VITE_PROMPTS_TBL)
            .update({
              user_prompt_result: result.response,
              output_response: result.response,
            })
            .eq('row_id', typedChild.row_id);

          const hasPostAction = !!typedChild.post_action;
          const isActionNode = typedChild.node_type === 'action' || hasPostAction;

          if (isActionNode && hasPostAction && typedChild.auto_run_children) {
            try {
              const jsonData = extractJsonFromResponse(result.response);
              
              if (jsonData) {
                if (typedChild.variable_assignments_config?.enabled) {
                  const { processVariableAssignments } = await import('@/services/actionExecutors');
                  await processVariableAssignments({
                    supabase: supabaseClient,
                    promptRowId: typedChild.row_id,
                    jsonResponse: jsonData,
                    config: typedChild.variable_assignments_config,
                    onVariablesChanged: (promptId: string) => {
                      window.dispatchEvent(new CustomEvent('q:prompt-variables-updated', { 
                        detail: { promptRowId: promptId } 
                      }));
                    },
                  });
                }

                const actionResult = await executePostAction({
                  supabase: supabaseClient,
                  prompt: typedChild,
                  jsonResponse: jsonData,
                  actionId: typedChild.post_action!,
                  config: typedChild.post_action_config || {},
                  context: { userId: typedChild.owner_id },
                });

                if (actionResult.success && actionResult.children?.length > 0) {
                  const recursiveResult = await executeChildCascade(
                    actionResult.children,
                    typedChild,
                    {
                      maxDepth,
                      currentDepth: currentDepth + 1,
                      inheritedVariables: templateVariables,
                      traceId,
                    }
                  );

                  results.push(...recursiveResult.results);
                  
                  if (recursiveResult.depthLimitReached) {
                    return { success: true, results, depthLimitReached: true };
                  }
                }
              }
            } catch (actionError) {
              console.error('executeChildCascade: Error in child action execution:', actionError);
            }
          }
        }

        toast.success(`Auto-run: ${typedChild.prompt_name}`, {
          description: `Depth ${currentDepth + 1}`,
        });

      } catch (error) {
        console.error('executeChildCascade: Error running child prompt:', error);
        
        if (childSpanId) {
          await failSpan({
            span_id: childSpanId,
            error_evidence: {
              error_type: (error as Error).name || 'Error',
              error_message: (error as Error).message,
              retry_recommended: false,
            },
          }).catch(err => console.warn('Failed to fail child span:', err));
        }
        
        results.push({
          promptRowId: typedChild.row_id,
          promptName: typedChild.prompt_name,
          success: false,
          error: (error as Error).message,
        });
      }
    }

    trackEvent('auto_cascade_children_run', {
      parent_prompt_id: parentPrompt?.row_id,
      children_count: children.length,
      success_count: results.filter(r => r.success).length,
      current_depth: currentDepth,
    });

    if (ownTrace && traceId) {
      const hasErrors = results.some(r => !r.success);
      try {
        await completeTrace({
          trace_id: traceId,
          status: hasErrors ? 'failed' : 'completed',
          error_summary: hasErrors ? 'Some child prompts failed' : undefined,
        });
      } catch (err) {
        console.warn('Failed to complete child cascade trace:', err);
      }
    }

    return { success: true, results };
  }, [
    isCancelled,
    waitWhilePaused,
    runConversation,
    isManusModel,
    runManusTask,
    startTrace,
    createSpan,
    completeSpan,
    failSpan,
    completeTrace,
  ]);

  return {
    executeCascade,
    fetchCascadeHierarchy,
    hasChildren,
    executeChildCascade,
  };
};
