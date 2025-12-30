import { useCallback } from 'react';
import { useSupabase } from './useSupabase';
import { useConversationRun } from './useConversationRun';
import { useCascadeRun } from '@/contexts/CascadeRunContext';
import { toast } from '@/components/ui/sonner';
import { notify } from '@/contexts/ToastHistoryContext';
import { parseApiError, isQuotaError, formatErrorForDisplay } from '@/utils/apiErrorUtils';
import { buildSystemVariablesForRun } from '@/utils/resolveSystemVariables';
import { supabase as supabaseClient } from '@/integrations/supabase/client';
import { executePostAction } from '@/services/actionExecutors';
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
  const {
    startCascade,
    updateProgress,
    markPromptComplete,
    markPromptSkipped,
    completeCascade,
    isCancelled,
    checkPaused,
    showError,
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
    if (!supabase) {
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

          let rateLimitWaits = 0;
          const maxRateLimitWaits = 12;

          while (!success && retryCount < maxRetries) {
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
              });

              if (result?.response) {
                const promptElapsedMs = Date.now() - promptStartTime;
                
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

                // Update the prompt's user_prompt_result in database (matches UI field)
                const updateData = { user_prompt_result: result.response };

                // Handle action nodes: parse JSON response and execute post-action
                if (prompt.node_type === 'action' && result.response) {
                  try {
                    // Extract JSON from markdown code blocks if present
                    let jsonString = result.response.trim();
                    const codeBlockMatch = jsonString.match(/```(?:json)?\s*([\s\S]*?)```/);
                    if (codeBlockMatch) {
                      jsonString = codeBlockMatch[1].trim();
                    }
                    const jsonResponse = JSON.parse(jsonString);
                    updateData.extracted_variables = jsonResponse;

                    // Execute post-action if configured
                    if (prompt.post_action) {
                      const actionResult = await executePostAction({
                        supabase,
                        prompt,
                        jsonResponse,
                        actionId: prompt.post_action,
                        config: prompt.post_action_config,
                        context: { userId: currentUser?.id },
                      });

                      if (actionResult.success) {
                        toast.success(`Action completed: ${actionResult.message}`, {
                          source: 'useCascadeExecutor.postAction',
                        });
                      } else {
                        toast.warning(`Action failed: ${actionResult.error}`, {
                          source: 'useCascadeExecutor.postAction',
                        });
                      }
                    }
                  } catch (jsonError) {
                    console.warn('Action node response not valid JSON:', jsonError);
                    toast.warning(`Action node response not valid JSON`, {
                      description: prompt.prompt_name,
                      source: 'useCascadeExecutor',
                    });
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

  return {
    executeCascade,
    fetchCascadeHierarchy,
    hasChildren,
  };
};
