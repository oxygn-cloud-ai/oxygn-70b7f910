import React from "react";
import { FileText, LayoutTemplate } from "lucide-react";
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
  conversationPanelOpen = true
}) => {
  // Workbench mode - full workbench with threads and chat
  if (activeNav === "workbench") {
    return <MockupWorkbenchContent activeSubItem={activeSubItem} />;
  }

  // Settings mode - all settings sections
  if (activeNav === "settings") {
    return <MockupSettingsContent activeSubItem={activeSubItem} />;
  }

  // Health mode - health check sections
  if (activeNav === "health") {
    return <MockupHealthContent activeSubItem={activeSubItem} />;
  }

  // Templates mode - template editor
  if (activeNav === "templates") {
    return (
      <MockupTemplatesContent 
        selectedTemplate={selectedTemplate}
        activeTemplateTab={activeTemplateTab}
      />
    );
  }

  // Prompts mode (default) - prompt editor
  if (!hasSelection) {
    return (
      <div className="flex-1 flex items-center justify-center bg-surface">
        <div className="text-center text-on-surface-variant">
          <FileText className="h-16 w-16 mx-auto mb-4 opacity-30" />
          <p className="text-body-md">Select a prompt to view</p>
          <p className="text-label-md mt-1">or create a new one</p>
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
