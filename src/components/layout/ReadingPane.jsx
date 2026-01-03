import React from "react";
import { FileText, LayoutTemplate, PanelRightOpen, PanelLeftOpen } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import ErrorBoundary from "@/components/ErrorBoundary";
import {
  PromptsContent,
  TemplatesContent,
  SettingsContent,
  HealthContent,
} from "@/components/content";

const ReadingPane = ({ 
  hasSelection = true, 
  selectedPromptId,
  promptData,
  isLoadingPrompt,
  onUpdateField,
  variables,
  isLoadingVariables,
  onAddVariable,
  onUpdateVariable,
  onDeleteVariable,
  selectedPromptHasChildren = false,
  onExport, 
  activeNav = "prompts", 
  activeSubItem = null, 
  selectedTemplate = null,
  activeTemplateTab = "prompts",
  onToggleConversation, 
  conversationPanelOpen = true,
  onToggleFolderPanel,
  folderPanelOpen = true,
  onToggleReadingPane,
  // Run prompt handlers
  onRunPrompt,
  onRunCascade,
  isRunningPrompt = false,
  isRunningCascade = false,
  onCancelRun,
  runProgress,
  // Cascade lock
  isCascadeRunning = false,
  singleRunPromptId = null,
  // Settings props - Phase 6
  settings = {},
  isLoadingSettings = false,
  onUpdateSetting,
  models = [],
  isLoadingModels = false,
  onToggleModel,
  onAddModel,
  onUpdateModel,
  onDeleteModel,
  // Phase 4 - Cost analytics and conversation defaults
  costTracking,
  conversationToolDefaults,
  // Prompt library for templates
  promptLibrary,
  // Templates props - Phase 8-9
  templatesHook,
  jsonSchemaTemplatesHook,
  onEditSchema,
}) => {

  // Settings mode - all settings sections (now with real data)
  if (activeNav === "settings") {
    return (
      <div className="flex-1 flex flex-col bg-surface min-h-0 overflow-hidden">
        <ErrorBoundary message="Settings encountered an error.">
          <SettingsContent 
            activeSubItem={activeSubItem}
            settings={settings}
            isLoadingSettings={isLoadingSettings}
            onUpdateSetting={onUpdateSetting}
            models={models}
            isLoadingModels={isLoadingModels}
            onToggleModel={onToggleModel}
            onAddModel={onAddModel}
            onUpdateModel={onUpdateModel}
            onDeleteModel={onDeleteModel}
            costTracking={costTracking}
            conversationToolDefaults={conversationToolDefaults}
          />
        </ErrorBoundary>
      </div>
    );
  }

  // Health mode - health check sections
  if (activeNav === "health") {
    return (
      <div className="flex-1 flex flex-col bg-surface min-h-0 overflow-hidden">
        <ErrorBoundary message="Health check encountered an error.">
          <HealthContent activeSubItem={activeSubItem} />
        </ErrorBoundary>
      </div>
    );
  }

  // Templates mode - template editor (now with real data)
  if (activeNav === "templates") {
    return (
      <div className="flex-1 flex flex-col bg-surface min-h-0 overflow-hidden">
        <ErrorBoundary message="Templates encountered an error.">
          <TemplatesContent 
            selectedTemplate={selectedTemplate}
            activeTemplateTab={activeTemplateTab}
            templatesHook={templatesHook}
            jsonSchemaTemplatesHook={jsonSchemaTemplatesHook}
            models={models}
            onTemplateChange={(template) => {
              // Refresh templates list when template changes
              if (templatesHook?.fetchTemplates) templatesHook.fetchTemplates();
              if (jsonSchemaTemplatesHook?.fetchTemplates) jsonSchemaTemplatesHook.fetchTemplates();
            }}
            folderPanelOpen={folderPanelOpen}
            onToggleFolderPanel={onToggleFolderPanel}
          />
        </ErrorBoundary>
      </div>
    );
  }

  // Prompts mode (default) - prompt editor
  if (!hasSelection) {
    return (
      <div className="flex-1 flex flex-col bg-surface min-h-0 overflow-hidden">
        {/* Header with toggle buttons */}
        <div className="h-14 flex items-center justify-between px-3 border-b border-outline-variant shrink-0">
          {/* Left - Show folder panel when hidden */}
          <div>
            {!folderPanelOpen && onToggleFolderPanel && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button onClick={onToggleFolderPanel} className="w-8 h-8 flex items-center justify-center rounded-m3-full text-on-surface-variant hover:bg-surface-container">
                    <PanelLeftOpen className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent className="text-[10px]">Show folders</TooltipContent>
              </Tooltip>
            )}
          </div>
          {/* Right - Show conversation panel when hidden */}
          <div>
            {!conversationPanelOpen && onToggleConversation && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button onClick={onToggleConversation} className="w-8 h-8 flex items-center justify-center rounded-m3-full text-on-surface-variant hover:bg-surface-container">
                    <PanelRightOpen className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent className="text-[10px]">Show chat</TooltipContent>
              </Tooltip>
            )}
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center text-on-surface-variant">
            <FileText className="h-16 w-16 mx-auto mb-4 opacity-30" />
            <p className="text-body-md">Select a prompt to view</p>
            <p className="text-label-md mt-1">or create a new one</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <PromptsContent
      hasSelection={hasSelection}
      selectedPromptId={selectedPromptId}
      promptData={promptData}
      isLoadingPrompt={isLoadingPrompt}
      onUpdateField={onUpdateField}
      variables={variables}
      isLoadingVariables={isLoadingVariables}
      onAddVariable={onAddVariable}
      onUpdateVariable={onUpdateVariable}
      onDeleteVariable={onDeleteVariable}
      selectedPromptHasChildren={selectedPromptHasChildren}
      onExport={onExport}
      onToggleConversation={onToggleConversation}
      conversationPanelOpen={conversationPanelOpen}
      onToggleFolderPanel={onToggleFolderPanel}
      folderPanelOpen={folderPanelOpen}
      onToggleReadingPane={onToggleReadingPane}
      readingPaneOpen={true}
      models={models}
      schemas={jsonSchemaTemplatesHook?.templates || []}
      onRunPrompt={onRunPrompt}
      onRunCascade={onRunCascade}
      isRunningPrompt={isRunningPrompt}
      isRunningCascade={isRunningCascade}
      onCancelRun={onCancelRun}
      runProgress={runProgress}
      onEditSchema={onEditSchema}
      isCascadeRunning={isCascadeRunning}
      singleRunPromptId={singleRunPromptId}
    />
  );
};

export default ReadingPane;
