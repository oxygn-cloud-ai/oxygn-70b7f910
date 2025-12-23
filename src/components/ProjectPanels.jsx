import React from 'react';
import ChildPromptPanel from './ChildPromptPanel';
import PromptEditorTabs from './PromptEditorTabs';

const ProjectPanels = ({ 
  selectedItemData, 
  projectRowId, 
  onUpdateField, 
  isLinksPage = false, 
  isReadOnly = false, 
  onCascade, 
  parentData, 
  cascadeField,
  isTopLevel = false,
  parentAssistantRowId = null,
  onExportPrompt,
}) => {
  if (!selectedItemData) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">Loading prompt data...</p>
      </div>
    );
  }

  // If this is a child of an assistant, show ChildPromptPanel
  if (parentAssistantRowId) {
    return (
      <ChildPromptPanel
        selectedItemData={selectedItemData}
        projectRowId={projectRowId}
        parentAssistantRowId={parentAssistantRowId}
        onUpdateField={onUpdateField}
        onExportPrompt={onExportPrompt}
      />
    );
  }

  // Standard prompt view with tabs (including top-level prompts with assistant config)
  return (
    <PromptEditorTabs
      selectedItemData={selectedItemData}
      projectRowId={projectRowId}
      onUpdateField={onUpdateField}
      isLinksPage={isLinksPage}
      isReadOnly={isReadOnly}
      onCascade={onCascade}
      parentData={parentData}
      cascadeField={cascadeField}
      isTopLevel={isTopLevel}
      parentAssistantRowId={parentAssistantRowId}
      onExportPrompt={onExportPrompt}
    />
  );
};

export default ProjectPanels;
