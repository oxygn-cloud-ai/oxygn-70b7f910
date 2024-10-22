import React from 'react';
import ProjectPanels from './ProjectPanels';

const ProjectDetails = ({ activeItem, selectedItemData, models, handleCascade, onUnsavedChanges }) => {
  if (!activeItem) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-gray-500">Select a prompt to view details</p>
      </div>
    );
  }

  if (!selectedItemData) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-gray-500">Loading prompt details...</p>
      </div>
    );
  }

  return (
    <ProjectPanels 
      selectedItemData={selectedItemData} 
      projectRowId={activeItem} 
      onUpdateField={() => {}} // This should be implemented if needed
      onCascade={handleCascade}
      onUnsavedChanges={onUnsavedChanges}
    />
  );
};

export default ProjectDetails;