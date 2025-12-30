import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { motion, AnimatePresence } from "framer-motion";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import NavigationRail from "@/components/layout/NavigationRail";
import TopBar from "@/components/layout/TopBar";
import FolderPanel from "@/components/layout/FolderPanel";
import TemplatesFolderPanel from "@/components/layout/TemplatesFolderPanel";
import SubmenuPanel from "@/components/layout/SubmenuPanel";
import ReadingPane from "@/components/layout/ReadingPane";
import ConversationPanel from "@/components/layout/ConversationPanel";
import ExportPanel from "@/components/layout/ExportPanel";
import SearchModal from "@/components/layout/SearchModal";
import NewPromptChoiceDialog from "@/components/NewPromptChoiceDialog";
import { useSupabase } from "@/hooks/useSupabase";
import useTreeData from "@/hooks/useTreeData";
import { useTreeOperations } from "@/hooks/useTreeOperations";
import { usePromptData } from "@/hooks/usePromptData";
import { usePromptVariables } from "@/hooks/usePromptVariables";
import { useThreads } from "@/hooks/useThreads";
import { useExport } from "@/hooks/useExport";
import { useSettings } from "@/hooks/useSettings";
import { useModels } from "@/hooks/useModels";
import { useWorkbenchThreads } from "@/hooks/useWorkbenchThreads";
import { useWorkbenchMessages } from "@/hooks/useWorkbenchMessages";
import { useWorkbenchFiles } from "@/hooks/useWorkbenchFiles";
import { useWorkbenchConfluence } from "@/hooks/useWorkbenchConfluence";
import { usePromptLibrary } from "@/hooks/usePromptLibrary";
import { useTemplates } from "@/hooks/useTemplates";
import { useJsonSchemaTemplates } from "@/hooks/useJsonSchemaTemplates";
import { useConversationRun } from "@/hooks/useConversationRun";
import { useCascadeExecutor } from "@/hooks/useCascadeExecutor";
import { useCostTracking } from "@/hooks/useCostTracking";
import { useConversationToolDefaults } from "@/hooks/useConversationToolDefaults";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { toast } from "@/components/ui/sonner";
import { Loader2 } from "lucide-react";
import { executePostAction } from "@/services/actionExecutors";
import { useAuth } from "@/contexts/AuthContext";
import { useUndo } from "@/contexts/UndoContext";

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
      <span className="text-body-sm">Loading workspace...</span>
    </motion.div>
  </motion.div>
);

