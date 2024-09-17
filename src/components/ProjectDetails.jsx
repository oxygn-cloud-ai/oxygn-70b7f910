import React from 'react';
import ProjectPanels from './ProjectPanels';

const ProjectDetails = ({ activeItem, selectedItemData, handleUpdateField }) => {
  if (activeItem) {
    return selectedItemData ? (
      <ProjectPanels 
        selectedItemData={selectedItemData} 
        projectRowId={activeItem} 
        onUpdateField={handleUpdateField}
      />
    ) : (
      <div className="flex items-center justify-center h-full">
        <p className="text-gray-500">Loading prompt details...</p>
      </div>
    );
  } else {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-gray-500">Select a prompt to view details</p>
      </div>
    );
  }
};

export default ProjectDetails;