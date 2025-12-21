import React, { useCallback, useMemo, useState } from 'react';
import { Accordion } from "@/components/ui/accordion";
import { Plus, X } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import TreeItem from './TreeItem';
import SearchFilter from './SearchFilter';
import EmptyState from './EmptyState';
import NewPromptChoiceDialog from './NewPromptChoiceDialog';

const TreeView = ({ 
  treeData, 
  expandedItems, 
  toggleItem, 
  editingItem, 
  setEditingItem, 
  handleUpdateField, 
  refreshTreeData, 
  activeItem, 
  setActiveItem, 
  handleAddItem, 
  handleDeleteItem, 
  handleDuplicateItem, 
  handleMoveItem 
}) => {
const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [showNewPromptChoice, setShowNewPromptChoice] = useState(false);

  // Filter tree data based on search and filter
  const filteredData = useMemo(() => {
    if (!searchQuery && filterType === 'all') return treeData;

    const filterItem = (item) => {
      // Check filter type
      if (filterType === 'assistant' && !item.is_assistant) return false;
      if (filterType === 'standard' && item.is_assistant) return false;

      // Check search query
      const matchesSearch = !searchQuery || 
        item.prompt_name?.toLowerCase().includes(searchQuery.toLowerCase());

      // Include if matches or has matching children
      const filteredChildren = item.children?.filter(filterItem) || [];
      
      return matchesSearch || filteredChildren.length > 0;
    };

    const filterWithChildren = (items) => {
      return items.filter(filterItem).map(item => ({
        ...item,
        children: item.children ? filterWithChildren(item.children) : []
      }));
    };

    return filterWithChildren(treeData);
  }, [treeData, searchQuery, filterType]);

  const renderTreeItems = useCallback((items) => (
    items.map((item) => (
      <TreeItem
        key={item.id}
        item={item}
        level={1}
        expandedItems={expandedItems}
        toggleItem={toggleItem}
        addItem={handleAddItem}
        startRenaming={(id, name) => setEditingItem({ id, name })}
        editingItem={editingItem}
        setEditingItem={setEditingItem}
        finishRenaming={async () => {
          if (editingItem) {
            await handleUpdateField('prompt_name', editingItem.name);
            setEditingItem(null);
          }
        }}
        cancelRenaming={() => setEditingItem(null)}
        activeItem={activeItem}
        setActiveItem={setActiveItem}
        deleteItem={handleDeleteItem}
        duplicateItem={handleDuplicateItem}
        moveItem={handleMoveItem}
        siblings={items}
        onRefreshTreeData={refreshTreeData}
        searchQuery={searchQuery}
      />
    ))
  ), [expandedItems, toggleItem, handleAddItem, editingItem, activeItem, handleDeleteItem, handleDuplicateItem, handleMoveItem, handleUpdateField, setEditingItem, setActiveItem, refreshTreeData, searchQuery]);

const handleOpenNewPromptDialog = () => {
    setShowNewPromptChoice(true);
  };

  const handleCreatePlain = () => {
    handleAddItem(null);
  };

  const handlePromptCreated = async () => {
    await refreshTreeData();
  };

  const totalCount = treeData.length;
  const assistantCount = treeData.filter(item => item.is_assistant).length;

  return (
    <div className="flex flex-col h-full">
      {/* Header with search and add button */}
      <div className="flex items-center gap-2 p-2 border-b border-border">
        <div className="flex-1">
          <SearchFilter
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            filterType={filterType}
            onFilterChange={setFilterType}
            placeholder="Search prompts..."
          />
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={handleOpenNewPromptDialog}
              className="h-8 w-8 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Create new prompt"
            >
              <Plus className="h-4 w-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <p>Create new prompt</p>
          </TooltipContent>
        </Tooltip>
      </div>

      {/* Stats bar */}
      {totalCount > 0 && (
        <div className="flex items-center gap-3 px-3 py-1.5 text-[10px] text-muted-foreground border-b border-border bg-muted/20">
          <span>{totalCount} prompt{totalCount !== 1 ? 's' : ''}</span>
          {assistantCount > 0 && (
            <span className="text-primary">• {assistantCount} assistant{assistantCount !== 1 ? 's' : ''}</span>
          )}
          {searchQuery && filteredData.length !== totalCount && (
            <span className="text-accent">• {filteredData.length} shown</span>
          )}
        </div>
      )}

      {/* Tree content */}
      <div className="flex-1 overflow-auto p-2 scrollbar-thin">
        {filteredData.length > 0 ? (
          <Accordion
            type="multiple"
            value={expandedItems}
            onValueChange={toggleItem}
            className="w-full min-w-max"
          >
            {renderTreeItems(filteredData)}
          </Accordion>
        ) : treeData.length === 0 ? (
          <EmptyState
            icon="file"
            title="No prompts yet"
            description="Create your first prompt to get started with prompt management."
            actionIcon={<Plus className="h-5 w-5" />}
            actionAriaLabel="Create first prompt"
            onAction={handleOpenNewPromptDialog}
            tip="Use assistants for conversational AI workflows"
          />
        ) : (
          <EmptyState
            icon="search"
            title="No results found"
            description={`No prompts match "${searchQuery}"${filterType !== 'all' ? ` with filter "${filterType}"` : ''}`}
            actionIcon={<X className="h-5 w-5" />}
            actionAriaLabel="Clear search"
            onAction={() => { setSearchQuery(''); setFilterType('all'); }}
          />
        )}
      </div>

      {/* New Prompt Choice Dialog */}
      <NewPromptChoiceDialog
        isOpen={showNewPromptChoice}
        onClose={() => setShowNewPromptChoice(false)}
        parentId={null}
        onCreatePlain={handleCreatePlain}
        onPromptCreated={handlePromptCreated}
      />
    </div>
  );
};

export default TreeView;