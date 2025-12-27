import React from "react";
import { FileText, LayoutTemplate, PanelRightOpen } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  MockupPromptsContent,
  MockupWorkbenchContent,
  MockupTemplatesContent,
  MockupSettingsContent,
  MockupHealthContent,
} from "./content";

const MockupReadingPane = ({ 
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
  // Settings props - Phase 6
  settings = {},
  isLoadingSettings = false,
  onUpdateSetting,
  models = [],
  isLoadingModels = false,
  onToggleModel,
  // Phase 4 - Cost analytics and conversation defaults
  costTracking,
  conversationToolDefaults,
  // Workbench props - Phase 3
  workbenchThreads,
  workbenchMessages,
  workbenchFiles,
  workbenchConfluence,
  promptLibrary,
  // Templates props - Phase 8-9
  templatesHook,
  jsonSchemaTemplatesHook,
}) => {
  // Workbench mode - full workbench with threads and chat (now with real data)
  if (activeNav === "workbench") {
    return (
      <MockupWorkbenchContent 
        activeSubItem={activeSubItem}
        workbenchThreads={workbenchThreads}
        workbenchMessages={workbenchMessages}
        workbenchFiles={workbenchFiles}
        workbenchConfluence={workbenchConfluence}
        promptLibrary={promptLibrary}
      />
    );
  }

  // Settings mode - all settings sections (now with real data)
  if (activeNav === "settings") {
    return (
      <MockupSettingsContent 
        activeSubItem={activeSubItem}
        settings={settings}
        isLoadingSettings={isLoadingSettings}
        onUpdateSetting={onUpdateSetting}
        models={models}
        isLoadingModels={isLoadingModels}
        onToggleModel={onToggleModel}
        costTracking={costTracking}
        conversationToolDefaults={conversationToolDefaults}
      />
    );
  }

  // Health mode - health check sections
  if (activeNav === "health") {
    return <MockupHealthContent activeSubItem={activeSubItem} />;
  }

  // Templates mode - template editor (now with real data)
  if (activeNav === "templates") {
    return (
      <MockupTemplatesContent 
        selectedTemplate={selectedTemplate}
        activeTemplateTab={activeTemplateTab}
        templatesHook={templatesHook}
        jsonSchemaTemplatesHook={jsonSchemaTemplatesHook}
      />
    );
  }

  // Prompts mode (default) - prompt editor
  if (!hasSelection) {
    return (
      <div className="flex-1 flex flex-col bg-surface min-h-0 overflow-hidden">
        {/* Header with toggle button when conversation panel is closed */}
        {!conversationPanelOpen && onToggleConversation && (
          <div className="h-14 flex items-center justify-end px-3 border-b border-outline-variant shrink-0">
            <Tooltip>
              <TooltipTrigger asChild>
                <button onClick={onToggleConversation} className="w-8 h-8 flex items-center justify-center rounded-m3-full text-on-surface-variant hover:bg-on-surface/[0.08]">
                  <PanelRightOpen className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent className="text-[10px]">Show Conversation</TooltipContent>
            </Tooltip>
          </div>
        )}
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
    <MockupPromptsContent
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
    />
  );
};

export default MockupReadingPane;
