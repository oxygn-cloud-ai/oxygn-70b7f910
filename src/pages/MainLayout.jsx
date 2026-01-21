// MainLayout - Primary application layout and state management
import { useState, useEffect, useCallback, useMemo } from "react";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { motion, AnimatePresence } from "framer-motion";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import NavigationRail from "@/components/layout/NavigationRail";
import EdgeTrigger from "@/components/layout/EdgeTrigger";
import TopBar from "@/components/layout/TopBar";
import FolderPanel from "@/components/layout/FolderPanel";
import TemplatesFolderPanel from "@/components/layout/TemplatesFolderPanel";
import SubmenuPanel from "@/components/layout/SubmenuPanel";
import ReadingPane from "@/components/layout/ReadingPane";
import ConversationPanel from "@/components/layout/ConversationPanel";
import ExportPanel from "@/components/layout/ExportPanel";
// SearchModal removed - replaced by LiveApiDashboard in TopBar
import NewPromptChoiceDialog from "@/components/NewPromptChoiceDialog";
import SaveAsTemplateDialog from "@/components/SaveAsTemplateDialog";
import { useSupabase } from "@/hooks/useSupabase";
import useTreeData from "@/hooks/useTreeData";
import { useTreeOperations } from "@/hooks/useTreeOperations";
import { usePromptData } from "@/hooks/usePromptData";
import { usePromptVariables } from "@/hooks/usePromptVariables";
import { useThreads } from "@/hooks/useThreads";
import { useExport } from "@/hooks/useExport";
import { useSettings } from "@/hooks/useSettings";
import { useModels } from "@/hooks/useModels";
import { usePromptLibrary } from "@/hooks/usePromptLibrary";
import { useTemplates } from "@/hooks/useTemplates";
import { useJsonSchemaTemplates } from "@/hooks/useJsonSchemaTemplates";
import { useConversationRun } from "@/hooks/useConversationRun";
import { useCascadeExecutor } from "@/hooks/useCascadeExecutor";
import { useCostTracking } from "@/hooks/useCostTracking";
import { useConversationToolDefaults } from "@/hooks/useConversationToolDefaults";
import { usePromptFamilyChat } from "@/hooks/usePromptFamilyChat";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { useRenderPerformance } from "@/hooks/useRenderPerformance";
import { useLayoutState } from "@/hooks/useLayoutState";
import { usePromptSelection } from "@/hooks/usePromptSelection";
import { toast, setThemePreference, getThemePreference } from "@/components/ui/sonner";
import { Loader2, PanelLeft, PanelLeftOpen } from "lucide-react";
import { executePostAction, processVariableAssignments } from "@/services/actionExecutors";
import { validateActionResponse, extractJsonFromResponse } from "@/utils/actionValidation";
import ActionPreviewDialog from "@/components/ActionPreviewDialog";
import QuestionPopup from "@/components/QuestionPopup";
import { useAuth } from "@/contexts/AuthContext";
import { useUndo } from "@/contexts/UndoContext";
import { useCascadeRun } from "@/contexts/CascadeRunContext";
import { useApiCallContext } from "@/contexts/ApiCallContext";
import { useExecutionTracing } from "@/hooks/useExecutionTracing";
import { usePendingSaves } from "@/contexts/PendingSaveContext";

// Initial loading screen component
const LoadingScreen = () => (
  <motion.div 
    className="h-screen w-full flex flex-col items-center justify-center bg-surface gap-4"
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
  >
    <motion.img 
      src="/Qonsol-Full-Logo_Transparent_NoBuffer.png" 
      alt="Qonsol Logo" 
      className="h-12 w-auto"
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ delay: 0.1 }}
    />
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.2 }}
      className="flex items-center gap-2 text-on-surface-variant"
    >
      <Loader2 className="h-4 w-4 animate-spin" />
      <span className="text-tree">Loading workspace...</span>
    </motion.div>
  </motion.div>
);

