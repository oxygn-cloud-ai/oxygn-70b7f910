import { useCallback } from 'react';
import { useSupabase } from './useSupabase';
import { useConversationRun } from './useConversationRun';
import { useCascadeRun } from '@/contexts/CascadeRunContext';
import { toast } from '@/components/ui/sonner';

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
    const nonExcludedPrompts = hierarchy.levels
      .flatMap(l => l.prompts)
      .filter(p => !p.exclude_from_cascade);
    
    const excludedPrompts = hierarchy.levels
      .flatMap(l => l.prompts)
      .filter(p => p.exclude_from_cascade);
    
    if (nonExcludedPrompts.length === 0) {
      toast.error('All prompts are excluded from cascade');
      return;
    }

    // Initialize cascade state
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

          while (!success && retryCount < maxRetries) {
            try {
              // Build the user message - use input_user_prompt from the prompt
              const userMessage = prompt.input_user_prompt || '';
              
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

                // Update the prompt's output_response in database
                await supabase
                  .from(import.meta.env.VITE_PROMPTS_TBL)
                  .update({ output_response: result.response })
                  .eq('row_id', prompt.row_id);

                success = true;
              } else {
                throw new Error('No response received');
              }
            } catch (error) {
              console.error('Cascade prompt error:', error);
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
