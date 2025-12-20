import React from 'react';
import AssistantPanel from './AssistantPanel';
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
}) => {
  if (!selectedItemData) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">Loading prompt data...</p>
      </div>
    );
  }

  // If this is a top-level prompt AND marked as an assistant, show AssistantPanel
  if (isTopLevel && selectedItemData.is_assistant) {
    return (
      <AssistantPanel
        promptRowId={projectRowId}
        selectedItemData={selectedItemData}
      />
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
      />
    );
  }

  // Standard prompt view with tabs
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
    />
  );
};

export default ProjectPanels;
