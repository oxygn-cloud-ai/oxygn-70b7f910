import React, { useState, useEffect, useMemo } from 'react';
import { 
  Trash2, 
  Undo2, 
  Search, 
  FileText, 
  LayoutTemplate, 
  Braces, 
  FileJson,
  AlertTriangle,
  RefreshCw
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { SettingCard } from '@/components/ui/setting-card';
import { SettingDivider } from '@/components/ui/setting-divider';
import { useDeletedItems } from '@/hooks/useDeletedItems';
import { useAuth } from '@/contexts/AuthContext';
import { trackEvent } from '@/lib/posthog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { 
  DeletedItem, 
  ItemType, 
  ItemTypeConfig, 
  DeleteDialogState, 
  EmptyTrashDialogState,
  DeletedItemRowProps,
  EmptyStateProps 
} from './types';
import type { LucideIcon } from 'lucide-react';

const ITEM_TYPES: ItemTypeConfig[] = [
  { key: 'all', label: 'All', icon: Trash2 },
  { key: 'prompts', label: 'Prompts', icon: FileText },
  { key: 'templates', label: 'Templates', icon: LayoutTemplate },
  { key: 'jsonSchemas', label: 'JSON Schemas', icon: Braces },
  { key: 'exportTemplates', label: 'Export Templates', icon: FileJson }
];

const formatDate = (dateStr: string | null | undefined): string => {
  if (!dateStr) return 'Unknown';
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  return date.toLocaleDateString();
};

const DeletedItemRow: React.FC<DeletedItemRowProps> = ({ item, type, onRestore, onDelete }) => {
  const getItemName = (): string => {
    switch (type) {
      case 'prompts': return item.prompt_name || 'Untitled Prompt';
      case 'templates': return item.template_name || 'Untitled Template';
      case 'jsonSchemas': return item.schema_name || 'Untitled Schema';
      case 'exportTemplates': return item.template_name || 'Untitled Export Template';
      default: return 'Unknown';
    }
  };

  const getItemMeta = (): string => {
    switch (type) {
      case 'prompts': return item.parent_row_id ? 'Child prompt' : 'Top-level prompt';
      case 'templates': return item.category || 'No category';
      case 'jsonSchemas': return item.category || 'general';
      case 'exportTemplates': return item.export_type || 'confluence';
      default: return '';
    }
  };

  const getIcon = (): LucideIcon => {
    switch (type) {
      case 'prompts': return FileText;
      case 'templates': return LayoutTemplate;
      case 'jsonSchemas': return Braces;
      case 'exportTemplates': return FileJson;
      default: return FileText;
    }
  };

  const Icon = getIcon();

  return (
    <div className="flex items-center gap-3 py-2 px-3 rounded-m3-sm hover:bg-surface-container group">
      <Icon className="h-4 w-4 text-on-surface-variant flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="text-body-sm text-on-surface truncate">{getItemName()}</div>
        <div className="text-[10px] text-on-surface-variant truncate">
          {getItemMeta()} · Deleted {formatDate(item.updated_at)}
        </div>
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => onRestore(type, item.row_id)}
              className="w-7 h-7 flex items-center justify-center rounded-m3-full hover:bg-surface-container-high text-on-surface-variant hover:text-primary"
            >
              <Undo2 className="h-3.5 w-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent className="text-[10px]">Restore</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => onDelete(type, item.row_id, getItemName())}
              className="w-7 h-7 flex items-center justify-center rounded-m3-full hover:bg-surface-container-high text-on-surface-variant hover:text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent className="text-[10px]">Delete permanently</TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
};

const EmptyState: React.FC<EmptyStateProps> = ({ filter }) => (
  <div className="flex flex-col items-center justify-center py-12 text-center">
    <Trash2 className="h-10 w-10 text-on-surface-variant/30 mb-3" />
    <p className="text-body-sm text-on-surface-variant">
      {filter === 'all' ? 'Trash is empty' : `No deleted ${filter}`}
    </p>
    <p className="text-[10px] text-on-surface-variant/60 mt-1">
      Deleted items will appear here
    </p>
  </div>
);

