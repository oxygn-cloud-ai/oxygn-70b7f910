import React from 'react';
import ProjectPanels from '../components/ProjectPanels';

const ProjectDetails = ({
  activeItem,
  selectedItemData,
  handleUpdateField,
  treeData,
  expandedItems,
  toggleItem,
  handleAddItem,
  editingItem,
  setEditingItem,
  updateItemName,
  refreshTreeData,
  setActiveItem,
  handleDeleteItem
}) => {
  if (activeItem) {
    return selectedItemData ? (
      <ProjectPanels 
        selectedItemData={selectedItemData} 
        projectRowId={activeItem} 
        onUpdateField={handleUpdateField}
        treeData={treeData}
        expandedItems={expandedItems}
        toggleItem={toggleItem}
        addItem={handleAddItem}
        startRenaming={(id, name) => setEditingItem({ id, name })}
        editingItem={editingItem}
        setEditingItem={setEditingItem}
        finishRenaming={async () => {
          if (editingItem) {
            await updateItemName(editingItem.id, editingItem.name);
            setEditingItem(null);
            await refreshTreeData();
          }
        }}
        cancelRenaming={() => setEditingItem(null)}
        activeItem={activeItem}
        setActiveItem={setActiveItem}
        deleteItem={handleDeleteItem}
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