const MainLayout = () => {
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
    handleBatchToggleExcludeExport
  } = useTreeOperations(supabase, refreshTreeData);
  const { updateField, fetchItemData } = usePromptData(supabase);
  
  // treeData is already hierarchical from useTreeData (buildTree is called in fetchPrompts)
  const hierarchicalTreeData = treeData || [];
  
  // Selected prompt state and data
  const [selectedPromptId, setSelectedPromptId] = useState(null);
  const [selectedPromptData, setSelectedPromptData] = useState(null);
  const [isLoadingPrompt, setIsLoadingPrompt] = useState(false);
  
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
  const { models, isLoading: isLoadingModels, toggleModelActive, addModel, updateModel, deleteModel } = useModels();
  
  // Workbench hooks - Phase 3
  const workbenchThreads = useWorkbenchThreads();
  const workbenchMessages = useWorkbenchMessages();
  const workbenchFiles = useWorkbenchFiles();
  const workbenchConfluence = useWorkbenchConfluence();
  const promptLibrary = usePromptLibrary();
  
  // Template hooks - Phase 8-9
  const templatesHook = useTemplates();
  const jsonSchemaTemplatesHook = useJsonSchemaTemplates();
  
  // Cost tracking hook - Phase 4
  const costTracking = useCostTracking();
  
  // Conversation tool defaults - Phase 4
  const conversationToolDefaults = useConversationToolDefaults();
  
  // Fetch messages when active thread changes
  useEffect(() => {
    if (activeThread?.row_id) {
      fetchMessages(activeThread.row_id);
    }
  }, [activeThread?.row_id, fetchMessages]);
  
  // Fetch prompt data when selection changes
  useEffect(() => {
    const loadPromptData = async () => {
      if (!selectedPromptId) {
        setSelectedPromptData(null);
        return;
      }
      setIsLoadingPrompt(true);
      const data = await fetchItemData(selectedPromptId);
      setSelectedPromptData(data);
      setIsLoadingPrompt(false);
    };
    loadPromptData();
  }, [selectedPromptId, fetchItemData]);
  
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
  const { runPrompt, runConversation, cancelRun, isRunning: isRunningPrompt, progress: runProgress } = useConversationRun();
  const { executeCascade, hasChildren: checkHasChildren } = useCascadeExecutor();
  const [isRunningCascade, setIsRunningCascade] = useState(false);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  
  // Helper to truncate long text for toast display
  const truncateForLog = (text, maxLen = 50) => {
    if (!text) return '[empty]';
    if (text.length <= maxLen) return text;
    return `${text.slice(0, maxLen)}...`;
  };

  // Handler for running a single prompt
  const handleRunPrompt = useCallback(async (promptId) => {
    if (!promptId) return;
    
    // Fetch prompt data to check if it's an action node
    const promptData = await fetchItemData(promptId);
    const startTime = Date.now();

    // Show API request details toast
    const requestDetails = {
      prompt: promptData?.prompt_name || promptId.slice(0, 8),
      model: promptData?.model || 'default',
      system_prompt: truncateForLog(promptData?.input_admin_prompt),
      user_prompt: truncateForLog(promptData?.input_user_prompt),
      reasoning_effort: promptData?.reasoning_effort_on ? promptData?.reasoning_effort : 'off',
      response_format: promptData?.response_format_on ? 'JSON Schema' : 'text',
      node_type: promptData?.node_type || 'standard',
    };
    
    toast.info('API Request', {
      description: `Model: ${requestDetails.model} | Reasoning: ${requestDetails.reasoning_effort} | Format: ${requestDetails.response_format}`,
      duration: 3000,
    });
    
    const result = await runPrompt(promptId);
    if (result) {
      const latencyMs = Date.now() - startTime;
      
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
      if (promptData?.node_type === 'action' && result.response && promptData.post_action) {
        try {
          // Extract JSON from markdown code blocks if present
          let jsonString = result.response.trim();
          const codeBlockMatch = jsonString.match(/```(?:json)?\s*([\s\S]*?)```/);
          if (codeBlockMatch) {
            jsonString = codeBlockMatch[1].trim();
          }
          const jsonResponse = JSON.parse(jsonString);
          
          // Update extracted_variables in DB
          await supabase
            .from(import.meta.env.VITE_PROMPTS_TBL)
            .update({ extracted_variables: jsonResponse })
            .eq('row_id', promptId);
          
          // Execute post-action
          const actionResult = await executePostAction({
            supabase,
            prompt: promptData,
            jsonResponse,
            actionId: promptData.post_action,
            config: promptData.post_action_config,
            context: { userId: currentUser?.id },
          });
          
          if (actionResult.success) {
            toast.success(`Action completed: ${actionResult.message || 'Success'}`);
            // Immediately refresh tree to show newly created children
            await refreshTreeData();
          } else {
            toast.warning(`Action failed: ${actionResult.error}`);
          }
        } catch (jsonError) {
          console.warn('Action node response not valid JSON:', jsonError);
          toast.warning('Action node response not valid JSON');
        }
      }
      
      // Refresh the prompt data if this is the selected prompt
      if (promptId === selectedPromptId) {
        const data = await fetchItemData(promptId);
        setSelectedPromptData(data);
      }
      refreshTreeData();
    }
  }, [runPrompt, selectedPromptId, fetchItemData, refreshTreeData, supabase, currentUser?.id, costTracking]);
  
  // Handler for running a cascade
  const handleRunCascade = useCallback(async (topLevelPromptId) => {
    if (!topLevelPromptId) return;
    
    // Check if prompt has children
    const hasKids = await checkHasChildren(topLevelPromptId);
    if (!hasKids) {
      toast.info("No children to cascade");
      return;
    }
    
    setIsRunningCascade(true);
    try {
      await executeCascade(topLevelPromptId, null);
      toast.success("Cascade completed");
      refreshTreeData();
    } catch (error) {
      console.error("Cascade error:", error);
      toast.error("Cascade failed", { description: error.message });
    } finally {
      setIsRunningCascade(false);
    }
  }, [executeCascade, checkHasChildren, refreshTreeData]);
  
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


  const [isDark, setIsDark] = useState(false);
  const [tooltipsEnabled, setTooltipsEnabled] = useState(true);
  const [folderPanelOpen, setFolderPanelOpen] = useState(true);
  const [conversationPanelOpen, setConversationPanelOpen] = useState(true);
  const [activeNav, setActiveNav] = useState("prompts");
  const [activeSubItem, setActiveSubItem] = useState(null);
  const [hoveredNav, setHoveredNav] = useState(null);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [activeTemplateTab, setActiveTemplateTab] = useState("prompts");
  // exportPanelOpen is now driven by exportState.isOpen from useExport hook
  const [searchOpen, setSearchOpen] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  
  // Initial load state
  useEffect(() => {
    if (!isLoadingTree && !isLoadingSettings) {
      // Small delay for smooth transition
      const timer = setTimeout(() => setIsInitialLoad(false), 500);
      return () => clearTimeout(timer);
    }
  }, [isLoadingTree, isLoadingSettings]);
  
  // Get undo context for keyboard shortcut
  const { undoStack, clearUndo } = useUndo();

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

  // Keyboard shortcuts
  useKeyboardShortcuts({
    onSearch: () => setSearchOpen(true),
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
      }
    },
    onUndo: handleUndo,
    enabled: true,
  });
  
  // Determine if conversation panel should be shown based on active nav
  const showConversationPanel = activeNav === "prompts" && conversationPanelOpen;
  const submenuRef = useRef(null);
  const hoverTimeoutRef = useRef(null);

  // Toggle dark mode on the document
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

  // Cleanup timeout on unmount
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
      setActiveSubItem("general");
    } else if (activeNav === "health" && !activeSubItem) {
      setActiveSubItem("overview");
    } else if (activeNav === "workbench" && !activeSubItem) {
      setActiveSubItem("new-conversation");
    }
  }, [activeNav]);

  // Render the appropriate panel content
  const renderFolderPanelContent = () => {
    // If hovering a nav item different from active, show preview of that nav's content
    if (hoveredNav && hoveredNav !== activeNav) {
      // Show templates folder panel preview when hovering templates
      if (hoveredNav === "templates") {
        return (
          <motion.div
            ref={submenuRef}
            onMouseEnter={handleSubmenuMouseEnter}
            onMouseLeave={handleSubmenuMouseLeave}
            className="h-full"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.15 }}
          >
            <TemplatesFolderPanel 
              onSelectTemplate={handleSelectTemplate}
              selectedTemplateId={selectedTemplate?.row_id || selectedTemplate?.id}
              activeTemplateTab={activeTemplateTab}
              onTemplateTabChange={setActiveTemplateTab}
              templates={templatesHook.templates}
              schemaTemplates={jsonSchemaTemplatesHook.templates}
              isLoadingTemplates={templatesHook.isLoading}
              isLoadingSchemas={jsonSchemaTemplatesHook.isLoading}
              onCreateTemplate={templatesHook.createTemplate}
              onDeleteTemplate={templatesHook.deleteTemplate}
              onCreateSchema={jsonSchemaTemplatesHook.createTemplate}
              onDeleteSchema={jsonSchemaTemplatesHook.deleteTemplate}
            />
          </motion.div>
        );
      }
      
      // Show prompts folder panel preview when hovering prompts
      if (hoveredNav === "prompts") {
        return (
          <motion.div
            ref={submenuRef}
            onMouseEnter={handleSubmenuMouseEnter}
            onMouseLeave={handleSubmenuMouseLeave}
            className="h-full"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.15 }}
          >
            <FolderPanel 
              treeData={hierarchicalTreeData}
              isLoading={isLoadingTree}
              selectedPromptId={selectedPromptId}
              onSelectPrompt={setSelectedPromptId}
              onAddPrompt={handleAddItem}
              onAddFromTemplate={() => setTemplateDialogOpen(true)}
              onDeletePrompt={handleDeleteItem}
              onDuplicatePrompt={handleDuplicateItem}
              onExportPrompt={(id) => { setSelectedPromptId(id); exportState.openExport([id]); }}
              onMovePrompt={handleMoveItem}
              onRefresh={refreshTreeData}
              onRunPrompt={handleRunPrompt}
              onRunCascade={handleRunCascade}
              onToggleStar={handleToggleStar}
              onToggleExcludeCascade={handleToggleExcludeCascade}
              onToggleExcludeExport={handleToggleExcludeExport}
              isRunningPrompt={isRunningPrompt}
              isRunningCascade={isRunningCascade}
            />
          </motion.div>
        );
      }
      
      // Show submenu for other nav items
      if (hasSubmenu(hoveredNav)) {
        return (
          <motion.div
            ref={submenuRef}
            onMouseEnter={handleSubmenuMouseEnter}
            onMouseLeave={handleSubmenuMouseLeave}
            className="h-full"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.15 }}
          >
            <SubmenuPanel 
              hoveredNav={hoveredNav}
              activeSubItem={hoveredNav === activeNav ? activeSubItem : null}
              onItemClick={(itemId) => handleSubmenuClick(hoveredNav, itemId)}
            />
          </motion.div>
        );
      }
    }

    // Otherwise show the active nav's content
    if (activeNav === "prompts") {
      return (
        <FolderPanel 
          treeData={hierarchicalTreeData}
          isLoading={isLoadingTree}
          selectedPromptId={selectedPromptId}
          onSelectPrompt={setSelectedPromptId}
          onAddPrompt={handleAddItem}
          onAddFromTemplate={() => setTemplateDialogOpen(true)}
          onDeletePrompt={handleDeleteItem}
          onDuplicatePrompt={handleDuplicateItem}
          onExportPrompt={(id) => { setSelectedPromptId(id); setExportPanelOpen(true); }}
          onMovePrompt={handleMoveItem}
          onRefresh={refreshTreeData}
          onRunPrompt={handleRunPrompt}
          onRunCascade={handleRunCascade}
          onToggleStar={handleToggleStar}
          onToggleExcludeCascade={handleToggleExcludeCascade}
          onToggleExcludeExport={handleToggleExcludeExport}
          isRunningPrompt={isRunningPrompt}
          isRunningCascade={isRunningCascade}
          onBatchDelete={handleBatchDelete}
          onBatchDuplicate={handleBatchDuplicate}
          onBatchStar={handleBatchStar}
          onBatchToggleExcludeCascade={handleBatchToggleExcludeCascade}
          onBatchToggleExcludeExport={handleBatchToggleExcludeExport}
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
        {/* Search Modal */}
        <SearchModal
          isOpen={searchOpen}
          onClose={() => setSearchOpen(false)}
          treeData={hierarchicalTreeData}
          templates={[...templatesHook.templates, ...jsonSchemaTemplatesHook.templates]}
          onSelectPrompt={(id) => {
            setActiveNav("prompts");
            setSelectedPromptId(id);
          }}
          onSelectTemplate={(template) => {
            setActiveNav("templates");
            setSelectedTemplate(template);
          }}
          onNavigate={(navId) => {
            setActiveNav(navId);
          }}
        />

        {/* Main Layout */}
        <div className="flex-1 flex overflow-hidden min-h-0">
          {/* Navigation Rail - 80px */}
          <NavigationRail 
            activeNav={activeNav}
            onNavChange={setActiveNav}
            onNavHover={handleNavHover}
            onNavLeave={handleNavLeave}
            folderPanelOpen={folderPanelOpen}
            onToggleFolderPanel={() => setFolderPanelOpen(!folderPanelOpen)}
            onShowShortcuts={() => toast.info("Keyboard shortcuts: ⌘K search, ⌘B folders, ⌘J chat")}
          />

          {/* Content Area */}
          <div className="flex-1 flex flex-col overflow-hidden min-h-0">
            {/* Top Bar - 64dp */}
            <TopBar 
              tooltipsEnabled={tooltipsEnabled} 
              onToggleTooltips={() => setTooltipsEnabled(!tooltipsEnabled)}
              isDark={isDark}
              onToggleDark={() => setIsDark(!isDark)}
              onOpenSearch={() => setSearchOpen(true)}
              onUndoAction={handleUndoAction}
            />

            {/* Main Content with Resizable Panels */}
            <motion.div 
              className="flex-1 flex overflow-hidden min-h-0"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.1 }}
            >
              <ResizablePanelGroup direction="horizontal" className="flex-1 min-h-0">
                {/* Folder/Submenu Panel - collapsible */}
                <AnimatePresence mode="wait">
                  {folderPanelOpen && (
                    <>
                      <ResizablePanel defaultSize={20} minSize={15} maxSize={50}>
                        <motion.div 
                          className="h-full min-h-0 overflow-x-auto overflow-y-hidden"
                          initial={{ opacity: 0, width: 0 }}
                          animate={{ opacity: 1, width: "auto" }}
                          exit={{ opacity: 0, width: 0 }}
                          transition={{ duration: 0.2 }}
                        >
                          {renderFolderPanelContent()}
                        </motion.div>
                      </ResizablePanel>
                      <ResizableHandle withHandle className="bg-outline-variant hover:bg-primary/50 transition-colors" />
                    </>
                  )}
                </AnimatePresence>

                {/* Reading Pane - flexible */}
                <ResizablePanel defaultSize={showConversationPanel ? 50 : 80} minSize={30}>
                  <motion.div 
                    className="h-full min-h-0 flex flex-col overflow-hidden"
                    layout
                    transition={{ duration: 0.2 }}
                  >
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
                      // Run prompt and cascade handlers
                      onRunPrompt={handleRunPrompt}
                      onRunCascade={handleRunCascade}
                      isRunningPrompt={isRunningPrompt}
                      isRunningCascade={isRunningCascade}
                      onCancelRun={cancelRun}
                      runProgress={runProgress}
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
                      // Phase 4 - Cost analytics and conversation defaults
                      costTracking={costTracking}
                      conversationToolDefaults={conversationToolDefaults}
                      // Workbench props for Phase 3
                      workbenchThreads={workbenchThreads}
                      workbenchMessages={workbenchMessages}
                      workbenchFiles={workbenchFiles}
                      workbenchConfluence={workbenchConfluence}
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
                  </motion.div>
                </ResizablePanel>

                <AnimatePresence mode="wait">
                  {showConversationPanel && (
                    <>
                      <ResizableHandle withHandle className="bg-outline-variant hover:bg-primary/50 transition-colors" />

                      {/* Conversation Panel - only shown for prompts */}
                      <ResizablePanel defaultSize={30} minSize={20} maxSize={40}>
                        <motion.div
                          className="h-full"
                          initial={{ opacity: 0, x: 20 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: 20 }}
                          transition={{ duration: 0.2 }}
                        >
                          <ConversationPanel 
                            onClose={() => setConversationPanelOpen(false)}
                            threads={threads}
                            activeThread={activeThread}
                            onSelectThread={setActiveThread}
                            messages={messages}
                            isLoadingThreads={isLoadingThreads}
                            isLoadingMessages={isLoadingMessages}
                            isSending={isSendingMessage}
                            onCreateThread={createThread}
                            onDeleteThread={deleteThread}
                            onRenameThread={renameThread}
                            onSendMessage={handleSendConversationMessage}
                            promptName={selectedPromptData?.prompt_name}
                            onCancel={cancelRun}
                            progress={runProgress}
                          />
                        </motion.div>
                      </ResizablePanel>
                    </>
                  )}
                </AnimatePresence>

                {/* Export Panel - toggleable, now connected to useExport */}
                <AnimatePresence mode="wait">
                {exportState.isOpen && (
                    <>
                      <ResizableHandle withHandle className="bg-outline-variant hover:bg-primary/50 transition-colors" />
                      <ResizablePanel defaultSize={25} minSize={20} maxSize={35}>
                        <motion.div
                          className="h-full"
                          initial={{ opacity: 0, x: 20 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: 20 }}
                          transition={{ duration: 0.2 }}
                        >
                          <ExportPanel 
                            isOpen={true} 
                            onClose={() => {
                              exportState.closeExport();
                            }}
                            exportState={exportState}
                            treeData={hierarchicalTreeData}
                            selectedPromptId={selectedPromptId}
                          />
                        </motion.div>
                      </ResizablePanel>
                    </>
                  )}
                </AnimatePresence>
              </ResizablePanelGroup>
            </motion.div>
          </div>
        </div>
      </div>
      {/* Template Dialog for creating prompt from template */}
      <NewPromptChoiceDialog
        isOpen={templateDialogOpen}
        onClose={() => setTemplateDialogOpen(false)}
        onCreatePlain={() => {
          setTemplateDialogOpen(false);
          handleAddItem(null);
        }}
        onPromptCreated={(newPromptId) => {
          setTemplateDialogOpen(false);
          if (newPromptId) {
            setSelectedPromptId(newPromptId);
          }
          refreshTreeData();
        }}
      />
    </DndProvider>
  );
};

export default MainLayout;