const MainLayout = () => {
  // Track render performance for main layout
  useRenderPerformance('MainLayout');
  
  // Real data hooks
  const supabase = useSupabase();
  const { user: currentUser } = useAuth();
  const { treeData, isLoading: isLoadingTree, refreshTreeData } = useTreeData(supabase);
  const { 
    handleAddItem, 
    handleDeleteItem, 
    handleDuplicateItem, 
    handleMoveItem, 
    handleRestoreDeleted, 
    handleRestoreMove,
    // Batch operations
    handleBatchDelete,
    handleBatchDuplicate,
    handleBatchStar,
    handleBatchToggleExcludeCascade,
    handleBatchToggleExcludeExport,
    // Deleting state for UI feedback
    deletingPromptIds
  } = useTreeOperations(supabase, refreshTreeData);
  const { updateField, fetchItemData } = usePromptData(supabase);
  
  // treeData is already hierarchical from useTreeData (buildTree is called in fetchPrompts)
  const hierarchicalTreeData = treeData || [];
  
  // API call context (navigation guard removed - calls continue in background)
  
  // Layout state from extracted hook
  const {
    isDark,
    setIsDark,
    layoutResetNonce,
    handleResetLayout: baseHandleResetLayout,
    folderPanelOpen,
    setFolderPanelOpen,
    navRailOpen,
    setNavRailOpen,
    readingPaneOpen,
    setReadingPaneOpen,
    conversationPanelOpen,
    setConversationPanelOpen,
    activeNav,
    setActiveNav,
    activeSubItem,
    setActiveSubItem,
    hoveredNav,
    setHoveredNav,
    selectedTemplate,
    setSelectedTemplate,
    activeTemplateTab,
    setActiveTemplateTab,
    // searchOpen removed - replaced by LiveApiDashboard
    templateDialogOpen,
    setTemplateDialogOpen,
    saveAsTemplateDialogOpen,
    setSaveAsTemplateDialogOpen,
    saveAsTemplateSource,
    setSaveAsTemplateSource,
    handleSaveAsTemplate,
    isInitialLoad,
    setIsInitialLoad,
    submenuRef,
    hoverTimeoutRef,
  } = useLayoutState();
  
  // Selected prompt state from extracted hook
  const {
    selectedPromptId,
    setSelectedPromptId,
    selectedPromptData,
    setSelectedPromptData,
    isLoadingPrompt,
    expandedFolders,
    setExpandedFolders,
    toggleFolder,
    handleSelectPrompt,
  } = usePromptSelection(fetchItemData);
  
  // Prompt variables for selected prompt
  const { 
    variables, 
    isLoading: isLoadingVariables, 
    addVariable, 
    updateVariable, 
    deleteVariable 
  } = usePromptVariables(selectedPromptId);
  
  // Get assistant row id from selected prompt data for threads
  const assistantRowId = selectedPromptData?.is_assistant ? 
    treeData?.find(p => p.row_id === selectedPromptId)?.assistant_row_id : null;
  
  // Threads and messages for conversation panel
  const {
    threads,
    activeThread,
    setActiveThread,
    messages,
    isLoading: isLoadingThreads,
    isLoadingMessages,
    createThread,
    deleteThread,
    fetchMessages,
    renameThread,
  } = useThreads(assistantRowId, selectedPromptId);
  
  // Export hook - Phase 5
  const exportState = useExport();
  
  // Settings hook - Phase 6
  const { settings, updateSetting, isLoading: isLoadingSettings } = useSettings(supabase);
  
  // Models hook - Phase 6
  const { models, isLoading: isLoadingModels, toggleModelActive, addModel, updateModel, deleteModel, addModels } = useModels();
  
  // Manus model lookup function - checks if a prompt uses a Manus model (requires cascade execution)
  const isManusModelById = useCallback((promptId) => {
    // Find the prompt in the tree to get its model
    const findPrompt = (items) => {
      for (const item of items) {
        if ((item.id || item.row_id) === promptId) return item;
        if (item.children) {
          const found = findPrompt(item.children);
          if (found) return found;
        }
      }
      return null;
    };
    
    const prompt = findPrompt(hierarchicalTreeData);
    if (!prompt?.model) return false;
    
    const modelData = models.find(m => m.model_id === prompt.model || m.model_name === prompt.model);
    return modelData?.provider === 'manus';
  }, [hierarchicalTreeData, models]);
  
  // Prompt library hook (used by templates/prompts)
  const promptLibrary = usePromptLibrary();
  
  // Template hooks - Phase 8-9
  const templatesHook = useTemplates();
  const jsonSchemaTemplatesHook = useJsonSchemaTemplates();
  
  // Cost tracking hook - Phase 4
  const costTracking = useCostTracking();
  
  // Conversation tool defaults - Phase 4
  const conversationToolDefaults = useConversationToolDefaults();
  
  // Prompt Family Chat hook - for knowledge-enhanced conversations about prompt families
  const promptFamilyChat = usePromptFamilyChat(selectedPromptId);
  
  // Execution tracing for single prompt runs
  const { startTrace, createSpan, completeSpan, failSpan, completeTrace, cleanupOrphanedTraces } = useExecutionTracing();
  
  // Cleanup orphaned traces on mount (once per session)
  useEffect(() => {
    if (currentUser?.id) {
      cleanupOrphanedTraces().catch(err => console.warn('Failed to cleanup orphaned traces:', err));
    }
  }, [currentUser?.id, cleanupOrphanedTraces]);
  
  // Fetch messages when active thread changes
  useEffect(() => {
    if (activeThread?.row_id) {
      fetchMessages(activeThread.row_id);
    }
  }, [activeThread?.row_id, fetchMessages]);
  
  // Wrap handleAddItem to auto-select newly created prompts
  const handleAddPrompt = useCallback(async (parentId, options) => {
    const result = await handleAddItem(parentId, options);
    // Auto-select the new prompt if creation succeeded
    if (result?.[0]?.row_id) {
      setSelectedPromptId(result[0].row_id);
    }
    return result;
  }, [handleAddItem]);
  
  // Handle field updates
  const handleUpdateField = useCallback(async (fieldName, value) => {
    if (!selectedPromptId) return false;
    const success = await updateField(selectedPromptId, fieldName, value);
    if (success) {
      setSelectedPromptData(prev => prev ? { ...prev, [fieldName]: value } : null);
    }
    return success;
  }, [selectedPromptId, updateField]);
  
  // Phase 1: Run prompt and cascade hooks
  const { runPrompt, runConversation, cancelRun, isRunning: isRunningPromptInternal, progress: runProgress } = useConversationRun();
  const { executeCascade, hasChildren: checkHasChildren, executeChildCascade } = useCascadeExecutor();
  const { isRunning: isCascadeRunning, currentPromptRowId: currentCascadePromptId, singleRunPromptId, actionPreview, showActionPreview, resolveActionPreview, startSingleRun, endSingleRun, pendingQuestion, questionProgress, collectedQuestionVars, resolveQuestion, showQuestion, addCollectedQuestionVar } = useCascadeRun();
  // Note: Use isCascadeRunning from useCascadeRun() context as single source of truth
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [runStartingFor, setRunStartingFor] = useState(null); // Debounce state for run button
  
  // Combined running state: true if hook is running OR we have an immediate single run request
  const isRunningPrompt = isRunningPromptInternal || singleRunPromptId !== null;
  
  // Helper to truncate long text for toast display
  const truncateForLog = (text, maxLen = 50) => {
    if (!text) return '[empty]';
    if (text.length <= maxLen) return text;
    return `${text.slice(0, maxLen)}...`;
  };

  // Access pending save registry for flushing before runs
  const { flushPendingSaves } = usePendingSaves();

  // Handler for running a single prompt
  const handleRunPrompt = useCallback(async (promptId) => {
    if (!promptId) return;
    
    // Debounce: prevent rapid clicking
    if (runStartingFor === promptId) {
      toast.info('Run already starting...', { duration: 2000 });
      return;
    }
    
    // IMMEDIATE: Set single run state for instant UI feedback via context
    setRunStartingFor(promptId);
    startSingleRun(promptId);
    
    let promptData;
    let startTime;
    
    try {
      // CRITICAL: Wait for any pending field saves to complete before fetching
      // This ensures we get the latest system prompt, user prompt, etc. from the database
      await flushPendingSaves();
    
      // Fetch prompt data to check if it's an action node
      promptData = await fetchItemData(promptId);
      startTime = Date.now();
    
      // Start execution trace in background (non-blocking for UI)
    // We'll await the result after runPrompt completes
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

    // Determine response format - action nodes with schema template use structured output
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
      json_schema_template_id: promptData?.json_schema_template_id || null,
    };
    
    toast.info('API Request', {
      description: `Model: ${requestDetails.model} | Reasoning: ${requestDetails.reasoning_effort} | Format: ${requestDetails.response_format}`,
      duration: 3000,
      source: 'MainLayout.handleRunPrompt',
      details: JSON.stringify(requestDetails, null, 2),
    });
    
    let result;
    let tracingResult = { traceId: null, spanId: null };
    
    // Question loop variables for question nodes
    let currentResponseId = null;
    let lastAnswer = null;
    let lastVariableName = null;
    const MAX_QUESTION_ATTEMPTS = 10;
    const accumulatedVars = {}; // Accumulate question answers for template variables
    
    try {
      // Question-aware execution loop
      for (let questionAttempt = 0; questionAttempt < MAX_QUESTION_ATTEMPTS; questionAttempt++) {
        // Build resume options if we're resuming after a question answer
        const runOptions = currentResponseId ? {
          resumeResponseId: currentResponseId,
          resumeAnswer: lastAnswer,
          resumeVariableName: lastVariableName,
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
            // User cancelled the question
            toast.info('Question cancelled');
            endSingleRun();
            setRunStartingFor(null);
            return;
          }
          
          // Store answer for template variables and continue loop
          accumulatedVars[result.interruptData.variableName] = answer;
          addCollectedQuestionVar(result.interruptData.variableName, answer);
          currentResponseId = result.interruptData.responseId;
          lastAnswer = answer;
          lastVariableName = result.interruptData.variableName;
          continue; // Loop again with answer
        }
        
        // Normal completion - break the loop
        break;
      }
      
      // Now await tracing promise after run completes
      tracingResult = await tracingPromise;
    } catch (runError) {
      // Wait for tracing to complete before failing
      tracingResult = await tracingPromise;
      const { traceId, spanId } = tracingResult;
      // Fail span and trace if error occurred
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
      const latencyMs = Date.now() - startTime;
      
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
      
      // Record cost and update metadata with USD costs
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
      // Safety: run if node_type is 'action' OR if post_action is configured (DB trigger ensures consistency)
      const hasPostAction = !!promptData?.post_action;
      const isActionEffective = promptData?.node_type === 'action' || hasPostAction;
      
      if (isActionEffective && result.response && hasPostAction) {
        // Warn if state is inconsistent (should be auto-fixed by DB trigger, but log for debugging)
        if (hasPostAction && promptData?.node_type !== 'action') {
          console.warn(`Prompt ${promptId} has post_action but node_type='${promptData?.node_type}'. Executing anyway.`);
        }
        try {
          // Extract JSON from response
          const jsonResponse = extractJsonFromResponse(result.response);
          
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
              source: 'MainLayout.handleRunPrompt.validation',
              details: JSON.stringify(validation, null, 2),
            });
            
            // Store failed result
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
            
            // Refresh the prompt data if this is the selected prompt
            if (promptId === selectedPromptId) {
              const data = await fetchItemData(promptId);
              setSelectedPromptData(data);
            }
            return result;
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
              
              // Store cancelled result
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
              
              // Refresh the prompt data if this is the selected prompt
              if (promptId === selectedPromptId) {
                const data = await fetchItemData(promptId);
                setSelectedPromptData(data);
              }
              return result;
            }
          }
          
          // Execute post-action
          const actionResult = await executePostAction({
            supabase,
            prompt: promptData,
            jsonResponse,
            actionId: promptData.post_action,
            config: promptData.post_action_config,
            context: { userId: currentUser?.id },
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
            toast.success(`Action completed: ${actionResult.message || 'Success'}`, {
              source: 'MainLayout.handleRunPrompt.postAction',
              details: JSON.stringify({
                promptRowId: promptData.row_id,
                promptName: promptData.prompt_name,
                action: promptData.post_action,
                result: actionResult,
              }, null, 2),
            });
            // Immediately refresh tree to show newly created children
            await refreshTreeData();
            
            // Auto-expand the parent prompt so user can see the new children
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

            // Process variable assignments if configured
            if (promptData.variable_assignments_config?.enabled && jsonResponse) {
              try {
          const varResult = await processVariableAssignments({
            supabase,
            promptRowId: promptData.row_id,
            jsonResponse,
            config: promptData.variable_assignments_config,
            onVariablesChanged: (promptId) => {
              window.dispatchEvent(new CustomEvent('q:prompt-variables-updated', { 
                detail: { promptRowId: promptId } 
              }));
            },
          });
                if (varResult.processed > 0) {
                  toast.success(`Updated ${varResult.processed} variable(s)`, {
                    source: 'MainLayout.handleRunPrompt.variableAssignments',
                  });
                }
                if (varResult.errors.length > 0) {
                  console.warn('Variable assignment errors:', varResult.errors);
                }
              } catch (varError) {
                console.error('Variable assignment processing failed:', varError);
                // Don't fail the whole operation for variable assignment errors
              }
            }

            // Auto-run created children if enabled
            if (
              promptData.auto_run_children && 
              actionResult.children?.length > 0
            ) {
              toast.info(`Auto-running ${actionResult.children.length} created child prompt(s)...`, {
                source: 'MainLayout.handleRunPrompt.autoCascade',
              });
              
              try {
                const cascadeResult = await executeChildCascade(
                  actionResult.children,
                  promptData,
                  { maxDepth: 99 }
                );
                
                if (cascadeResult.depthLimitReached) {
                  toast.warning('Auto-cascade depth limit reached (99 levels)');
                } else {
                  const successCount = cascadeResult.results.filter(r => r.success).length;
                  toast.success(`Auto-cascade complete: ${successCount}/${cascadeResult.results.length} succeeded`, {
                    source: 'MainLayout.handleRunPrompt.autoCascade',
                  });
                }
                
                // Refresh tree after auto-cascade
                await refreshTreeData();
              } catch (cascadeError) {
                console.error('Auto-cascade error:', cascadeError);
                toast.error('Auto-cascade failed: ' + cascadeError.message, {
                  source: 'MainLayout.handleRunPrompt.autoCascade',
                });
              }
            }
          } else {
            toast.warning(`Action failed: ${actionResult.error}`, {
              source: 'MainLayout.handleRunPrompt.postAction',
              errorCode: 'POST_ACTION_FAILED',
              details: JSON.stringify({
                promptRowId: promptData.row_id,
                promptName: promptData.prompt_name,
                action: promptData.post_action,
                config: promptData.post_action_config,
                error: actionResult.error,
                result: actionResult,
              }, null, 2),
            });
          }
        } catch (jsonError) {
          console.warn('Action node response not valid JSON:', jsonError);
          toast.warning('Action node response not valid JSON', {
            source: 'MainLayout.handleRunPrompt.postAction',
            errorCode: 'JSON_PARSE_ERROR',
            details: JSON.stringify({
              promptRowId: promptData.row_id,
              promptName: promptData.prompt_name,
              error: jsonError.message,
              stack: jsonError.stack,
            }, null, 2),
          });
          
          // Store parse error result
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
    } catch (outerError) {
      // Catch errors from flushPendingSaves, fetchItemData, or any uncaught errors
      console.error('Run prompt failed:', outerError);
      toast.error('Failed to run prompt', {
        description: outerError.message || 'An unexpected error occurred',
        source: 'MainLayout.handleRunPrompt',
        details: JSON.stringify({
          promptId,
          error: outerError.message,
          stack: outerError.stack,
        }, null, 2),
      });
    } finally {
      // Clear single run state via context
      endSingleRun();
      // Reset debounce state after 1 second to prevent accidental double-clicks
      setTimeout(() => setRunStartingFor(null), 1000);
    }
  }, [runStartingFor, flushPendingSaves, runPrompt, selectedPromptId, fetchItemData, refreshTreeData, supabase, currentUser?.id, costTracking, startTrace, createSpan, completeSpan, failSpan, completeTrace, startSingleRun, endSingleRun, showActionPreview]);
  
  // Handler for running a cascade
  const handleRunCascade = useCallback(async (topLevelPromptId) => {
    if (!topLevelPromptId) return;
    
    // CRITICAL: Wait for any pending field saves to complete before cascade
    // This ensures we get the latest prompts from the database
    await flushPendingSaves();
    
    // Check if prompt has children
    const hasKids = await checkHasChildren(topLevelPromptId);
    if (!hasKids) {
      toast.info("No children to cascade", {
        source: 'MainLayout.handleRunCascade',
        details: JSON.stringify({ promptRowId: topLevelPromptId }, null, 2),
      });
      return;
    }
    
    // Cascade running state is managed by useCascadeRun context
    try {
      await executeCascade(topLevelPromptId, null);
      // Note: Success toast with details is handled by useCascadeExecutor
      refreshTreeData();
    } catch (error) {
      console.error("Cascade error:", error);
      toast.error("Cascade failed", { 
        description: error.message,
        source: 'MainLayout.handleRunCascade',
        errorCode: 'CASCADE_ERROR',
        details: JSON.stringify({
          promptRowId: topLevelPromptId,
          error: error.message,
          stack: error.stack,
        }, null, 2),
      });
    } finally {
      // State cleanup handled by context
    }
  }, [executeCascade, checkHasChildren, refreshTreeData, flushPendingSaves]);
  
  // Handler for starring/unstarring a prompt
  const handleToggleStar = useCallback(async (promptId) => {
    if (!promptId) return;
    
    // Find the prompt to get current starred status
    const findPrompt = (items, id) => {
      for (const item of items) {
        if ((item.row_id || item.id) === id) return item;
        if (item.children) {
          const found = findPrompt(item.children, id);
          if (found) return found;
        }
      }
      return null;
    };
    
    const prompt = findPrompt(hierarchicalTreeData, promptId);
    const newStarred = !(prompt?.starred);
    
    const success = await updateField(promptId, 'starred', newStarred);
    if (success) {
      toast.success(newStarred ? "Starred" : "Unstarred");
      refreshTreeData();
    }
  }, [hierarchicalTreeData, updateField, refreshTreeData]);
  
  // Handler for toggling exclude from cascade
  const handleToggleExcludeCascade = useCallback(async (promptId) => {
    if (!promptId) return;
    
    const findPrompt = (items, id) => {
      for (const item of items) {
        if ((item.row_id || item.id) === id) return item;
        if (item.children) {
          const found = findPrompt(item.children, id);
          if (found) return found;
        }
      }
      return null;
    };
    
    const prompt = findPrompt(hierarchicalTreeData, promptId);
    const newExcluded = !(prompt?.exclude_from_cascade);
    
    const success = await updateField(promptId, 'exclude_from_cascade', newExcluded);
    if (success) {
      toast.success(newExcluded ? "Excluded from cascade" : "Included in cascade");
      refreshTreeData();
    }
  }, [hierarchicalTreeData, updateField, refreshTreeData]);
  
  // Handler for toggling exclude from export
  const handleToggleExcludeExport = useCallback(async (promptId) => {
    if (!promptId) return;
    
    const findPrompt = (items, id) => {
      for (const item of items) {
        if ((item.row_id || item.id) === id) return item;
        if (item.children) {
          const found = findPrompt(item.children, id);
          if (found) return found;
        }
      }
      return null;
    };
    
    const prompt = findPrompt(hierarchicalTreeData, promptId);
    const newExcluded = !(prompt?.exclude_from_export);
    
    const success = await updateField(promptId, 'exclude_from_export', newExcluded);
    if (success) {
      toast.success(newExcluded ? "Excluded from export" : "Included in export");
      refreshTreeData();
    }
  }, [hierarchicalTreeData, updateField, refreshTreeData]);
  
  // Phase 2: Handler for sending conversation messages
  const handleSendConversationMessage = useCallback(async (message) => {
    if (!selectedPromptId || !message.trim()) return;
    
    setIsSendingMessage(true);
    try {
      // If no active thread exists, create one first
      let threadToUse = activeThread;
      if (!threadToUse && createThread) {
        threadToUse = await createThread("New Conversation");
        if (!threadToUse) {
          throw new Error("Failed to create thread");
        }
      }
      
      // Run the conversation
      await runConversation({
        childPromptRowId: selectedPromptId,
        userMessage: message,
        threadMode: selectedPromptData?.thread_mode || 'reuse',
        existingThreadRowId: threadToUse?.row_id,
        store_in_history: true,
      });
      
      // Refresh messages for the active thread
      if (threadToUse?.row_id) {
        await fetchMessages(threadToUse.row_id);
      }
    } catch (error) {
      console.error("Error sending message:", error);
      toast.error("Failed to send message", { description: error.message });
    } finally {
      setIsSendingMessage(false);
    }
  }, [selectedPromptId, activeThread, createThread, runConversation, selectedPromptData, fetchMessages]);
  
  // Check if selected prompt has children (recursively search tree)
  const selectedPromptHasChildren = useMemo(() => {
    if (!selectedPromptId || !treeData) return false;
    
    // Recursive function to find a node by ID and check if it has children
    const findNodeAndCheckChildren = (nodes, targetId) => {
      for (const node of nodes) {
        if (node.row_id === targetId) {
          return node.children && node.children.length > 0;
        }
        if (node.children && node.children.length > 0) {
          const result = findNodeAndCheckChildren(node.children, targetId);
          if (result !== null) return result;
        }
      }
      return null; // Node not found in this branch
    };
    
    const hasChildren = findNodeAndCheckChildren(treeData, selectedPromptId);
    return hasChildren === true;
  }, [selectedPromptId, treeData]);

  // Get undo context for keyboard shortcut
  const { undoStack, clearUndo } = useUndo();
  
  // Wrap baseHandleResetLayout to add toast
  const handleResetLayout = useCallback(() => {
    baseHandleResetLayout();
    toast.success('Layout reset to defaults');
  }, [baseHandleResetLayout]);

  // Initial load state
  useEffect(() => {
    if (!isLoadingTree && !isLoadingSettings) {
      // Small delay for smooth transition
      const timer = setTimeout(() => setIsInitialLoad(false), 500);
      return () => clearTimeout(timer);
    }
  }, [isLoadingTree, isLoadingSettings, setIsInitialLoad]);

  // Handle undo via keyboard shortcut (undoes last action)
  const handleUndo = useCallback(async () => {
    if (undoStack.length === 0) {
      toast.info('Nothing to undo');
      return;
    }
    
    const lastAction = undoStack[undoStack.length - 1];
    
    if (lastAction.type === 'delete') {
      await handleRestoreDeleted(lastAction.id, lastAction.itemId, lastAction.itemName);
    } else if (lastAction.type === 'move') {
      await handleRestoreMove(lastAction.id, lastAction.itemId, lastAction.originalParentId, lastAction.itemName);
    }
  }, [undoStack, handleRestoreDeleted, handleRestoreMove]);

  // Handle undo for a specific action (from undo history panel)
  const handleUndoAction = useCallback(async (action) => {
    if (action.type === 'delete') {
      await handleRestoreDeleted(action.id, action.itemId, action.itemName);
    } else if (action.type === 'move') {
      await handleRestoreMove(action.id, action.itemId, action.originalParentId, action.itemName);
    }
  }, [handleRestoreDeleted, handleRestoreMove]);

  // Keyboard shortcuts (search removed - replaced by LiveApiDashboard)
  useKeyboardShortcuts({
    onToggleFolderPanel: () => setFolderPanelOpen(prev => !prev),
    onToggleConversationPanel: () => {
      if (activeNav === "prompts") {
        setConversationPanelOpen(prev => !prev);
      }
    },
    onSave: () => {
      // Save current item - could trigger template save or prompt save
      toast.info("Save triggered (Cmd+S)");
    },
    onRun: () => {
      if (selectedPromptId) {
        handleRunPrompt(selectedPromptId);
      }
    },
    onEscape: () => {
      if (searchOpen) {
        setSearchOpen(false);
      } else if (exportState.isOpen) {
        exportState.closeExport();
      } else if (selectedPromptId) {
        setSelectedPromptId(null);
      }
    },
    onUndo: handleUndo,
    enabled: true,
  });
  
  // Determine if conversation panel should be shown based on active nav
  const showConversationPanel = activeNav === "prompts" && conversationPanelOpen;

  // Toggle dark mode on the document and sync with theme preference changes
  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
    return () => {
      document.documentElement.classList.remove("dark");
    };
  }, [isDark]);

  // Listen for theme preference changes from settings
  useEffect(() => {
    const handleThemeChange = () => {
      const pref = getThemePreference();
      if (pref === 'system') {
        setIsDark(window.matchMedia('(prefers-color-scheme: dark)').matches);
      } else {
        setIsDark(pref === 'dark');
      }
    };
    
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleSystemChange = (e) => {
      if (getThemePreference() === 'system') {
        setIsDark(e.matches);
      }
    };
    
    window.addEventListener('theme-preference-change', handleThemeChange);
    mediaQuery.addEventListener('change', handleSystemChange);
    
    return () => {
      window.removeEventListener('theme-preference-change', handleThemeChange);
      mediaQuery.removeEventListener('change', handleSystemChange);
    };
  }, []);

  // Listen for tree-refresh-needed events (from cascade executor after creating children)
  useEffect(() => {
    const handleTreeRefresh = async (event) => {
      console.log('Tree refresh requested:', event.detail);
      await refreshTreeData();
      
      // If we know the parent, expand it to show new children
      const parentId = event.detail?.parentRowId;
      if (parentId) {
        setExpandedFolders(prev => ({ ...prev, [parentId]: true }));
      }
    };
    
    window.addEventListener('tree-refresh-needed', handleTreeRefresh);
    return () => {
      window.removeEventListener('tree-refresh-needed', handleTreeRefresh);
    };
  }, [refreshTreeData]);

  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
    };
  }, []);

  // Determine what to show in the submenu panel
  // If hovering a nav item, show that nav's submenu
  // Otherwise show the active nav's content
  const displayedNav = hoveredNav || activeNav;
  
  // Check if current displayed nav has a submenu (not prompts or templates which have folder panels)
  const hasSubmenu = (navId) => navId !== "prompts" && navId !== "templates";

  const handleNavHover = (navId) => {
    // Clear any pending timeout
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    setHoveredNav(navId);
  };

  const handleNavLeave = () => {
    // Delay clearing hover to allow mouse to move to submenu
    hoverTimeoutRef.current = setTimeout(() => {
      setHoveredNav(null);
    }, 150);
  };

  const handleSubmenuMouseEnter = () => {
    // Cancel the timeout if mouse enters submenu
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
  };

  const handleSubmenuMouseLeave = () => {
    // When leaving submenu, clear hover state
    setHoveredNav(null);
  };

  const handleSubmenuClick = (navId, itemId) => {
    // Navigate to the parent nav and set the sub-item
    setActiveNav(navId);
    setActiveSubItem(itemId);
    setHoveredNav(null);
  };

  const handleSelectTemplate = (template) => {
    setSelectedTemplate(template);
  };

  // Clear selected template when switching away from templates nav
  useEffect(() => {
    if (activeNav !== "templates") {
      setSelectedTemplate(null);
    }
  }, [activeNav]);

  // Clear sub-item when switching nav, and set defaults for settings/health
  useEffect(() => {
    if (activeNav === "prompts" || activeNav === "templates") {
      setActiveSubItem(null);
    } else if (activeNav === "settings" && !activeSubItem) {
      setActiveSubItem("qonsol");
    } else if (activeNav === "health" && !activeSubItem) {
      setActiveSubItem("overview");
    }
  }, [activeNav]);

  // Auto-open reading pane for views that always need it
  useEffect(() => {
    const viewsRequiringReadingPane = ['templates', 'settings', 'health'];
    if (viewsRequiringReadingPane.includes(activeNav)) {
      setReadingPaneOpen(true);
    }
  }, [activeNav]);

  // Auto-open folder panel for views that use it
  useEffect(() => {
    const viewsRequiringFolderPanel = ['templates', 'prompts'];
    if (viewsRequiringFolderPanel.includes(activeNav)) {
      setFolderPanelOpen(true);
    }
  }, [activeNav]);

  // Render the appropriate panel content
  const renderFolderPanelContent = () => {
    // Always show the active nav's content - don't swap on hover to preserve tree state
    if (activeNav === "prompts") {
      return (
        <FolderPanel 
          treeData={hierarchicalTreeData}
          isLoading={isLoadingTree}
          selectedPromptId={selectedPromptId}
          onSelectPrompt={handleSelectPrompt}
          expandedFolders={expandedFolders}
          onToggleFolder={toggleFolder}
          onAddPrompt={handleAddPrompt}
          onAddFromTemplate={() => setTemplateDialogOpen(true)}
          onDeletePrompt={handleDeleteItem}
          onDuplicatePrompt={handleDuplicateItem}
          onExportPrompt={(id) => exportState.openExport([id])}
          onMovePrompt={handleMoveItem}
          onRefresh={refreshTreeData}
          onClose={() => setFolderPanelOpen(false)}
          onToggleReadingPane={() => setReadingPaneOpen(!readingPaneOpen)}
          readingPaneOpen={readingPaneOpen}
          onRunPrompt={handleRunPrompt}
          onRunCascade={handleRunCascade}
          onToggleStar={handleToggleStar}
          onToggleExcludeCascade={handleToggleExcludeCascade}
          onToggleExcludeExport={handleToggleExcludeExport}
          isRunningPrompt={isRunningPrompt}
          isRunningCascade={isCascadeRunning}
          onBatchDelete={handleBatchDelete}
          onBatchDuplicate={handleBatchDuplicate}
          onBatchStar={handleBatchStar}
          onBatchToggleExcludeCascade={handleBatchToggleExcludeCascade}
          onBatchToggleExcludeExport={handleBatchToggleExcludeExport}
          currentCascadePromptId={currentCascadePromptId}
          isCascadeRunning={isCascadeRunning}
          singleRunPromptId={singleRunPromptId}
          deletingPromptIds={deletingPromptIds}
          onSaveAsTemplate={handleSaveAsTemplate}
          isManusModelById={isManusModelById}
        />
      );
    }
    
    if (activeNav === "templates") {
      return (
        <TemplatesFolderPanel 
          onSelectTemplate={handleSelectTemplate}
          selectedTemplateId={selectedTemplate?.row_id || selectedTemplate?.id}
          activeTemplateTab={activeTemplateTab}
          onTemplateTabChange={setActiveTemplateTab}
          // Phase 8-9: Real templates data
          templates={templatesHook.templates}
          schemaTemplates={jsonSchemaTemplatesHook.templates}
          isLoadingTemplates={templatesHook.isLoading}
          isLoadingSchemas={jsonSchemaTemplatesHook.isLoading}
          onCreateTemplate={templatesHook.createTemplate}
          onDeleteTemplate={templatesHook.deleteTemplate}
          onCreateSchema={jsonSchemaTemplatesHook.createTemplate}
          onDeleteSchema={jsonSchemaTemplatesHook.deleteTemplate}
        />
      );
    }
    
    // For other nav items, show their submenu
    return (
      <SubmenuPanel 
        hoveredNav={activeNav}
        activeSubItem={activeSubItem}
        onItemClick={(itemId) => handleSubmenuClick(activeNav, itemId)}
      />
    );
  };

  // Show loading screen on initial load
  if (isInitialLoad) {
    return <LoadingScreen />;
  }

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="h-screen w-full flex flex-col bg-surface overflow-hidden min-h-0">
        {/* SearchModal removed - replaced by LiveApiDashboard in TopBar */}

        {/* Save As Template Dialog */}
        <SaveAsTemplateDialog
          open={saveAsTemplateDialogOpen}
          onOpenChange={setSaveAsTemplateDialogOpen}
          promptId={saveAsTemplateSource?.id}
          promptName={saveAsTemplateSource?.name}
          hasChildren={saveAsTemplateSource?.hasChildren}
          onSuccess={() => {
            setSaveAsTemplateDialogOpen(false);
            setSaveAsTemplateSource(null);
            templatesHook.fetchTemplates();
          }}
        />

        {/* Main Layout */}
        <div className="flex-1 flex overflow-hidden min-h-0">
          {/* Navigation Rail - 80px - with slide animation */}
          <AnimatePresence mode="wait">
            {navRailOpen && (
              <motion.div
                initial={{ opacity: 0, x: -80 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -80 }}
                transition={{ duration: 0.2 }}
              >
                <NavigationRail 
                  activeNav={activeNav}
                  onNavChange={setActiveNav}
                  onNavHover={handleNavHover}
                  onNavLeave={handleNavLeave}
                  folderPanelOpen={folderPanelOpen}
                  onToggleFolderPanel={() => setFolderPanelOpen(!folderPanelOpen)}
                  onShowShortcuts={() => {}}
                  onHideNavRail={() => setNavRailOpen(false)}
                  onResetLayout={handleResetLayout}
                  settings={settings}
                />
              </motion.div>
            )}
          </AnimatePresence>
          
          {/* Edge trigger when nav rail is hidden */}
          <AnimatePresence>
            {!navRailOpen && (
              <EdgeTrigger
                side="left"
                onClick={() => setNavRailOpen(true)}
                icon={PanelLeft}
                tooltip="Show navigation"
              />
            )}
          </AnimatePresence>

          {/* Content Area */}
          <div className="flex-1 flex flex-col overflow-hidden min-h-0">
            {/* Top Bar - 64dp (search replaced by LiveApiDashboard) */}
            <TopBar 
              isDark={isDark}
              onToggleDark={() => setIsDark(!isDark)}
              onUndoAction={handleUndoAction}
            />

            {/* Main Content with Resizable Panels */}
            <motion.div 
              className="flex-1 flex overflow-hidden min-h-0"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.1 }}
            >
              <ResizablePanelGroup key={layoutResetNonce} direction="horizontal" autoSaveId="qonsol-panel-layout" className="flex-1 min-h-0">
                {/* Folder/Submenu Panel - collapsible */}
                {folderPanelOpen && (
                  <>
                    <ResizablePanel defaultSize={20} minSize={10} maxSize={60}>
                      <div className="h-full min-h-0 overflow-x-auto overflow-y-hidden">
                        {renderFolderPanelContent()}
                      </div>
                    </ResizablePanel>
                    <ResizableHandle withHandle className="bg-outline-variant hover:bg-primary/50 transition-colors" />
                  </>
                )}

                {/* Reading Pane - flexible */}
                {readingPaneOpen && (
                  <ResizablePanel defaultSize={showConversationPanel ? 50 : 80} minSize={15}>
                    <div className="h-full min-h-0 flex flex-col overflow-hidden">
                      <ReadingPane 
                        hasSelection={selectedPromptId !== null} 
                        selectedPromptId={selectedPromptId}
                        promptData={selectedPromptData}
                        isLoadingPrompt={isLoadingPrompt}
                        onUpdateField={handleUpdateField}
                        variables={variables}
                        isLoadingVariables={isLoadingVariables}
                        onAddVariable={addVariable}
                        onUpdateVariable={updateVariable}
                        onDeleteVariable={deleteVariable}
                        selectedPromptHasChildren={selectedPromptHasChildren}
                        onExport={() => exportState.openExport(selectedPromptId ? [selectedPromptId] : [])}
                        activeNav={activeNav}
                        activeSubItem={activeSubItem}
                        selectedTemplate={selectedTemplate}
                        activeTemplateTab={activeTemplateTab}
                        onToggleConversation={() => setConversationPanelOpen(!conversationPanelOpen)}
                        conversationPanelOpen={conversationPanelOpen}
                        onToggleFolderPanel={() => setFolderPanelOpen(!folderPanelOpen)}
                        folderPanelOpen={folderPanelOpen}
                        onToggleReadingPane={() => setReadingPaneOpen(!readingPaneOpen)}
                        // Run prompt and cascade handlers
                        onRunPrompt={handleRunPrompt}
                        onRunCascade={handleRunCascade}
                        isRunningPrompt={isRunningPrompt}
                        isRunningCascade={isCascadeRunning}
                        onCancelRun={cancelRun}
                        runProgress={runProgress}
                        isCascadeRunning={isCascadeRunning}
                        singleRunPromptId={singleRunPromptId}
                        // Settings props for Phase 6
                        settings={settings}
                        isLoadingSettings={isLoadingSettings}
                        onUpdateSetting={updateSetting}
                        models={models}
                        isLoadingModels={isLoadingModels}
                        onToggleModel={(modelId) => {
                          const model = models.find(m => m.row_id === modelId || m.model_id === modelId);
                          if (model) toggleModelActive(model.model_id);
                        }}
                        onAddModel={addModel}
                        onUpdateModel={updateModel}
                        onDeleteModel={deleteModel}
                        onAddModels={addModels}
                        // Phase 4 - Cost analytics and conversation defaults
                        costTracking={costTracking}
                        conversationToolDefaults={conversationToolDefaults}
                        // Prompt library for templates
                        promptLibrary={promptLibrary}
                        // Templates props for Phase 8-9
                        templatesHook={templatesHook}
                        jsonSchemaTemplatesHook={jsonSchemaTemplatesHook}
                        onEditSchema={(schemaId) => {
                          // Navigate to templates and select the schema
                          setActiveNav('templates');
                          setActiveTemplateTab('schemas');
                          // Find and select the schema template
                          const schema = jsonSchemaTemplatesHook?.templates?.find(t => t.row_id === schemaId);
                          if (schema) {
                            setSelectedTemplate(schema);
                          }
                        }}
                      />
                    </div>
                  </ResizablePanel>
                )}

                {showConversationPanel && (
                  <>
                    <ResizableHandle withHandle className="bg-outline-variant hover:bg-primary/50 transition-colors" />
                    {/* Conversation Panel - only shown for prompts */}
                    <ResizablePanel defaultSize={30} minSize={10} maxSize={70}>
                      <div className="h-full">
                        <ConversationPanel 
                          onClose={() => setConversationPanelOpen(false)}
                          promptName={selectedPromptData?.prompt_name}
                          promptFamilyChat={promptFamilyChat}
                          onCancel={cancelRun}
                          progress={runProgress}
                          onToggleReadingPane={() => setReadingPaneOpen(!readingPaneOpen)}
                          readingPaneOpen={readingPaneOpen}
                        />
                      </div>
                    </ResizablePanel>
                  </>
                )}

                {/* Export Panel - toggleable, now connected to useExport */}
                {exportState.isOpen && (
                  <>
                    <ResizableHandle withHandle className="bg-outline-variant hover:bg-primary/50 transition-colors" />
                    <ResizablePanel defaultSize={25} minSize={20} maxSize={35}>
                      <div className="h-full">
                        <ExportPanel 
                          isOpen={true} 
                          onClose={() => {
                            exportState.closeExport();
                          }}
                          exportState={exportState}
                          treeData={hierarchicalTreeData}
                          selectedPromptId={selectedPromptId}
                        />
                      </div>
                    </ResizablePanel>
                  </>
                )}
              </ResizablePanelGroup>
            </motion.div>
          </div>
        </div>
      </div>
      {/* Template Dialog for creating prompt from template */}
      <NewPromptChoiceDialog
        isOpen={templateDialogOpen}
        onClose={() => setTemplateDialogOpen(false)}
        onCreatePlain={async () => {
          setTemplateDialogOpen(false);
          const result = await handleAddItem(null);
          if (result?.[0]?.row_id) {
            setSelectedPromptId(result[0].row_id);
          }
        }}
        onPromptCreated={(newPromptId) => {
          setTemplateDialogOpen(false);
          if (newPromptId) {
            setSelectedPromptId(newPromptId);
          }
          refreshTreeData();
        }}
      />
      {/* Action Preview Dialog - for single runs and cascade runs */}
      <ActionPreviewDialog
        open={!!actionPreview}
        onOpenChange={(open) => {
          if (!open) resolveActionPreview(false);
        }}
        jsonResponse={actionPreview?.jsonResponse}
        config={actionPreview?.config}
        promptName={actionPreview?.promptName}
        onConfirm={() => resolveActionPreview(true)}
        onCancel={() => resolveActionPreview(false)}
      />
      {/* Question Popup - for run-mode question prompts */}
      <QuestionPopup
        isOpen={!!pendingQuestion}
        onClose={() => resolveQuestion(null)}
        question={pendingQuestion?.question}
        variableName={pendingQuestion?.variableName}
        description={pendingQuestion?.description}
        progress={questionProgress}
        collectedVariables={collectedQuestionVars}
        onSubmit={(answer) => resolveQuestion(answer)}
      />
    </DndProvider>
  );
};

export default MainLayout;