const DeletedItemsContent: React.FC = () => {
  const { isAdmin } = useAuth();
  
  const {
    deletedItems,
    counts,
    isLoading,
    fetchAllDeleted,
    restoreItem,
    permanentlyDeleteItem,
    restoreAll,
    permanentlyDeleteAll
  } = useDeletedItems(isAdmin);

  const [activeFilter, setActiveFilter] = useState<ItemType | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteDialog, setDeleteDialog] = useState<DeleteDialogState>({ open: false, type: null, rowId: null, name: '' });
  const [emptyTrashDialog, setEmptyTrashDialog] = useState<EmptyTrashDialogState>({ open: false, type: null });

  useEffect(() => {
    fetchAllDeleted();
  }, [fetchAllDeleted]);

  // Filter items based on active filter and search query
  const filteredItems = useMemo(() => {
    const getItems = (): DeletedItem[] => {
      if (activeFilter === 'all') {
        return [
          ...((deletedItems?.prompts || []) as DeletedItem[]).map(item => ({ ...item, _type: 'prompts' as ItemType })),
          ...((deletedItems?.templates || []) as DeletedItem[]).map(item => ({ ...item, _type: 'templates' as ItemType })),
          ...((deletedItems?.jsonSchemas || []) as DeletedItem[]).map(item => ({ ...item, _type: 'jsonSchemas' as ItemType })),
          ...((deletedItems?.exportTemplates || []) as DeletedItem[]).map(item => ({ ...item, _type: 'exportTemplates' as ItemType }))
        ].sort((a, b) => new Date(b.updated_at || '').getTime() - new Date(a.updated_at || '').getTime());
      }
      return ((deletedItems?.[activeFilter] || []) as DeletedItem[]).map(item => ({ ...item, _type: activeFilter }));
    };

    const items = getItems();
    
    if (!searchQuery.trim()) return items;

    const query = searchQuery.toLowerCase();
    return items.filter(item => {
      const name = item.prompt_name || item.template_name || item.schema_name || '';
      return name.toLowerCase().includes(query);
    });
  }, [deletedItems, activeFilter, searchQuery]);

  const handleRestore = async (type: ItemType, rowId: string): Promise<void> => {
    await restoreItem(type, rowId);
  };

  const handleDeleteClick = (type: ItemType, rowId: string, name: string): void => {
    setDeleteDialog({ open: true, type, rowId, name });
  };

  const handleConfirmDelete = async (): Promise<void> => {
    if (deleteDialog.type && deleteDialog.rowId) {
      await permanentlyDeleteItem(deleteDialog.type, deleteDialog.rowId);
    }
    setDeleteDialog({ open: false, type: null, rowId: null, name: '' });
  };

  const handleEmptyTrashClick = (): void => {
    setEmptyTrashDialog({ open: true, type: activeFilter === 'all' ? null : activeFilter });
  };

  const handleConfirmEmptyTrash = async (): Promise<void> => {
    await permanentlyDeleteAll(emptyTrashDialog.type);
    trackEvent('trash_emptied', { type: emptyTrashDialog.type || 'all' });
    setEmptyTrashDialog({ open: false, type: null });
  };

  const handleRestoreAll = async (): Promise<void> => {
    await restoreAll(activeFilter === 'all' ? null : activeFilter);
    trackEvent('trash_restore_all', { type: activeFilter });
  };

  const currentCount = activeFilter === 'all' ? counts?.total || 0 : counts?.[activeFilter] || 0;

  return (
    <div className="h-full flex flex-col bg-surface overflow-hidden">
      {/* Header */}
      <div className="h-14 flex items-center gap-3 px-4 border-b border-outline-variant shrink-0">
        <Trash2 className="h-5 w-5 text-on-surface-variant" />
        <h2 className="text-title-sm text-on-surface font-medium">Deleted Items</h2>
        {(counts?.total || 0) > 0 && (
          <span className="px-2 py-0.5 bg-surface-container rounded-m3-full text-label-sm text-on-surface-variant">
            {counts?.total}
          </span>
        )}
        <div className="flex-1" />
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => fetchAllDeleted()}
              disabled={isLoading}
              className="w-8 h-8 flex items-center justify-center rounded-m3-full hover:bg-surface-container text-on-surface-variant"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </TooltipTrigger>
          <TooltipContent className="text-[10px]">Refresh</TooltipContent>
        </Tooltip>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4 space-y-4">
        {/* Filter Tabs */}
        <div className="flex items-center gap-1 p-1 bg-surface-container-low rounded-m3-md">
          {ITEM_TYPES.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveFilter(key)}
              className={`
                flex items-center gap-1.5 px-3 py-1.5 rounded-m3-sm text-label-sm transition-colors
                ${activeFilter === key 
                  ? 'bg-primary text-on-primary' 
                  : 'text-on-surface-variant hover:bg-surface-container'
                }
              `}
            >
              <Icon className="h-3.5 w-3.5" />
              <span>{label}</span>
              {key !== 'all' && (counts?.[key as ItemType] || 0) > 0 && (
                <span className={`text-[10px] px-1.5 rounded-m3-full ${
                  activeFilter === key ? 'bg-on-primary/20' : 'bg-surface-container'
                }`}>
                  {counts?.[key as ItemType]}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Search and Actions */}
        <div className="flex items-center gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-on-surface-variant" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search deleted items..."
              className="w-full h-9 pl-9 pr-3 bg-surface-container rounded-m3-sm border border-outline-variant text-body-sm text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          {currentCount > 0 && (
            <div className="flex items-center gap-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={handleRestoreAll}
                    className="h-9 px-3 flex items-center gap-2 rounded-m3-sm bg-surface-container hover:bg-surface-container-high text-body-sm text-on-surface-variant hover:text-on-surface transition-colors"
                  >
                    <Undo2 className="h-4 w-4" />
                    <span>Restore All</span>
                  </button>
                </TooltipTrigger>
                <TooltipContent className="text-[10px]">
                  Restore all {activeFilter === 'all' ? 'items' : activeFilter}
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={handleEmptyTrashClick}
                    className="h-9 px-3 flex items-center gap-2 rounded-m3-sm bg-destructive/10 hover:bg-destructive/20 text-body-sm text-destructive transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                    <span>Empty</span>
                  </button>
                </TooltipTrigger>
                <TooltipContent className="text-[10px]">
                  Permanently delete all {activeFilter === 'all' ? 'items' : activeFilter}
                </TooltipContent>
              </Tooltip>
            </div>
          )}
        </div>

        {/* Items List */}
        <SettingCard>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-5 w-5 text-on-surface-variant animate-spin" />
            </div>
          ) : filteredItems.length === 0 ? (
            <EmptyState filter={activeFilter} />
          ) : (
            <div className="space-y-1">
              {filteredItems.map((item, index) => (
                <React.Fragment key={`${item._type}-${item.row_id}`}>
                  <DeletedItemRow
                    item={item}
                    type={item._type!}
                    onRestore={handleRestore}
                    onDelete={handleDeleteClick}
                  />
                  {index < filteredItems.length - 1 && <SettingDivider />}
                </React.Fragment>
              ))}
            </div>
          )}
        </SettingCard>

        {/* Info text */}
        {(counts?.total || 0) > 0 && (
          <p className="text-[10px] text-on-surface-variant text-center">
            Items in trash can be restored or permanently deleted. Permanent deletion cannot be undone.
          </p>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialog.open} onOpenChange={(open) => !open && setDeleteDialog({ open: false, type: null, rowId: null, name: '' })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Permanently Delete?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to permanently delete "{deleteDialog.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete Permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Empty Trash Confirmation Dialog */}
      <AlertDialog open={emptyTrashDialog.open} onOpenChange={(open) => !open && setEmptyTrashDialog({ open: false, type: null })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Empty Trash?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to permanently delete {emptyTrashDialog.type ? `all ${emptyTrashDialog.type}` : 'all items'} in the trash? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmEmptyTrash} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Empty Trash
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default DeletedItemsContent;
