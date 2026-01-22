/**
 * usePromptRunner Hook
 * 
 * Extracted from MainLayout - handles prompt execution (single run and cascade),
 * including tracing, cost tracking, and post-action processing.
 */

import { useState, useCallback } from 'react';
import { toast } from '@/components/ui/sonner';
import { useConversationRun } from '@/hooks/useConversationRun';
import { useCascadeExecutor } from '@/hooks/useCascadeExecutor';
import { useCascadeRun } from '@/contexts/CascadeRunContext';
import { usePendingSaves } from '@/contexts/PendingSaveContext';
import { useExecutionTracing } from '@/hooks/useExecutionTracing';
import { useCostTracking } from '@/hooks/useCostTracking';
import { executePostAction, processVariableAssignments } from '@/services/actionExecutors';
import { validateActionResponse, extractJsonFromResponse } from '@/utils/actionValidation';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { PromptData } from '@/types';

// ============= Types =============
interface UsePromptRunnerProps {
  supabase: SupabaseClient;
  currentUserId: string | undefined;
  fetchItemData: (rowId: string) => Promise<PromptData | null>;
  refreshTreeData: () => Promise<void>;
  selectedPromptId: string | null;
  setSelectedPromptData: (data: PromptData | null | ((prev: PromptData | null) => PromptData | null)) => void;
  setExpandedFolders: (updater: (prev: Record<string, boolean>) => Record<string, boolean>) => void;
}

interface UsePromptRunnerReturn {
  // Run handlers
  handleRunPrompt: (promptId: string) => Promise<void>;
  handleRunCascade: (topLevelPromptId: string) => Promise<void>;
  
  // State
  isRunningPrompt: boolean;
  isCascadeRunning: boolean;
  runProgress: string | null;
  singleRunPromptId: string | null;
  currentCascadePromptId: string | null;
  
  // Cancel
  cancelRun: () => void;
}

// ============= Utilities =============
const truncateForLog = (text: string | null | undefined, maxLen = 50): string => {
  if (!text) return '[empty]';
  if (text.length <= maxLen) return text;
  return `${text.slice(0, maxLen)}...`;
};

