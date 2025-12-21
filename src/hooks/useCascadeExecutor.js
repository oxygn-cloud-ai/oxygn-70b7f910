import { useCallback } from 'react';
import { useSupabase } from './useSupabase';
import { useConversationRun } from './useConversationRun';
import { useCascadeRun } from '@/contexts/CascadeRunContext';
import { toast } from '@/components/ui/sonner';

// Helper to get a usable message from a prompt
const getPromptMessage = (prompt) => {
  const userPrompt = prompt.input_user_prompt?.trim();
  const adminPrompt = prompt.input_admin_prompt?.trim();
  
  if (userPrompt) return userPrompt;
  if (adminPrompt) return adminPrompt;
  
  // Default fallback - should rarely happen but prevents 400 errors
  return 'Execute this prompt';
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
  const buildCascadeVariables = useCallback((accumulatedResponses, currentLevel) => {
    const vars = {};

    // Previous response (most recent)
    if (accumulatedResponses.length > 0) {
      const lastResponse = accumulatedResponses[accumulatedResponses.length - 1];
      vars['cascade_previous_response'] = lastResponse.response || '';
      vars['cascade_previous_name'] = lastResponse.promptName || '';
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
      toast.error('Supabase not available');
      return;
    }

    // Fetch hierarchy
    const hierarchy = await fetchCascadeHierarchy(topLevelRowId);
    if (!hierarchy) {
      toast.error('Failed to fetch prompt hierarchy');
      return;
    }

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
      toast.error('No child prompts to run in cascade');
      return;
    }

    // Pre-flight validation: check for prompts without content
    const validationIssues = validatePromptContent(nonExcludedPrompts);
    if (validationIssues.length > 0) {
      console.warn('Cascade pre-flight validation issues:', validationIssues);
      toast.warning(
        `${validationIssues.length} prompt(s) have no content - using fallback messages`,
        { description: validationIssues.map(i => i.promptName).join(', ') }
      );
    }

    // Initialize cascade state with correct count
    startCascade(hierarchy.totalLevels, nonExcludedPrompts.length);

    // Mark excluded prompts as skipped immediately
    for (const excludedPrompt of excludedPrompts) {
      markPromptSkipped(excludedPrompt.row_id, excludedPrompt.prompt_name);
    }

    const accumulatedResponses = [];
    let promptIndex = 0;

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

          // Check if cancelled
          if (isCancelled()) {
            toast.info('Cascade run cancelled');
            completeCascade();
            return;
          }

          // Wait if paused
          const shouldContinue = await waitWhilePaused();
          if (!shouldContinue) {
            toast.info('Cascade run cancelled');
            completeCascade();
            return;
          }

          promptIndex++;
          updateProgress(levelIdx, prompt.prompt_name, promptIndex);

          // Build template variables from accumulated context
          const templateVars = buildCascadeVariables(accumulatedResponses, levelIdx);

          let success = false;
          let retryCount = 0;
          const maxRetries = 3;

          let rateLimitWaits = 0;
          const maxRateLimitWaits = 12;

          while (!success && retryCount < maxRetries) {
            try {
              // Build the user message - fallback to admin prompt or default if empty
              const userMessage = getPromptMessage(prompt);

              // Pass input_admin_prompt as a template variable for system context
              const extendedTemplateVars = {
                ...templateVars,
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
                accumulatedResponses.push({
                  level: levelIdx,
                  promptRowId: prompt.row_id,
                  promptName: prompt.prompt_name,
                  response: result.response,
                });

                markPromptComplete(prompt.row_id, prompt.prompt_name, result.response);

                // Update the prompt's user_prompt_result in database (matches UI field)
                await supabase
                  .from(import.meta.env.VITE_PROMPTS_TBL)
                  .update({ user_prompt_result: result.response })
                  .eq('row_id', prompt.row_id);

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
                  throw error;
                }
                console.log(`Rate limited; waiting ${delayMs}ms before retrying...`);
                await new Promise(resolve => setTimeout(resolve, delayMs));
                continue;
              }

              retryCount++;

              if (retryCount >= maxRetries) {
                // Show error dialog and wait for user decision
                const action = await showError(
                  { name: prompt.prompt_name, rowId: prompt.row_id },
                  error.message || 'Unknown error'
                );

                if (action === 'stop') {
                  toast.error('Cascade run stopped by user');
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
                  success = true;
                } else if (action === 'retry') {
                  retryCount = 0; // Reset retry count and try again
                }
              }
            }
          }
        }
      }

      // Complete cascade
      completeCascade();
      toast.success(`Cascade run completed! ${accumulatedResponses.length} prompts executed.`);

    } catch (error) {
      console.error('Cascade execution error:', error);
      completeCascade();
      toast.error(`Cascade failed: ${error.message}`);
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
