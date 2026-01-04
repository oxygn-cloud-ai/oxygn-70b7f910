import { useCallback } from 'react';
import { useSupabase } from './useSupabase';
import { useConversationRun } from './useConversationRun';
import { useCascadeRun } from '@/contexts/CascadeRunContext';
import { useApiCallContext } from '@/contexts/ApiCallContext';
import { useExecutionTracing } from './useExecutionTracing';
import { toast } from '@/components/ui/sonner';
import { notify } from '@/contexts/ToastHistoryContext';
import { parseApiError, isQuotaError, formatErrorForDisplay } from '@/utils/apiErrorUtils';
import { buildSystemVariablesForRun } from '@/utils/resolveSystemVariables';
import { supabase as supabaseClient } from '@/integrations/supabase/client';
import { executePostAction } from '@/services/actionExecutors';
import { validateActionResponse, extractJsonFromResponse } from '@/utils/actionValidation';
import { trackEvent, trackException } from '@/lib/posthog';

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
  const { runConversation } = useConversationRun();
  const { registerCall } = useApiCallContext();
  const { startTrace, createSpan, completeSpan, failSpan, completeTrace } = useExecutionTracing();
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
  } = useCascadeRun();

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
      .single();

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
        .order('position', { ascending: true });

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
  const buildCascadeVariables = useCallback((accumulatedResponses, currentLevel, prompt, parentData, user, promptDataMap = new Map()) => {
    // Start with system variables (q.today, q.user.name, etc.)
    const vars = buildSystemVariablesForRun({
      promptData: prompt,
      parentData: parentData,
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
    promptDataMap.forEach((data, promptId) => {
      vars[`q.ref[${promptId}].output_response`] = data.output_response || '';
      vars[`q.ref[${promptId}].user_prompt_result`] = data.user_prompt_result || '';
      vars[`q.ref[${promptId}].prompt_name`] = data.prompt_name || '';
      vars[`q.ref[${promptId}].input_admin_prompt`] = data.input_admin_prompt || '';
      vars[`q.ref[${promptId}].input_user_prompt`] = data.input_user_prompt || '';
      
      // Include system variables from referenced prompt
      if (data.system_variables && typeof data.system_variables === 'object') {
        Object.entries(data.system_variables).forEach(([key, val]) => {
          vars[`q.ref[${promptId}].${key}`] = String(val || '');
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
        .single();
      
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

    // Mark excluded prompts as skipped immediately
    for (const excludedPrompt of excludedPrompts) {
      markPromptSkipped(excludedPrompt.row_id, excludedPrompt.prompt_name);
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

          // Skip top-level prompt (level 0) if it's an assistant - it's the parent, not a child
          // The conversation-run function expects child prompts with a parent
          if (levelIdx === 0 && prompt.is_assistant) {
            console.log(`Skipping assistant prompt at level 0: ${prompt.prompt_name} (provides conversation context)`);
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
          const templateVars = buildCascadeVariables(accumulatedResponses, levelIdx, prompt, topLevelPrompt, currentUser, promptDataMap);

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

              const result = await runConversation({
                conversationRowId: parentAssistantRowId,
                childPromptRowId: prompt.row_id,
                userMessage: userMessage,
                threadMode: 'new', // Force new thread for cascade isolation
                childThreadStrategy: 'parent', // Use parent thread for context continuity
                template_variables: extendedTemplateVars,
                store_in_history: false,
              });

              if (result?.response) {
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
                        input: result.usage.prompt_tokens || 0,
                        output: result.usage.completion_tokens || 0,
                        total: result.usage.total_tokens || 0,
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

              // Fail the span with error evidence
              if (traceId && currentSpanId) {
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

              const delayMs = getRetryDelayMs(error);
              if (delayMs > 0) {
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
      // Unregister from ApiCallContext
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
    showError,
    getRetryDelayMs,
    registerCall,
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
  const executeChildCascade = useCallback(async (
    children,
    parentPrompt,
    options = {}
  ) => {
    const { 
      maxDepth = 99, 
      currentDepth = 0,
      inheritedVariables = {},
    } = options;

    if (!children || children.length === 0) {
      return { success: true, results: [] };
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

    for (const child of children) {
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
        .single();

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

      try {
        // Run the child prompt
        const result = await runConversation({
          conversationRowId: parentAssistantRowId,
          childPromptRowId: childPrompt.row_id,
          userMessage,
          threadMode: 'new',
          childThreadStrategy: 'parent',
          template_variables: templateVariables,
          store_in_history: false,
        });

        const promptResult = {
          promptRowId: childPrompt.row_id,
          promptName: childPrompt.prompt_name,
          success: !!result?.response,
          response: result?.response,
        };
        results.push(promptResult);

        // Update the child prompt's output in database
        if (result?.response) {
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
                if (actionResult.success && actionResult.children?.length > 0) {
                  console.log(`executeChildCascade: Recursing for ${actionResult.children.length} grandchildren at depth ${currentDepth + 1}`);
                  
                  const recursiveResult = await executeChildCascade(
                    actionResult.children,
                    childPrompt,
                    {
                      maxDepth,
                      currentDepth: currentDepth + 1,
                      inheritedVariables: templateVariables,
                    }
                  );

                  // Add recursive results
                  results.push(...recursiveResult.results);
                  
                  if (recursiveResult.depthLimitReached) {
                    return { success: true, results, depthLimitReached: true };
                  }
                }
              }
            } catch (actionError) {
              console.error('executeChildCascade: Error in child action execution:', actionError);
              // Continue to next child, don't fail the whole cascade
            }
          }
        }

        toast.success(`Auto-run: ${childPrompt.prompt_name}`, {
          description: `Depth ${currentDepth + 1}`,
          source: 'executeChildCascade',
        });

      } catch (error) {
        console.error('executeChildCascade: Error running child prompt:', childPrompt.row_id, error);
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

    return { success: true, results };
  }, [runConversation, isCancelled, waitWhilePaused]);

  return {
    executeCascade,
    fetchCascadeHierarchy,
    hasChildren,
    executeChildCascade,
  };
};
