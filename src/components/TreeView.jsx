import React, { useCallback, useMemo, useState } from 'react';
import { Accordion } from "@/components/ui/accordion";
import { Plus } from 'lucide-react';
import { Button } from "@/components/ui/button";
import TreeItem from './TreeItem';
import SearchFilter from './SearchFilter';
import EmptyState from './EmptyState';

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

  const handleCreateFirst = () => {
    handleAddItem(null);
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
        <Button
          onClick={handleCreateFirst}
          size="sm"
          className="h-8 gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm"
        >
          <Plus className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">New</span>
        </Button>
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
            actionLabel="Create First Prompt"
            onAction={handleCreateFirst}
            tip="Use assistants for conversational AI workflows"
          />
        ) : (
          <EmptyState
            icon="search"
            title="No results found"
            description={`No prompts match "${searchQuery}"${filterType !== 'all' ? ` with filter "${filterType}"` : ''}`}
            actionLabel="Clear Search"
            onAction={() => { setSearchQuery(''); setFilterType('all'); }}
          />
        )}
      </div>
    </div>
  );
};

export default TreeView;
