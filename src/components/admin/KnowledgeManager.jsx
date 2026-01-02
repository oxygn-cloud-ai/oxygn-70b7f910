import { useState } from 'react';
import { 
  Search, Plus, Filter, BookOpen, Tag, 
  ChevronDown, Edit2, Trash2, History, Download, Upload
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { SettingCard } from '@/components/ui/setting-card';
import { useKnowledge } from '@/hooks/useKnowledge';
import KnowledgeEditor from './KnowledgeEditor';
import { ExportKnowledgeDialog, ImportKnowledgeDialog } from './KnowledgeImportExport';
import { toast } from '@/components/ui/sonner';

const TopicBadge = ({ topic }) => {
  const colors = {
    overview: 'bg-blue-500/10 text-blue-600',
    prompts: 'bg-purple-500/10 text-purple-600',
    variables: 'bg-green-500/10 text-green-600',
    templates: 'bg-amber-500/10 text-amber-600',
    json_schemas: 'bg-pink-500/10 text-pink-600',
    actions: 'bg-red-500/10 text-red-600',
    files: 'bg-cyan-500/10 text-cyan-600',
    confluence: 'bg-indigo-500/10 text-indigo-600',
    cascade: 'bg-orange-500/10 text-orange-600',
    library: 'bg-teal-500/10 text-teal-600',
    workbench: 'bg-violet-500/10 text-violet-600',
    troubleshooting: 'bg-rose-500/10 text-rose-600',
    database: 'bg-emerald-500/10 text-emerald-600',
    edge_functions: 'bg-sky-500/10 text-sky-600',
    api: 'bg-lime-500/10 text-lime-600'
  };

  return (
    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${colors[topic] || 'bg-surface-container text-on-surface-variant'}`}>
      {topic.replace('_', ' ')}
    </span>
  );
};

const KnowledgeItem = ({ item, onEdit, onDelete, onViewHistory }) => {
  const [showActions, setShowActions] = useState(false);

  return (
    <div 
      className="group p-3 bg-surface-container rounded-m3-md hover:bg-surface-container-high transition-colors"
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <TopicBadge topic={item.topic} />
            {item.priority > 0 && (
              <span className="text-[10px] text-primary font-medium">★ {item.priority}</span>
            )}
          </div>
          <h4 className="text-body-sm text-on-surface font-medium truncate">
            {item.title}
          </h4>
          <p className="text-[10px] text-on-surface-variant line-clamp-2 mt-0.5">
            {item.content.substring(0, 150)}...
          </p>
          {item.keywords?.length > 0 && (
            <div className="flex items-center gap-1 mt-1.5 flex-wrap">
              <Tag className="h-2.5 w-2.5 text-on-surface-variant" />
              {item.keywords.slice(0, 3).map((kw, i) => (
                <span key={i} className="text-[9px] text-on-surface-variant">
                  {kw}{i < Math.min(item.keywords.length - 1, 2) ? ',' : ''}
                </span>
              ))}
              {item.keywords.length > 3 && (
                <span className="text-[9px] text-on-surface-variant">+{item.keywords.length - 3}</span>
              )}
            </div>
          )}
        </div>
        
        <div className={`flex items-center gap-1 transition-opacity ${showActions ? 'opacity-100' : 'opacity-0'}`}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => onViewHistory(item)}
                className="w-7 h-7 flex items-center justify-center rounded-m3-full text-on-surface-variant hover:bg-surface-container"
              >
                <History className="h-3.5 w-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent className="text-[10px]">View History</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => onEdit(item)}
                className="w-7 h-7 flex items-center justify-center rounded-m3-full text-on-surface-variant hover:bg-surface-container"
              >
                <Edit2 className="h-3.5 w-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent className="text-[10px]">Edit</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => onDelete(item)}
                className="w-7 h-7 flex items-center justify-center rounded-m3-full text-on-surface-variant hover:bg-surface-container hover:text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent className="text-[10px]">Delete</TooltipContent>
          </Tooltip>
        </div>
      </div>
    </div>
  );
};

const KnowledgeManager = () => {
  const {
    items,
    isLoading,
    topics,
    selectedTopic,
    setSelectedTopic,
    searchQuery,
    setSearchQuery,
    createItem,
    updateItem,
    deleteItem,
    getItemHistory,
    bulkImportItems,
    regenerateEmbeddings,
    fetchItems
  } = useKnowledge();

  const [editingItem, setEditingItem] = useState(null);
  const [isCreating, setIsCreating] = useState(false);
  const [showTopicFilter, setShowTopicFilter] = useState(false);

  const handleSave = async (itemData) => {
    if (editingItem) {
      await updateItem(editingItem.row_id, itemData);
    } else {
      await createItem(itemData);
    }
    setEditingItem(null);
    setIsCreating(false);
  };

  const handleDelete = async (item) => {
    if (confirm(`Delete "${item.title}"?`)) {
      await deleteItem(item.row_id);
    }
  };

  const handleViewHistory = async (item) => {
    const history = await getItemHistory(item.row_id);
    console.log('History for', item.title, ':', history);
    // Could open a modal here to show history
  };

  const handleBulkImport = async (importItems) => {
    const results = await bulkImportItems(importItems);
    if (results.created > 0 || results.updated > 0) {
      toast.info('Regenerating embeddings in background...');
      regenerateEmbeddings().then((res) => {
        if (res.success) {
          toast.success(`Embeddings regenerated: ${res.processed || 0} items`);
        }
      });
      fetchItems();
    }
    return results;
  };

  if (editingItem || isCreating) {
    return (
      <KnowledgeEditor
        item={editingItem}
        topics={topics}
        onSave={handleSave}
        onCancel={() => {
          setEditingItem(null);
          setIsCreating(false);
        }}
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Header Actions */}
      <div className="flex items-center gap-3">
        {/* Search */}
        <div className="flex-1 relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-on-surface-variant" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search knowledge..."
            className="w-full h-8 pl-8 pr-3 bg-surface-container rounded-m3-sm border border-outline-variant text-body-sm text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        {/* Topic Filter */}
        <div className="relative">
          <button
            onClick={() => setShowTopicFilter(!showTopicFilter)}
            className={`h-8 px-3 flex items-center gap-2 rounded-m3-sm border text-body-sm ${
              selectedTopic 
                ? 'border-primary bg-primary/10 text-primary' 
                : 'border-outline-variant bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
            }`}
          >
            <Filter className="h-3.5 w-3.5" />
            {selectedTopic || 'All Topics'}
            <ChevronDown className="h-3 w-3" />
          </button>
          
          {showTopicFilter && (
            <div className="absolute top-full right-0 mt-1 w-48 bg-surface-container-high rounded-m3-md shadow-lg border border-outline-variant z-10 py-1 max-h-64 overflow-auto">
              <button
                onClick={() => { setSelectedTopic(null); setShowTopicFilter(false); }}
                className={`w-full px-3 py-1.5 text-left text-body-sm hover:bg-surface-container ${!selectedTopic ? 'text-primary' : 'text-on-surface'}`}
              >
                All Topics
              </button>
              {topics.map(topic => (
                <button
                  key={topic}
                  onClick={() => { setSelectedTopic(topic); setShowTopicFilter(false); }}
                  className={`w-full px-3 py-1.5 text-left text-body-sm hover:bg-surface-container ${selectedTopic === topic ? 'text-primary' : 'text-on-surface'}`}
                >
                  {topic.replace('_', ' ')}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Export Button */}
        <ExportKnowledgeDialog
          items={items}
          selectedTopic={selectedTopic}
          trigger={
            <Tooltip>
              <TooltipTrigger asChild>
                <button className="w-8 h-8 flex items-center justify-center rounded-m3-full hover:bg-surface-container">
                  <Download className="h-4 w-4 text-on-surface-variant" />
                </button>
              </TooltipTrigger>
              <TooltipContent className="text-[10px]">Export Knowledge</TooltipContent>
            </Tooltip>
          }
        />

        {/* Import Button */}
        <ImportKnowledgeDialog
          topics={topics}
          onImport={handleBulkImport}
          trigger={
            <Tooltip>
              <TooltipTrigger asChild>
                <button className="w-8 h-8 flex items-center justify-center rounded-m3-full hover:bg-surface-container">
                  <Upload className="h-4 w-4 text-on-surface-variant" />
                </button>
              </TooltipTrigger>
              <TooltipContent className="text-[10px]">Import Knowledge</TooltipContent>
            </Tooltip>
          }
        />

        {/* Add Button */}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => setIsCreating(true)}
              className="w-8 h-8 flex items-center justify-center rounded-m3-full bg-primary text-on-primary hover:bg-primary/90"
            >
              <Plus className="h-4 w-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent className="text-[10px]">Add Knowledge</TooltipContent>
        </Tooltip>
      </div>

      {/* Stats */}
      <SettingCard>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-on-surface-variant" />
            <span className="text-body-sm text-on-surface">
              {items.length} knowledge item{items.length !== 1 ? 's' : ''}
              {selectedTopic && ` in ${selectedTopic.replace('_', ' ')}`}
            </span>
          </div>
          <span className="text-[10px] text-on-surface-variant">
            {topics.length} topics
          </span>
        </div>
      </SettingCard>

      {/* Items List */}
      {isLoading ? (
        <div className="text-center py-8">
          <p className="text-body-sm text-on-surface-variant">Loading...</p>
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-8">
          <BookOpen className="h-8 w-8 text-on-surface-variant/50 mx-auto mb-2" />
          <p className="text-body-sm text-on-surface-variant">No knowledge items found</p>
          <button
            onClick={() => setIsCreating(true)}
            className="mt-2 text-body-sm text-primary hover:underline"
          >
            Add your first item
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map(item => (
            <KnowledgeItem
              key={item.row_id}
              item={item}
              onEdit={setEditingItem}
              onDelete={handleDelete}
              onViewHistory={handleViewHistory}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default KnowledgeManager;