// ============= Hook =============
export const usePromptRunner = ({
  supabase,
  currentUserId,
  fetchItemData,
  refreshTreeData,
  selectedPromptId,
  setSelectedPromptData,
  setExpandedFolders,
}: UsePromptRunnerProps): UsePromptRunnerReturn => {
  
  const [runStartingFor, setRunStartingFor] = useState<string | null>(null);
  
  // Core execution hooks
  const { 
    runPrompt, 
    cancelRun, 
    isRunning: isRunningPromptInternal, 
    progress: runProgress 
  } = useConversationRun();
  
  const { 
    executeCascade, 
    hasChildren: checkHasChildren, 
    executeChildCascade 
  } = useCascadeExecutor();
  
  const { 
    isRunning: isCascadeRunning, 
    currentPromptRowId: currentCascadePromptId, 
    singleRunPromptId,
    showActionPreview,
    startSingleRun, 
    endSingleRun, 
    showQuestion,
    addCollectedQuestionVar,
  } = useCascadeRun();
  
  const { flushPendingSaves } = usePendingSaves();
  const costTracking = useCostTracking();
  const { 
    startTrace, 
    createSpan, 
    completeSpan, 
    failSpan, 
    completeTrace 
  } = useExecutionTracing();

  // Combined running state
  const isRunningPrompt = isRunningPromptInternal || singleRunPromptId !== null;

  /**
   * Handler for running a single prompt
   */
  const handleRunPrompt = useCallback(async (promptId: string): Promise<void> => {
    if (!promptId) return;

    // Debounce: prevent rapid clicking
    if (runStartingFor === promptId) {
      toast.info('Run already starting...', { duration: 2000 });
      return;
    }

    // IMMEDIATE: Set single run state for instant UI feedback via context
    setRunStartingFor(promptId);
    startSingleRun(promptId);

    let promptData: PromptData | null = null;
    let startTime: number;

    try {
      // CRITICAL: Wait for any pending field saves to complete before fetching
      await flushPendingSaves();

      // Fetch prompt data to check if it's an action node
      promptData = await fetchItemData(promptId);
      startTime = Date.now();

      // Start execution trace in background (non-blocking for UI)
      const tracingPromise = (async () => {
        try {
          const traceResult = await startTrace({
            entry_prompt_row_id: promptId,
            execution_type: 'single',
          });
          if (traceResult.success) {
            const spanResult = await createSpan({
              trace_id: traceResult.trace_id,
              prompt_row_id: promptId,
              span_type: 'generation',
            });
            return {
              traceId: traceResult.trace_id,
              spanId: spanResult.success ? spanResult.span_id : null,
            };
          }
        } catch (traceErr) {
          console.warn('Failed to start execution trace:', traceErr);
        }
        return { traceId: null, spanId: null };
      })();

      // Determine response format
      const getResponseFormat = () => {
        if (promptData?.node_type === 'action' && promptData?.json_schema_template_id) {
          return 'Structured Output (JSON Schema)';
        }
        if (promptData?.response_format_on && promptData?.response_format) {
          return promptData.response_format === 'json_object' ? 'JSON Object' : 'JSON Schema';
        }
        return 'text';
      };

      // Show API request details toast
      const requestDetails = {
        prompt: promptData?.prompt_name || promptId.slice(0, 8),
        model: promptData?.model || 'default',
        system_prompt: truncateForLog(promptData?.input_admin_prompt),
        user_prompt: truncateForLog(promptData?.input_user_prompt),
        reasoning_effort: promptData?.reasoning_effort_on ? promptData?.reasoning_effort : 'off',
        response_format: getResponseFormat(),
        node_type: promptData?.node_type || 'standard',
      };

      toast.info('API Request', {
        description: `Model: ${requestDetails.model} | Reasoning: ${requestDetails.reasoning_effort} | Format: ${requestDetails.response_format}`,
        duration: 3000,
        source: 'usePromptRunner.handleRunPrompt',
        details: JSON.stringify(requestDetails, null, 2),
      });

      let result: any;
      let tracingResult = { traceId: null as string | null, spanId: null as string | null };

      // Question loop variables for question nodes
      let currentResponseId: string | null = null;
      let lastAnswer: string | null = null;
      let lastVariableName: string | null = null;
      let lastCallId: string | null = null;
      const MAX_QUESTION_ATTEMPTS = 10;
      const accumulatedVars: Record<string, string> = {};

      try {
        // Question-aware execution loop
        for (let questionAttempt = 0; questionAttempt < MAX_QUESTION_ATTEMPTS; questionAttempt++) {
          const runOptions = currentResponseId ? {
            resumeResponseId: currentResponseId,
            resumeAnswer: lastAnswer,
            resumeVariableName: lastVariableName,
            resumeCallId: lastCallId,
          } : {};

          result = await runPrompt(promptId, null, accumulatedVars, runOptions);

          // Check for question interrupt
          if (result?.interrupted && result.interruptType === 'question') {
            const answer = await showQuestion({
              question: result.interruptData.question,
              variableName: result.interruptData.variableName,
              description: result.interruptData.description,
              promptName: promptData?.prompt_name,
              maxQuestions: MAX_QUESTION_ATTEMPTS,
            });

            if (answer === null) {
              toast.info('Question cancelled');
              endSingleRun();
              setRunStartingFor(null);
              return;
            }

            accumulatedVars[result.interruptData.variableName] = answer;
            addCollectedQuestionVar(result.interruptData.variableName, answer);
            currentResponseId = result.interruptData.responseId;
            lastAnswer = answer;
            lastVariableName = result.interruptData.variableName;
            lastCallId = result.interruptData.callId;
            continue;
          }

          break;
        }

        tracingResult = await tracingPromise;
      } catch (runError: any) {
        tracingResult = await tracingPromise;
        const { traceId, spanId } = tracingResult;

        if (spanId) {
          await failSpan({
            span_id: spanId,
            error_evidence: {
              error_type: runError.name || 'Error',
              error_message: runError.message,
              error_code: runError.code || runError.status?.toString(),
              retry_recommended: false,
            },
          }).catch(err => console.warn('Failed to fail span:', err));
        }
        if (traceId) {
          await completeTrace({
            trace_id: traceId,
            status: 'failed',
            error_summary: runError.message,
          }).catch(err => console.warn('Failed to complete trace:', err));
        }
        throw runError;
      }

      const { traceId, spanId } = tracingResult;

      if (result) {
        const latencyMs = Date.now() - startTime!;

        // Complete the span with success
        if (spanId) {
          await completeSpan({
            span_id: spanId,
            status: 'success',
            openai_response_id: result.response_id,
            output: result.response,
            latency_ms: latencyMs,
            usage_tokens: result.usage ? {
              input: result.usage.input_tokens || result.usage.prompt_tokens || 0,
              output: result.usage.output_tokens || result.usage.completion_tokens || 0,
              total: result.usage.total_tokens || ((result.usage.input_tokens || result.usage.prompt_tokens || 0) + (result.usage.output_tokens || result.usage.completion_tokens || 0)),
            } : undefined,
          }).catch(err => console.warn('Failed to complete span:', err));
        }

        // Show API response details toast
        const responseDetails = {
          model: result.model || 'unknown',
          tokens_in: result.usage?.prompt_tokens || 0,
          tokens_out: result.usage?.completion_tokens || 0,
          tokens_total: result.usage?.total_tokens || 0,
          latency: latencyMs,
          finish_reason: result.finish_reason || 'stop',
          response_preview: truncateForLog(result.response, 80),
        };

        toast.success('API Response', {
          description: `${responseDetails.model} | ${responseDetails.tokens_total} tokens | ${responseDetails.latency}ms | ${responseDetails.finish_reason}`,
          duration: 5000,
        });

        // Record cost
        if (result.usage && result.model) {
          try {
            await costTracking.recordCost({
              promptRowId: promptId,
              model: result.model,
              usage: result.usage,
              responseId: result.response_id,
              finishReason: result.finish_reason || 'stop',
              latencyMs,
              promptName: promptData?.prompt_name,
            });
          } catch (costError) {
            console.error('Error recording cost:', costError);
          }
        }

        // Handle action node post-actions
        const hasPostAction = !!promptData?.post_action;
        const isActionEffective = promptData?.node_type === 'action' || hasPostAction;

        if (isActionEffective && result.response && hasPostAction) {
          await handlePostAction(
            promptId,
            promptData!,
            result.response,
          );
        }

        // Refresh the prompt data if this is the selected prompt
        if (promptId === selectedPromptId) {
          const data = await fetchItemData(promptId);
          setSelectedPromptData(data);
        }
        refreshTreeData();

        // Complete trace on success
        if (traceId) {
          await completeTrace({
            trace_id: traceId,
            status: 'completed',
          }).catch(err => console.warn('Failed to complete trace:', err));
        }
      }
    } catch (outerError: any) {
      console.error('Run prompt failed:', outerError);
      toast.error('Failed to run prompt', {
        description: outerError.message || 'An unexpected error occurred',
        source: 'usePromptRunner.handleRunPrompt',
        details: JSON.stringify({
          promptId,
          error: outerError.message,
          stack: outerError.stack,
        }, null, 2),
      });
    } finally {
      endSingleRun();
      setTimeout(() => setRunStartingFor(null), 1000);
    }
  }, [
    runStartingFor,
    flushPendingSaves,
    runPrompt,
    selectedPromptId,
    fetchItemData,
    refreshTreeData,
    startTrace,
    createSpan,
    completeSpan,
    failSpan,
    completeTrace,
    startSingleRun,
    endSingleRun,
    showQuestion,
    addCollectedQuestionVar,
    showActionPreview,
    costTracking,
    setSelectedPromptData,
    supabase,
    currentUserId,
    setExpandedFolders,
  ]);

  /**
   * Handle post-action processing for action nodes
   */
  const handlePostAction = async (
    promptId: string,
    promptData: PromptData,
    response: string,
  ): Promise<void> => {
    try {
      const jsonResponse = extractJsonFromResponse(response);

      // Update extracted_variables in DB
      await supabase
        .from(import.meta.env.VITE_PROMPTS_TBL)
        .update({ extracted_variables: jsonResponse })
        .eq('row_id', promptId);

      // Validate response before executing action
      const validation = validateActionResponse(
        jsonResponse,
        promptData.post_action_config,
        promptData.post_action
      );

      if (!validation.valid) {
        toast.error('Action validation failed', {
          description: validation.error,
          source: 'usePromptRunner.handlePostAction',
        });

        await supabase
          .from(import.meta.env.VITE_PROMPTS_TBL)
          .update({
            last_action_result: {
              status: 'failed',
              error: validation.error,
              available_arrays: validation.availableArrays,
              executed_at: new Date().toISOString(),
            }
          })
          .eq('row_id', promptId);

        return;
      }

      // Show preview unless skip_preview is true
      const skipPreview = promptData.post_action_config?.skip_preview === true;

      if (!skipPreview && promptData.post_action === 'create_children_json') {
        const confirmed = await showActionPreview({
          jsonResponse,
          config: promptData.post_action_config,
          promptName: promptData.prompt_name,
        });

        if (!confirmed) {
          toast.info('Action cancelled by user');

          await supabase
            .from(import.meta.env.VITE_PROMPTS_TBL)
            .update({
              last_action_result: {
                status: 'cancelled',
                reason: 'user_cancelled',
                executed_at: new Date().toISOString(),
              }
            })
            .eq('row_id', promptId);

          return;
        }
      }

      // Execute post-action
      const actionResult = await executePostAction({
        supabase,
        prompt: promptData,
        jsonResponse,
        actionId: promptData.post_action,
        config: promptData.post_action_config,
        context: { userId: currentUserId },
      });

      // Store execution result
      await supabase
        .from(import.meta.env.VITE_PROMPTS_TBL)
        .update({
          last_action_result: {
            status: actionResult.success ? 'success' : 'failed',
            created_count: actionResult.createdCount || 0,
            target_parent_id: actionResult.targetParentRowId,
            message: actionResult.message,
            error: actionResult.error || null,
            executed_at: new Date().toISOString(),
          }
        })
        .eq('row_id', promptId);

      if (actionResult.success) {
        toast.success(`Action completed: ${actionResult.message || 'Success'}`);
        await refreshTreeData();

        // Auto-expand the parent prompt
        if (actionResult.data?.createdCount > 0) {
          const parentId = actionResult.data?.placement === 'children'
            ? promptData.row_id
            : (actionResult.data?.placement === 'specific_prompt'
                ? actionResult.data?.targetParentRowId
                : promptData.parent_row_id);
          if (parentId) {
            setExpandedFolders(prev => ({ ...prev, [parentId]: true }));
          }
        }

        // Process variable assignments
        if (promptData.variable_assignments_config?.enabled && jsonResponse) {
          try {
            const varResult = await processVariableAssignments({
              supabase,
              promptRowId: promptData.row_id,
              jsonResponse,
              config: promptData.variable_assignments_config,
              onVariablesChanged: (pId: string) => {
                window.dispatchEvent(new CustomEvent('q:prompt-variables-updated', {
                  detail: { promptRowId: pId }
                }));
              },
            });
            if (varResult.processed > 0) {
              toast.success(`Updated ${varResult.processed} variable(s)`);
            }
          } catch (varError) {
            console.error('Variable assignment processing failed:', varError);
          }
        }

        // Auto-run created children if enabled
        if (promptData.auto_run_children && actionResult.children?.length > 0) {
          toast.info(`Auto-running ${actionResult.children.length} created child prompt(s)...`);

          try {
            const cascadeResult = await executeChildCascade(
              actionResult.children,
              promptData,
              { maxDepth: 99 }
            );

            if (cascadeResult.depthLimitReached) {
              toast.warning('Auto-cascade depth limit reached (99 levels)');
            } else {
              const successCount = cascadeResult.results.filter((r: any) => r.success).length;
              toast.success(`Auto-cascade complete: ${successCount}/${cascadeResult.results.length} succeeded`);
            }

            await refreshTreeData();
          } catch (cascadeError: any) {
            console.error('Auto-cascade error:', cascadeError);
            toast.error('Auto-cascade failed: ' + cascadeError.message);
          }
        }
      } else {
        toast.warning(`Action failed: ${actionResult.error}`);
      }
    } catch (jsonError: any) {
      console.warn('Action node response not valid JSON:', jsonError);
      toast.warning('Action node response not valid JSON');

      await supabase
        .from(import.meta.env.VITE_PROMPTS_TBL)
        .update({
          last_action_result: {
            status: 'failed',
            error: `JSON parse error: ${jsonError.message}`,
            executed_at: new Date().toISOString(),
          }
        })
        .eq('row_id', promptId);
    }
  };

  /**
   * Handler for running a cascade
   */
  const handleRunCascade = useCallback(async (topLevelPromptId: string): Promise<void> => {
    if (!topLevelPromptId) return;

    // CRITICAL: Wait for any pending field saves to complete before cascade
    await flushPendingSaves();

    // Check if prompt has children
    const hasKids = await checkHasChildren(topLevelPromptId);
    if (!hasKids) {
      toast.info('No children to cascade', {
        source: 'usePromptRunner.handleRunCascade',
      });
      return;
    }

    try {
      await executeCascade(topLevelPromptId, null);
      refreshTreeData();
    } catch (error: any) {
      console.error('Cascade error:', error);
      toast.error('Cascade failed', {
        description: error.message,
        source: 'usePromptRunner.handleRunCascade',
      });
    }
  }, [executeCascade, checkHasChildren, refreshTreeData, flushPendingSaves]);

  return {
    handleRunPrompt,
    handleRunCascade,
    isRunningPrompt,
    isCascadeRunning,
    runProgress,
    singleRunPromptId,
    currentCascadePromptId,
    cancelRun,
  };
};

export default usePromptRunner;
