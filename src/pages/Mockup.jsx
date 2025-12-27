import React, { useState, useEffect, useRef, useCallback } from "react";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import MockupNavigationRail from "@/components/mockup/MockupNavigationRail";
import MockupTopBar from "@/components/mockup/MockupTopBar";
import MockupFolderPanel from "@/components/mockup/MockupFolderPanel";
import MockupTemplatesFolderPanel from "@/components/mockup/MockupTemplatesFolderPanel";
import MockupSubmenuPanel from "@/components/mockup/MockupSubmenuPanel";
import MockupReadingPane from "@/components/mockup/MockupReadingPane";
import MockupConversationPanel from "@/components/mockup/MockupConversationPanel";
import MockupExportPanel from "@/components/mockup/MockupExportPanel";
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
import { toast } from "@/components/ui/sonner";

const Mockup = () => {
  // Real data hooks
  const supabase = useSupabase();
  const { treeData, isLoading: isLoadingTree, refreshTreeData } = useTreeData(supabase);
  const { handleAddItem, handleDeleteItem, handleDuplicateItem, handleMoveItem } = useTreeOperations(supabase, refreshTreeData);
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
  const { models, isLoading: isLoadingModels, toggleModelActive } = useModels();
  
  // Workbench hooks - Phase 3
  const workbenchThreads = useWorkbenchThreads();
  const workbenchMessages = useWorkbenchMessages();
  const workbenchFiles = useWorkbenchFiles();
  const workbenchConfluence = useWorkbenchConfluence();
  const promptLibrary = usePromptLibrary();
  
  // Template hooks - Phase 8-9
  const templatesHook = useTemplates();
  const jsonSchemaTemplatesHook = useJsonSchemaTemplates();
  
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
  const { runPrompt, runConversation, isRunning: isRunningPrompt } = useConversationRun();
  const { executeCascade, hasChildren: checkHasChildren } = useCascadeExecutor();
  const [isRunningCascade, setIsRunningCascade] = useState(false);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  
  // Handler for running a single prompt
  const handleRunPrompt = useCallback(async (promptId) => {
    if (!promptId) return;
    const result = await runPrompt(promptId);
    if (result) {
      // Refresh the prompt data if this is the selected prompt
      if (promptId === selectedPromptId) {
        const data = await fetchItemData(promptId);
        setSelectedPromptData(data);
      }
      refreshTreeData();
    }
  }, [runPrompt, selectedPromptId, fetchItemData, refreshTreeData]);
  
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
  
  // Check if selected prompt has children
  const selectedPromptHasChildren = React.useMemo(() => {
    if (!selectedPromptId || !treeData) return false;
    return treeData.some(p => p.parent_row_id === selectedPromptId);
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
  const [exportPanelOpen, setExportPanelOpen] = useState(false);
  
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
          <div
            ref={submenuRef}
            onMouseEnter={handleSubmenuMouseEnter}
            onMouseLeave={handleSubmenuMouseLeave}
            className="h-full"
          >
            <MockupTemplatesFolderPanel 
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
          </div>
        );
      }
      
      // Show prompts folder panel preview when hovering prompts
      if (hoveredNav === "prompts") {
        return (
          <div
            ref={submenuRef}
            onMouseEnter={handleSubmenuMouseEnter}
            onMouseLeave={handleSubmenuMouseLeave}
            className="h-full"
          >
            <MockupFolderPanel 
              treeData={hierarchicalTreeData}
              isLoading={isLoadingTree}
              selectedPromptId={selectedPromptId}
              onSelectPrompt={setSelectedPromptId}
              onAddPrompt={handleAddItem}
              onDeletePrompt={handleDeleteItem}
              onDuplicatePrompt={handleDuplicateItem}
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
          </div>
        );
      }
      
      // Show submenu for other nav items
      if (hasSubmenu(hoveredNav)) {
        return (
          <div
            ref={submenuRef}
            onMouseEnter={handleSubmenuMouseEnter}
            onMouseLeave={handleSubmenuMouseLeave}
            className="h-full"
          >
            <MockupSubmenuPanel 
              hoveredNav={hoveredNav}
              activeSubItem={hoveredNav === activeNav ? activeSubItem : null}
              onItemClick={(itemId) => handleSubmenuClick(hoveredNav, itemId)}
            />
          </div>
        );
      }
    }

    // Otherwise show the active nav's content
    if (activeNav === "prompts") {
      return (
        <MockupFolderPanel 
          treeData={hierarchicalTreeData}
          isLoading={isLoadingTree}
          selectedPromptId={selectedPromptId}
          onSelectPrompt={setSelectedPromptId}
          onAddPrompt={handleAddItem}
          onDeletePrompt={handleDeleteItem}
          onDuplicatePrompt={handleDuplicateItem}
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
      );
    }
    
    if (activeNav === "templates") {
      return (
        <MockupTemplatesFolderPanel 
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
      <MockupSubmenuPanel 
        hoveredNav={activeNav}
        activeSubItem={activeSubItem}
        onItemClick={(itemId) => handleSubmenuClick(activeNav, itemId)}
      />
    );
  };

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="h-screen w-full flex flex-col bg-surface overflow-hidden min-h-0">
        {/* Main Layout */}
        <div className="flex-1 flex overflow-hidden min-h-0">
          {/* Navigation Rail - 80px */}
          <MockupNavigationRail 
            activeNav={activeNav}
            onNavChange={setActiveNav}
            onNavHover={handleNavHover}
            onNavLeave={handleNavLeave}
            folderPanelOpen={folderPanelOpen}
            onToggleFolderPanel={() => setFolderPanelOpen(!folderPanelOpen)}
          />

          {/* Content Area */}
          <div className="flex-1 flex flex-col overflow-hidden min-h-0">
            {/* Top Bar - 64dp */}
            <MockupTopBar 
              tooltipsEnabled={tooltipsEnabled} 
              onToggleTooltips={() => setTooltipsEnabled(!tooltipsEnabled)}
              isDark={isDark}
              onToggleDark={() => setIsDark(!isDark)}
            />

            {/* Main Content with Resizable Panels */}
            <div className="flex-1 flex overflow-hidden min-h-0">
              <ResizablePanelGroup direction="horizontal" className="flex-1 min-h-0">
                {/* Folder/Submenu Panel - collapsible */}
                {folderPanelOpen && (
                  <>
                    <ResizablePanel defaultSize={20} minSize={15} maxSize={30}>
                      <div className="h-full min-h-0 overflow-hidden">
                        {renderFolderPanelContent()}
                      </div>
                    </ResizablePanel>
                    <ResizableHandle withHandle className="bg-outline-variant hover:bg-primary/50 transition-colors" />
                  </>
                )}

                {/* Reading Pane - flexible */}
                <ResizablePanel defaultSize={showConversationPanel ? 50 : 80} minSize={30}>
                  <div className="h-full min-h-0 flex flex-col overflow-hidden">
                    <MockupReadingPane 
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
                      onExport={() => setExportPanelOpen(true)}
                      activeNav={activeNav}
                      activeSubItem={activeSubItem}
                      selectedTemplate={selectedTemplate}
                      activeTemplateTab={activeTemplateTab}
                      onToggleConversation={() => setConversationPanelOpen(!conversationPanelOpen)}
                      conversationPanelOpen={conversationPanelOpen}
                      // Settings props for Phase 6
                      settings={settings}
                      isLoadingSettings={isLoadingSettings}
                      onUpdateSetting={updateSetting}
                      models={models}
                      isLoadingModels={isLoadingModels}
                      onToggleModel={(modelId) => {
                        const model = models.find(m => m.row_id === modelId || m.model_id === modelId);
                        if (model) toggleModelActive(model.row_id, !model.is_active);
                      }}
                      // Workbench props for Phase 3
                      workbenchThreads={workbenchThreads}
                      workbenchMessages={workbenchMessages}
                      workbenchFiles={workbenchFiles}
                      workbenchConfluence={workbenchConfluence}
                      promptLibrary={promptLibrary}
                      // Templates props for Phase 8-9
                      templatesHook={templatesHook}
                      jsonSchemaTemplatesHook={jsonSchemaTemplatesHook}
                    />
                  </div>
                </ResizablePanel>

                {showConversationPanel && (
                  <>
                    <ResizableHandle withHandle className="bg-outline-variant hover:bg-primary/50 transition-colors" />

                    {/* Conversation Panel - only shown for prompts */}
                    <ResizablePanel defaultSize={30} minSize={20} maxSize={40}>
                      <MockupConversationPanel 
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
                      />
                    </ResizablePanel>
                  </>
                )}

                {/* Export Panel - toggleable, now connected to useExport */}
                {exportPanelOpen && (
                  <>
                    <ResizableHandle withHandle className="bg-outline-variant hover:bg-primary/50 transition-colors" />
                    <ResizablePanel defaultSize={25} minSize={20} maxSize={35}>
                      <MockupExportPanel 
                        isOpen={true} 
                        onClose={() => {
                          setExportPanelOpen(false);
                          exportState.closeExport();
                        }}
                        exportState={exportState}
                        treeData={hierarchicalTreeData}
                        selectedPromptId={selectedPromptId}
                      />
                    </ResizablePanel>
                  </>
                )}
              </ResizablePanelGroup>
            </div>
          </div>
        </div>
      </div>
    </DndProvider>
  );
};

export default Mockup;
