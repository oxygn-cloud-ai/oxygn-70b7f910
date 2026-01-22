import React, { useState, useRef, useMemo, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { icons, LucideIcon, LucideProps } from "lucide-react";
import { 
  Inbox, 
  MessageSquare, 
  Star, 
  Clock, 
  ChevronRight, 
  ChevronDown, 
  FileText,
  Plus,
  Copy,
  Trash2,
  Ban,
  FileX,
  Play,
  Braces,
  Upload,
  Workflow,
  RefreshCw,
  Loader2,
  Filter,
  LayoutTemplate,
  CheckSquare,
  Square,
  X,
  PanelLeftClose,
  Maximize2,
  EllipsisVertical
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { useDrag, useDrop } from "react-dnd";
import { SkeletonListItem } from "@/components/shared/Skeletons";
import { toast } from "@/components/ui/sonner";
import { IconPicker } from "@/components/IconPicker";
import { updatePromptIcon, updatePromptField } from "@/services/promptMutations";
import { useSupabase } from "@/hooks/useSupabase";
import { useDragAutoScroll } from "@/hooks/useDragAutoScroll";
import type { SupabaseClient } from "@supabase/supabase-js";

// ============= Type Definitions =============

export interface PromptItem {
  id?: string;
  row_id?: string;
  prompt_name?: string;
  name?: string;
  icon_name?: string;
  starred?: boolean;
  exclude_from_cascade?: boolean;
  exclude_from_export?: boolean;
  is_assistant?: boolean;
  has_uncommitted_changes?: boolean;
  updated_at?: string;
  created_at?: string;
  children?: PromptItem[];
}

interface FlatItem {
  id: string;
  item: PromptItem;
}

interface SmartFolderCounts {
  all: number;
  conversations: number;
  starred: number;
  recent: number;
}

type SmartFolderType = "all" | "starred" | "conversations" | "recent";

const ITEM_TYPE = "PROMPT_ITEM";

// ============= Helper Components =============

interface SmartFolderProps {
  icon: LucideIcon;
  label: string;
  count: number;
  isActive?: boolean;
  onClick: () => void;
  badge?: string;
}

const SmartFolder: React.FC<SmartFolderProps> = ({ 
  icon: Icon, 
  label, 
  count, 
  isActive = false, 
  onClick, 
  badge 
}) => (
  <motion.button
    onClick={onClick}
    whileHover={{ x: isActive ? 0 : 2 }}
    whileTap={{ scale: 0.98 }}
    className={`
      w-full h-7 flex items-center gap-2 px-2.5 rounded-m3-sm
      transition-all duration-200 ease-emphasized group relative
      ${isActive 
        ? "bg-secondary-container text-secondary-container-foreground shadow-sm" 
        : "text-on-surface-variant hover:bg-on-surface/[0.08]"
      }
    `}
    style={{ height: "28px" }}
  >
    <Icon className={`h-4 w-4 flex-shrink-0 transition-all duration-200 ${
      isActive ? 'text-primary scale-105' : 'group-hover:scale-110'
    }`} />
    <span className="flex-1 text-left text-tree truncate font-medium">{label}</span>
    {badge && (
      <span className="text-[8px] px-1 py-0.5 rounded-full bg-primary/20 text-primary font-medium mr-1">
        {badge}
      </span>
    )}
    <motion.span 
      key={count}
      initial={{ scale: 1.2, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className={`text-[10px] px-1.5 py-0.5 rounded-full transition-colors min-w-[20px] text-center ${
        isActive ? 'bg-primary/20 text-primary font-medium' : 'bg-on-surface/[0.08]'
      }`}
    >
      {count}
    </motion.span>
  </motion.button>
);

interface IconButtonProps {
  icon: LucideIcon;
  label: string;
  className?: string;
  onClick?: () => void;
}

const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ icon: Icon, label, className = "", onClick }, ref) => (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          ref={ref}
          onClick={(e) => { e.stopPropagation(); onClick?.(); }}
          className={`w-5 h-5 flex items-center justify-center rounded-sm text-on-surface-variant hover:bg-on-surface/[0.12] hover:scale-110 transition-all duration-150 ${className}`}
        >
          <Icon className="h-3 w-3" />
        </button>
      </TooltipTrigger>
      <TooltipContent className="text-[10px]">{label}</TooltipContent>
    </Tooltip>
  )
);
IconButton.displayName = 'IconButton';

// ============= DropZone Component =============

interface DropZoneProps {
  onDrop: (draggedId: string, targetIndex: number, siblingIds: string[]) => void;
  targetIndex: number;
  siblingIds: string[];
  isFirst?: boolean;
}

const DropZone: React.FC<DropZoneProps> = ({ onDrop, targetIndex, siblingIds, isFirst = false }) => {
  const [{ isOver, canDrop }, drop] = useDrop({
    accept: ITEM_TYPE,
    drop: (item: { id: string }, monitor) => {
      if (monitor.isOver({ shallow: true })) {
        onDrop(item.id, targetIndex, siblingIds);
      }
    },
    collect: (monitor) => ({
      isOver: monitor.isOver({ shallow: true }),
      canDrop: monitor.canDrop(),
    }),
  });

  const isActive = isOver && canDrop;

  return (
    <div
      ref={drop}
      className="relative"
      style={{ 
        height: '8px',
        marginTop: isFirst ? '2px' : '-4px',
        marginBottom: '-4px',
      }}
    >
      <div 
        className={`
          absolute left-2 right-2 top-1/2 -translate-y-1/2 
          flex items-center transition-opacity duration-150
          ${isActive ? 'opacity-100' : 'opacity-0 pointer-events-none'}
        `}
      >
        <div className="w-2 h-2 rounded-full bg-primary border-2 border-primary shrink-0" />
        <div className="flex-1 h-0.5 bg-primary" />
        <div className="w-2 h-2 rounded-full bg-primary border-2 border-primary shrink-0" />
      </div>
    </div>
  );
};

// ============= TreeItem Component =============

interface TreeItemProps {
  item: PromptItem;
  level?: number;
  isExpanded?: boolean;
  onToggle?: (id: string) => void;
  isActive?: boolean;
  onMoveInto?: (draggedId: string, targetId: string) => void;
  onMoveBetween?: (draggedId: string, targetIndex: number, siblingIds: string[]) => void;
  onSelect?: (id: string | null) => void;
  onAdd?: (parentId: string | null) => void;
  onDelete?: (id: string, name: string) => void;
  onDuplicate?: (id: string) => void;
  onExport?: (id: string) => void;
  expandedFolders: Record<string, boolean>;
  selectedPromptId?: string | null;
  onRunPrompt?: (id: string) => void;
  onRunCascade?: (id: string) => void;
  onToggleStar?: (id: string) => void;
  onToggleExcludeCascade?: (id: string) => void;
  onToggleExcludeExport?: (id: string) => void;
  isRunningPrompt?: boolean;
  isRunningCascade?: boolean;
  isMultiSelectMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: (id: string) => void;
  lastSelectedId?: string | null;
  allFlatItems?: FlatItem[];
  onRangeSelect?: (fromId: string, toId: string, flatItems: FlatItem[]) => void;
  selectedItems?: Set<string>;
  onSelectOnlyThis?: (id: string) => void;
  onIconChange?: (promptId: string, iconName: string | null) => Promise<void>;
  onRefresh?: () => void;
  supabase: SupabaseClient | null;
  currentCascadePromptId?: string | null;
  singleRunPromptId?: string | null;
  isCascadeRunning?: boolean;
  deletingPromptIds?: Set<string>;
  onSaveAsTemplate?: (id: string, name: string, hasChildren: boolean) => void;
  openMenuId: string | null;
  setOpenMenuId: (id: string | null) => void;
  isManusModelById?: (id: string) => boolean;
}

const TreeItem: React.FC<TreeItemProps> = ({ 
  item,
  level = 0, 
  isExpanded = false, 
  onToggle, 
  onMoveInto,
  onMoveBetween,
  onSelect,
  onAdd,
  onDelete,
  onDuplicate,
  onExport,
  expandedFolders,
  selectedPromptId,
  onRunPrompt,
  onRunCascade,
  onToggleStar,
  onToggleExcludeCascade,
  onToggleExcludeExport,
  isRunningPrompt,
  isRunningCascade,
  isMultiSelectMode,
  isSelected,
  onToggleSelect,
  lastSelectedId,
  allFlatItems,
  onRangeSelect,
  selectedItems,
  onSelectOnlyThis,
  onIconChange,
  onRefresh,
  supabase,
  currentCascadePromptId,
  singleRunPromptId,
  isCascadeRunning,
  deletingPromptIds = new Set(),
  onSaveAsTemplate,
  openMenuId,
  setOpenMenuId,
  isManusModelById,
}) => {
  const [iconPickerOpen, setIconPickerOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const mountedRef = useRef(true);
  const visualLevel = Math.min(level, 4);
  const paddingLeft = 10 + visualLevel * 12;
  
  const hasChildren = item.children && item.children.length > 0;
  const starred = item.starred || false;
  const excludedFromCascade = item.exclude_from_cascade || false;
  const excludedFromExport = item.exclude_from_export || false;
  const isConversation = item.is_assistant || false;
  const label = item.name || item.prompt_name || 'Untitled';
  const id = item.id || item.row_id || '';
  
  const isMenuOpen = openMenuId === id;
  
  useEffect(() => {
    return () => { mountedRef.current = false; };
  }, []);
  
  useEffect(() => {
    if (!isMenuOpen) return;
    
    const handleEscapeCapture = (e: KeyboardEvent) => {
      if (!mountedRef.current) return;
      if (e.key === 'Escape') {
        e.stopPropagation();
        setOpenMenuId(null);
      }
    };
    
    document.addEventListener('keydown', handleEscapeCapture, true);
    return () => document.removeEventListener('keydown', handleEscapeCapture, true);
  }, [isMenuOpen, setOpenMenuId]);
  
  useEffect(() => {
    if (!isMenuOpen) return;
    
    let handler: ((e: MouseEvent) => void) | null = null;
    const timeoutId = setTimeout(() => {
      handler = (e: MouseEvent) => {
        if (!mountedRef.current) return;
        if (menuRef.current && menuRef.current.contains(e.target as Node)) return;
        if (menuButtonRef.current && menuButtonRef.current.contains(e.target as Node)) return;
        
        const target = e.target as Element;
        const isTooltip = target.closest('[data-radix-popper-content-wrapper]') ||
                          target.closest('[role="tooltip"]');
        if (isTooltip) return;
        
        setOpenMenuId(null);
      };
      
      document.addEventListener('mousedown', handler);
    }, 0);
    
    return () => {
      clearTimeout(timeoutId);
      if (handler) {
        document.removeEventListener('mousedown', handler);
      }
    };
  }, [isMenuOpen, setOpenMenuId]);
  
  useEffect(() => {
    if (!isMenuOpen) return;
    
    const handleScroll = () => {
      if (!mountedRef.current) return;
      setOpenMenuId(null);
    };
    
    const scrollContainer = menuButtonRef.current?.closest('[data-radix-scroll-area-viewport]');
    
    scrollContainer?.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('scroll', handleScroll, { passive: true });
    
    return () => {
      scrollContainer?.removeEventListener('scroll', handleScroll);
      window.removeEventListener('scroll', handleScroll);
    };
  }, [isMenuOpen, setOpenMenuId]);
  
  const getMenuPosition = useCallback(() => {
    if (!menuButtonRef.current) return { top: 0, left: 0 };
    
    const rect = menuButtonRef.current.getBoundingClientRect();
    const menuHeight = 36;
    const menuWidth = 280;
    const padding = 8;
    
    let top = rect.bottom + 4;
    let left = rect.left;
    
    if (top + menuHeight > window.innerHeight - padding) {
      top = rect.top - menuHeight - 4;
    }
    
    if (left + menuWidth > window.innerWidth - padding) {
      left = window.innerWidth - menuWidth - padding;
    }
    
    if (left < padding) {
      left = padding;
    }
    
    return { top, left };
  }, []);

  const [{ isDragging }, drag] = useDrag({
    type: ITEM_TYPE,
    item: { id, level },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });

  const [{ isOver, canDrop }, drop] = useDrop({
    accept: ITEM_TYPE,
    canDrop: (dragItem: { id: string }) => dragItem.id !== id,
    drop: (dragItem: { id: string }, monitor) => {
      if (monitor.isOver({ shallow: true }) && !monitor.didDrop() && dragItem.id !== id && onMoveInto) {
        onMoveInto(dragItem.id, id);
      }
    },
    collect: (monitor) => ({
      isOver: monitor.isOver({ shallow: true }),
      canDrop: monitor.canDrop(),
    }),
  });

  drag(drop(ref));
  
  const customIconName = item.icon_name;
  const CustomIcon = customIconName && icons[customIconName as keyof typeof icons] 
    ? icons[customIconName as keyof typeof icons] as LucideIcon
    : null;
  const DefaultIcon = isConversation ? MessageSquare : FileText;
  const DisplayIcon = CustomIcon || DefaultIcon;
  
  const itemIsActive = selectedPromptId === id;
  const isCurrentlyRunning = (isCascadeRunning && currentCascadePromptId === id) || singleRunPromptId === id;
  const isDeleting = deletingPromptIds.has(id);
  
  const handleIconClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIconPickerOpen(true);
  };
  
  const handleIconSelect = async (iconName: string | null) => {
    if (onIconChange) {
      await onIconChange(id, iconName);
    }
  };
  
  const handleToggleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggle?.(id);
  };
  
  const handleRowClick = (e: React.MouseEvent) => {
    if (isEditing || isDeleting) return;
    
    if (isMultiSelectMode) {
      if (e.shiftKey && lastSelectedId && allFlatItems && onRangeSelect) {
        onRangeSelect(lastSelectedId, id, allFlatItems);
      } else {
        onToggleSelect?.(id);
      }
    } else {
      const isCurrentlySelected = selectedPromptId === id;
      onSelect?.(isCurrentlySelected ? null : id);
    }
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isEditing || isDeleting) return;
    onSelectOnlyThis?.(id);
  };

  const handleCheckboxClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (e.shiftKey && lastSelectedId && allFlatItems && onRangeSelect) {
      onRangeSelect(lastSelectedId, id, allFlatItems);
    } else {
      onToggleSelect?.(id);
    }
  };

  const handleStartEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditValue(label);
    setIsEditing(true);
  };

  const handleSaveEdit = async () => {
    if (editValue.trim() && editValue.trim() !== label && supabase) {
      try {
        await updatePromptField(supabase, id, 'prompt_name', editValue.trim());
        onRefresh?.();
      } catch (error) {
        console.error('Error renaming prompt:', error);
        toast.error('Failed to rename prompt');
      }
    }
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditValue('');
  };
  
  return (
    <>
      <div
        ref={ref}
        onClick={handleRowClick}
        onDoubleClick={handleDoubleClick}
        className={`
          relative w-full h-7 flex items-center gap-0.5 pr-1.5 rounded-m3-sm 
          transition-all duration-200 ease-emphasized group
          ${isDeleting 
            ? "opacity-50 cursor-not-allowed pointer-events-none"
            : "cursor-pointer"
          }
          ${isCurrentlyRunning
            ? "ring-2 ring-primary ring-offset-1 ring-offset-surface bg-primary/10"
            : itemIsActive 
              ? "bg-secondary-container text-secondary-container-foreground" 
              : "text-on-surface-variant hover:bg-on-surface/[0.08]"
          }
          ${isDragging ? "opacity-50 scale-95" : "hover:translate-x-0.5"}
          ${isOver && canDrop ? "ring-1 ring-primary bg-primary/10" : ""}
        `}
        style={{ height: "28px", paddingLeft: `${paddingLeft}px` }}
      >
        <div onClick={handleCheckboxClick} className="flex-shrink-0">
          {isSelected ? (
            <CheckSquare className="h-3.5 w-3.5 text-primary" />
          ) : (
            <Square className="h-3.5 w-3.5 text-on-surface-variant/40 hover:text-on-surface-variant transition-colors" />
          )}
        </div>
        
        {!isEditing && (
          <button
            ref={menuButtonRef}
            onClick={(e) => {
              e.stopPropagation();
              setOpenMenuId(isMenuOpen ? null : id);
            }}
            className="w-5 h-5 flex items-center justify-center rounded-sm text-on-surface-variant hover:bg-on-surface/[0.12] transition-all flex-shrink-0"
          >
            <EllipsisVertical className="h-3.5 w-3.5" />
          </button>
        )}
        
        <button 
          onClick={handleToggleClick}
          className={`w-5 h-5 flex items-center justify-center rounded-sm transition-all flex-shrink-0 ${
            hasChildren 
              ? 'hover:bg-on-surface/[0.12] cursor-pointer' 
              : 'cursor-default opacity-0'
          }`}
          disabled={!hasChildren}
        >
          {isExpanded 
            ? <ChevronDown className="h-3.5 w-3.5" />
            : <ChevronRight className="h-3.5 w-3.5" />
          }
        </button>
        
        {isCurrentlyRunning ? (
          <Loader2 className="h-3.5 w-3.5 flex-shrink-0 text-primary animate-spin" />
        ) : (
          <Tooltip>
            <TooltipTrigger asChild>
              <button 
                onClick={handleIconClick}
                className="h-3.5 w-3.5 flex-shrink-0 hover:text-primary transition-colors"
              >
                <DisplayIcon className="h-3.5 w-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent className="text-[10px]">Click to change icon</TooltipContent>
          </Tooltip>
        )}
        
        {isEditing ? (
          <Input
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === 'Enter') handleSaveEdit();
              if (e.key === 'Escape') handleCancelEdit();
            }}
            onBlur={handleSaveEdit}
            onClick={(e) => e.stopPropagation()}
            autoFocus
            className="flex-1 h-5 text-tree py-0 px-1 bg-surface-container border-primary"
          />
        ) : (
          <span 
            className={`flex-1 text-left text-tree truncate font-medium ${isDeleting ? 'line-through opacity-50' : ''}`}
            onDoubleClick={isDeleting ? undefined : handleStartEdit}
          >
            {label}
          </span>
        )}
        
        <IconPicker 
          open={iconPickerOpen}
          onOpenChange={setIconPickerOpen}
          currentIcon={customIconName}
          onIconSelect={handleIconSelect}
        />
        
        {(starred || excludedFromCascade || excludedFromExport || item.has_uncommitted_changes) && (
          <div className="absolute right-2 flex items-center gap-0.5">
            {item.has_uncommitted_changes && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="w-1.5 h-1.5 bg-amber-500 rounded-full" />
                </TooltipTrigger>
                <TooltipContent className="text-[10px]">Uncommitted changes</TooltipContent>
              </Tooltip>
            )}
            {starred && <Star className="h-2.5 w-2.5 text-amber-500 fill-amber-500" />}
            {excludedFromCascade && <Ban className="h-2.5 w-2.5 text-warning" />}
            {excludedFromExport && <FileX className="h-2.5 w-2.5 text-warning" />}
          </div>
        )}

        {isMenuOpen && !isMultiSelectMode && menuButtonRef.current && createPortal(
          <div 
            ref={menuRef}
            className="fixed flex items-center gap-0.5 bg-surface-container-high rounded-m3-sm shadow-lg px-1 py-0.5 z-50 border border-outline-variant"
            style={getMenuPosition()}
          >
            <IconButton 
              icon={Star} 
              label={starred ? "Unstar" : "Star"} 
              className={starred ? "text-amber-500" : ""} 
              onClick={() => { onToggleStar?.(id); setOpenMenuId(null); }}
            />
            {isManusModelById?.(id) ? (
              <IconButton 
                icon={Play} 
                label="Manus requires cascade" 
                className="opacity-40 cursor-not-allowed"
                onClick={() => toast.info('Manus models require cascade execution')}
              />
            ) : (
              <IconButton 
                icon={isRunningPrompt ? Loader2 : Play} 
                label="Play" 
                onClick={() => { onRunPrompt?.(id); setOpenMenuId(null); }}
                className={isRunningPrompt ? "animate-spin" : ""}
              />
            )}
            {hasChildren && (
              <IconButton 
                icon={isRunningCascade ? Loader2 : Workflow} 
                label="Run Cascade" 
                onClick={() => { onRunCascade?.(id); setOpenMenuId(null); }}
                className={isRunningCascade ? "animate-spin" : ""}
              />
            )}
            <IconButton icon={Braces} label="Copy Variable Reference" onClick={() => {
              navigator.clipboard.writeText(`{{q.ref[${id}]}}`);
              toast.success('Copied variable reference');
              setOpenMenuId(null);
            }} />
            <IconButton icon={Plus} label="Add Child" onClick={() => { onAdd?.(id); setOpenMenuId(null); }} />
            <IconButton icon={Copy} label="Duplicate" onClick={() => { onDuplicate?.(id); setOpenMenuId(null); }} />
            <IconButton icon={Upload} label="Export" onClick={() => { onExport?.(id); setOpenMenuId(null); }} />
            <IconButton 
              icon={LayoutTemplate} 
              label="Save as Template" 
              onClick={() => { onSaveAsTemplate?.(id, label, !!hasChildren); setOpenMenuId(null); }}
            />
            <IconButton 
              icon={Ban} 
              label={excludedFromCascade ? "Include in Cascade" : "Exclude from Cascade"} 
              className={excludedFromCascade ? "text-warning" : ""}
              onClick={() => { onToggleExcludeCascade?.(id); setOpenMenuId(null); }}
            />
            <IconButton 
              icon={FileX} 
              label={excludedFromExport ? "Include in Export" : "Exclude from Export"} 
              className={excludedFromExport ? "text-warning" : ""}
              onClick={() => { onToggleExcludeExport?.(id); setOpenMenuId(null); }}
            />
            <IconButton icon={Trash2} label="Delete" onClick={() => { onDelete?.(id, label); setOpenMenuId(null); }} />
          </div>,
          document.body
        )}
      </div>
      
      {isOver && canDrop && (
        <div className="mx-2 py-0.5 text-[8px] text-primary text-center bg-primary/5 rounded">
          Drop to make child of "{label}"
        </div>
      )}
      
      {hasChildren && isExpanded && (
        <div className="relative">
          <div 
            className="absolute top-0 bottom-0 w-px bg-outline-variant/50"
            style={{ left: `${paddingLeft + 10}px` }}
          />
          <DropZone 
            onDrop={onMoveBetween!} 
            targetIndex={0}
            siblingIds={item.children!.map(c => c.id || c.row_id || '')}
            isFirst
          />
          {item.children!.map((child, idx) => (
            <React.Fragment key={child.id || child.row_id}>
              <TreeItem
                item={child}
                level={level + 1}
                isExpanded={expandedFolders[child.id || child.row_id || '']}
                onToggle={onToggle}
                onMoveInto={onMoveInto}
                onMoveBetween={onMoveBetween}
                onSelect={onSelect}
                onAdd={onAdd}
                onDelete={onDelete}
                onDuplicate={onDuplicate}
                onExport={onExport}
                expandedFolders={expandedFolders}
                selectedPromptId={selectedPromptId}
                onRunPrompt={onRunPrompt}
                onRunCascade={onRunCascade}
                onToggleStar={onToggleStar}
                onToggleExcludeCascade={onToggleExcludeCascade}
                onToggleExcludeExport={onToggleExcludeExport}
                isRunningPrompt={isRunningPrompt}
                isRunningCascade={isRunningCascade}
                isMultiSelectMode={isMultiSelectMode}
                isSelected={selectedItems?.has(child.id || child.row_id || '')}
                onToggleSelect={onToggleSelect}
                lastSelectedId={lastSelectedId}
                allFlatItems={allFlatItems}
                onRangeSelect={onRangeSelect}
                selectedItems={selectedItems}
                onSelectOnlyThis={onSelectOnlyThis}
                onIconChange={onIconChange}
                onRefresh={onRefresh}
                supabase={supabase}
                currentCascadePromptId={currentCascadePromptId}
                isCascadeRunning={isCascadeRunning}
                singleRunPromptId={singleRunPromptId}
                deletingPromptIds={deletingPromptIds}
                onSaveAsTemplate={onSaveAsTemplate}
                openMenuId={openMenuId}
                setOpenMenuId={setOpenMenuId}
                isManusModelById={isManusModelById}
              />
              <DropZone 
                onDrop={onMoveBetween!}
                targetIndex={idx + 1}
                siblingIds={item.children!.map(c => c.id || c.row_id || '')}
              />
            </React.Fragment>
          ))}
        </div>
      )}
    </>
  );
};

// ============= FolderPanel Component =============

export interface FolderPanelProps {
  treeData?: PromptItem[];
  isLoading?: boolean;
  selectedPromptId?: string | null;
  onSelectPrompt?: (id: string | null) => void;
  expandedFolders?: Record<string, boolean>;
  onToggleFolder?: (id: string) => void;
  onAddPrompt?: (parentId: string | null) => void;
  onAddFromTemplate?: () => void;
  onDeletePrompt?: (id: string, name: string) => void;
  onDuplicatePrompt?: (id: string) => void;
  onExportPrompt?: (id: string) => void;
  onMovePrompt?: (draggedId: string, targetId: string) => Promise<void>;
  onRefresh?: () => void;
  onClose?: () => void;
  onToggleReadingPane?: () => void;
  readingPaneOpen?: boolean;
  onRunPrompt?: (id: string) => void;
  onRunCascade?: (id: string) => void;
  onToggleStar?: (id: string) => void;
  onToggleExcludeCascade?: (id: string) => void;
  onToggleExcludeExport?: (id: string) => void;
  isRunningPrompt?: boolean;
  isRunningCascade?: boolean;
  onBatchDelete?: (ids: string[]) => Promise<void>;
  onBatchDuplicate?: (ids: string[]) => Promise<void>;
  onBatchStar?: (ids: string[], star: boolean) => Promise<void>;
  onBatchToggleExcludeCascade?: (ids: string[], exclude: boolean) => Promise<void>;
  onBatchToggleExcludeExport?: (ids: string[], exclude: boolean) => Promise<void>;
  currentCascadePromptId?: string | null;
  isCascadeRunning?: boolean;
  singleRunPromptId?: string | null;
  deletingPromptIds?: Set<string>;
  onSaveAsTemplate?: (id: string, name: string, hasChildren: boolean) => void;
  isManusModelById?: (id: string) => boolean;
}

const FolderPanel: React.FC<FolderPanelProps> = ({ 
  treeData = [], 
  isLoading = false, 
  selectedPromptId,
  onSelectPrompt,
  expandedFolders = {},
  onToggleFolder,
  onAddPrompt,
  onAddFromTemplate,
  onDeletePrompt,
  onDuplicatePrompt,
  onExportPrompt,
  onMovePrompt,
  onRefresh,
  onClose,
  onToggleReadingPane,
  readingPaneOpen = true,
  onRunPrompt,
  onRunCascade,
  onToggleStar,
  onToggleExcludeCascade,
  onToggleExcludeExport,
  isRunningPrompt = false,
  isRunningCascade = false,
  onBatchDelete,
  onBatchDuplicate,
  onBatchStar,
  onBatchToggleExcludeCascade,
  onBatchToggleExcludeExport,
  currentCascadePromptId = null,
  isCascadeRunning = false,
  singleRunPromptId = null,
  deletingPromptIds = new Set(),
  onSaveAsTemplate,
  isManusModelById,
}) => {
  const supabase = useSupabase();
  const [activeSmartFolder, setActiveSmartFolder] = useState<SmartFolderType>("all");
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  const { scrollContainerRef, scrollContainerProps } = useDragAutoScroll({
    edgeThreshold: 60,
    scrollSpeed: 10
  });
  
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [lastSelectedId, setLastSelectedId] = useState<string | null>(null);
  const isMultiSelectMode = selectedItems.size > 0;
  
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const itemExistsInTree = useCallback((items: PromptItem[], id: string): boolean => {
    if (!items) return false;
    for (const item of items) {
      if ((item.id || item.row_id) === id) return true;
      if (item.children && itemExistsInTree(item.children, id)) return true;
    }
    return false;
  }, []);

  useEffect(() => {
    if (openMenuId && treeData && !itemExistsInTree(treeData, openMenuId)) {
      setOpenMenuId(null);
    }
  }, [treeData, openMenuId, itemExistsInTree]);

  const handleIconChange = useCallback(async (promptId: string, iconName: string | null) => {
    try {
      await updatePromptIcon(supabase, promptId, iconName);
      toast.success(iconName ? 'Icon updated' : 'Icon reset');
      onRefresh?.();
    } catch (error) {
      console.error('Error updating icon:', error);
      toast.error('Failed to update icon');
    }
  }, [supabase, onRefresh]);

  const handleAddMouseDown = useCallback(() => {
    longPressTimerRef.current = setTimeout(() => {
      setAddMenuOpen(true);
    }, 500);
  }, []);

  const handleAddMouseUp = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  const handleAddClick = useCallback(() => {
    if (!addMenuOpen) {
      onAddPrompt?.(selectedPromptId || null);
    }
  }, [addMenuOpen, onAddPrompt, selectedPromptId]);

  const handleMoveInto = async (draggedId: string, targetId: string) => {
    if (onMovePrompt) {
      await onMovePrompt(draggedId, targetId);
    }
  };

  const handleMoveBetween = useCallback(async (draggedId: string, targetIndex: number, siblingIds: string[]) => {
    if (!supabase || !onMovePrompt) return;
    
    try {
      const { generatePositionBetween, generatePositionAtEnd, generatePositionAtStart } = await import('@/utils/lexPosition');
      
      const { data: siblings } = await supabase
        .from(import.meta.env.VITE_PROMPTS_TBL)
        .select('row_id, position_lex, parent_row_id')
        .in('row_id', siblingIds)
        .order('position_lex', { ascending: true });
      
      if (!siblings?.length) return;
      
      const { data: draggedItem } = await supabase
        .from(import.meta.env.VITE_PROMPTS_TBL)
        .select('row_id, parent_row_id, prompt_name')
        .eq('row_id', draggedId)
        .maybeSingle();
      
      if (!draggedItem) return;
      
      const sortedSiblings = [...siblings].sort((a, b) => (a.position_lex || '').localeCompare(b.position_lex || ''));
      const filteredSiblings = sortedSiblings.filter(s => s.row_id !== draggedId);
      
      let newPositionLex: string;
      if (targetIndex === 0) {
        const firstKey = filteredSiblings[0]?.position_lex || null;
        newPositionLex = generatePositionAtStart(firstKey);
      } else if (targetIndex >= filteredSiblings.length) {
        const lastKey = filteredSiblings[filteredSiblings.length - 1]?.position_lex || null;
        newPositionLex = generatePositionAtEnd(lastKey);
      } else {
        const beforeKey = filteredSiblings[targetIndex - 1]?.position_lex || null;
        const afterKey = filteredSiblings[targetIndex]?.position_lex || null;
        newPositionLex = generatePositionBetween(beforeKey, afterKey);
      }
      
      const targetParentId = sortedSiblings[0]?.parent_row_id || null;
      
      const { error } = await supabase
        .from(import.meta.env.VITE_PROMPTS_TBL)
        .update({ 
          position_lex: newPositionLex,
          parent_row_id: targetParentId
        })
        .eq('row_id', draggedId);
      
      if (error) throw error;
      
      await onRefresh?.();
      toast.success(`"${draggedItem.prompt_name || 'Prompt'}" repositioned`);
    } catch (error) {
      console.error('Error repositioning item:', error);
      toast.error('Failed to reposition item');
    }
  }, [supabase, onRefresh]);

  const allFlatItems = useMemo<FlatItem[]>(() => {
    const flatten = (items: PromptItem[], acc: FlatItem[] = []): FlatItem[] => {
      items.forEach(item => {
        acc.push({ id: item.id || item.row_id || '', item });
        if (item.children) {
          flatten(item.children, acc);
        }
      });
      return acc;
    };
    return flatten(treeData);
  }, [treeData]);

  const handleToggleSelect = useCallback((id: string) => {
    setSelectedItems(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
    setLastSelectedId(id);
  }, []);

  const handleRangeSelect = useCallback((fromId: string, toId: string, flatItems: FlatItem[]) => {
    const fromIdx = flatItems.findIndex(x => x.id === fromId);
    const toIdx = flatItems.findIndex(x => x.id === toId);
    if (fromIdx === -1 || toIdx === -1) return;
    
    const start = Math.min(fromIdx, toIdx);
    const end = Math.max(fromIdx, toIdx);
    
    setSelectedItems(prev => {
      const next = new Set(prev);
      for (let i = start; i <= end; i++) {
        next.add(flatItems[i].id);
      }
      return next;
    });
    setLastSelectedId(toId);
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedItems(new Set());
    setLastSelectedId(null);
  }, []);

  const handleSelectOnlyThis = useCallback((id: string) => {
    setSelectedItems(new Set([id]));
    setLastSelectedId(id);
  }, []);

  const selectAll = useCallback(() => {
    const allIds = allFlatItems.map(item => item.id);
    setSelectedItems(new Set(allIds));
  }, [allFlatItems]);

  const handleBatchDeleteClick = useCallback(async () => {
    const ids = Array.from(selectedItems);
    if (onBatchDelete) {
      await onBatchDelete(ids);
      clearSelection();
    }
  }, [selectedItems, onBatchDelete, clearSelection]);

  const handleBatchDuplicateClick = useCallback(async () => {
    const ids = Array.from(selectedItems);
    if (onBatchDuplicate) {
      await onBatchDuplicate(ids);
      clearSelection();
    }
  }, [selectedItems, onBatchDuplicate, clearSelection]);

  const handleBatchStarClick = useCallback(async (star: boolean) => {
    const ids = Array.from(selectedItems);
    if (onBatchStar) {
      await onBatchStar(ids, star);
      clearSelection();
    }
  }, [selectedItems, onBatchStar, clearSelection]);

  const handleBatchExcludeCascadeClick = useCallback(async (exclude: boolean) => {
    const ids = Array.from(selectedItems);
    if (onBatchToggleExcludeCascade) {
      await onBatchToggleExcludeCascade(ids, exclude);
      clearSelection();
    }
  }, [selectedItems, onBatchToggleExcludeCascade, clearSelection]);

  const handleBatchExcludeExportClick = useCallback(async (exclude: boolean) => {
    const ids = Array.from(selectedItems);
    if (onBatchToggleExcludeExport) {
      await onBatchToggleExcludeExport(ids, exclude);
      clearSelection();
    }
  }, [selectedItems, onBatchToggleExcludeExport, clearSelection]);

  const counts = useMemo<SmartFolderCounts>(() => {
    const flatCount = (items: PromptItem[]): number => {
      let count = 0;
      items.forEach(item => {
        count += 1;
        if (item.children) {
          count += flatCount(item.children);
        }
      });
      return count;
    };
    
    const countStarred = (items: PromptItem[]): number => {
      let count = 0;
      items.forEach(item => {
        if (item.starred) count += 1;
        if (item.children) {
          count += countStarred(item.children);
        }
      });
      return count;
    };

    const countConversations = (items: PromptItem[]): number => {
      let count = 0;
      items.forEach(item => {
        if (item.is_assistant) count += 1;
        if (item.children) {
          count += countConversations(item.children);
        }
      });
      return count;
    };

    const getRecentItems = (items: PromptItem[], acc: PromptItem[] = []): PromptItem[] => {
      items.forEach(item => {
        acc.push(item);
        if (item.children) {
          getRecentItems(item.children, acc);
        }
      });
      return acc;
    };
    
    const allItems = getRecentItems(treeData);
    const recentCount = allItems
      .filter(item => {
        const updatedAt = new Date(item.updated_at || item.created_at || 0);
        const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        return updatedAt > dayAgo;
      })
      .length || Math.min(5, flatCount(treeData));
    
    return {
      all: flatCount(treeData),
      conversations: countConversations(treeData),
      starred: countStarred(treeData),
      recent: recentCount
    };
  }, [treeData]);

  const filteredTreeData = useMemo<PromptItem[]>(() => {
    if (activeSmartFolder === "all") {
      return treeData;
    }

    const flattenTree = (items: PromptItem[], acc: PromptItem[] = []): PromptItem[] => {
      items.forEach(item => {
        acc.push(item);
        if (item.children) {
          flattenTree(item.children, acc);
        }
      });
      return acc;
    };

    const allItems = flattenTree(treeData);
    
    let filtered: PromptItem[] = [];
    
    if (activeSmartFolder === "starred") {
      filtered = allItems.filter(item => item.starred);
    } else if (activeSmartFolder === "conversations") {
      filtered = allItems.filter(item => item.is_assistant);
    } else if (activeSmartFolder === "recent") {
      filtered = allItems
        .sort((a, b) => {
          const aDate = new Date(a.updated_at || a.created_at || 0);
          const bDate = new Date(b.updated_at || b.created_at || 0);
          return bDate.getTime() - aDate.getTime();
        })
        .slice(0, 10);
    }

    return filtered.map(item => ({ ...item, children: [] }));
  }, [treeData, activeSmartFolder]);

  const getFilterLabel = (): string | null => {
    switch (activeSmartFolder) {
      case "starred": return "Showing starred only";
      case "conversations": return "Showing conversations only";
      case "recent": return "Showing last 24 hours";
      default: return null;
    }
  };
  
  return (
    <div className="h-full flex flex-col bg-surface-container-low overflow-hidden">
      <div className="h-14 flex items-center justify-between px-3 border-b border-outline-variant shrink-0" style={{ height: "56px" }}>
        <p className="text-title-sm text-on-surface font-medium">
          Prompts
        </p>
        <div className="flex items-center gap-0.5">
          {!readingPaneOpen && onToggleReadingPane && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={onToggleReadingPane}
                  className="w-8 h-8 flex items-center justify-center rounded-m3-full text-on-surface-variant hover:bg-on-surface/[0.08]"
                >
                  <Maximize2 className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent className="text-[10px]">Show prompt panel</TooltipContent>
            </Tooltip>
          )}
          {onClose && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onClose();
                  }}
                  className="w-8 h-8 flex items-center justify-center rounded-m3-full text-on-surface-variant hover:bg-on-surface/[0.08]"
                >
                  <PanelLeftClose className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent className="text-[10px]">Hide panel</TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>

      <div className="p-1.5">
        <div className="flex items-center justify-between px-2 py-1">
          <p className="text-[9px] text-on-surface-variant uppercase tracking-wider flex items-center gap-1">
            Quick View
          </p>
          {activeSmartFolder !== "all" && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => setActiveSmartFolder("all")}
                  className="text-[9px] text-primary hover:text-primary/80 flex items-center gap-0.5 transition-colors"
                >
                  <Filter className="h-2.5 w-2.5" />
                  Clear
                </button>
              </TooltipTrigger>
              <TooltipContent className="text-[10px]">Show all prompts</TooltipContent>
            </Tooltip>
          )}
        </div>
        <div className="flex flex-col gap-0.5">
          <SmartFolder 
            icon={Inbox} 
            label="All Prompts" 
            count={counts.all} 
            isActive={activeSmartFolder === "all"}
            onClick={() => setActiveSmartFolder("all")}
          />
          <SmartFolder 
            icon={Star} 
            label="Starred" 
            count={counts.starred}
            isActive={activeSmartFolder === "starred"}
            onClick={() => setActiveSmartFolder("starred")}
          />
          <SmartFolder 
            icon={Clock} 
            label="Recent" 
            count={counts.recent}
            isActive={activeSmartFolder === "recent"}
            onClick={() => setActiveSmartFolder("recent")}
            badge="24h"
          />
        </div>
      </div>

      <div className="mx-2 h-px bg-outline-variant" />

      <div 
        ref={scrollContainerRef}
        className="flex-1 overflow-x-auto overflow-y-auto p-1.5 scrollbar-thin"
        {...scrollContainerProps}
      >
        <div className="flex items-center justify-between px-2 py-1">
          <div className="flex items-center gap-1.5">
            <p className="text-[9px] text-on-surface-variant uppercase tracking-wider">
              {activeSmartFolder === "all" ? "Prompts" : 
               activeSmartFolder === "starred" ? "Starred" :
               "Recent"}
            </p>
            {activeSmartFolder !== "all" && (
              <motion.span 
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="text-[8px] px-1.5 py-0.5 rounded-full bg-primary/15 text-primary font-medium"
              >
                {filteredTreeData.length} items
              </motion.span>
            )}
          </div>
          <div className="flex items-center gap-0.5">
            {onRefresh && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button 
                    onClick={onRefresh}
                    className="w-5 h-5 flex items-center justify-center rounded-sm text-on-surface-variant hover:bg-on-surface/[0.12] hover:text-on-surface transition-colors"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent className="text-[10px]">Refresh</TooltipContent>
              </Tooltip>
            )}
            <Popover open={addMenuOpen} onOpenChange={setAddMenuOpen}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <PopoverTrigger asChild>
                    <button 
                      onClick={handleAddClick}
                      onMouseDown={handleAddMouseDown}
                      onMouseUp={handleAddMouseUp}
                      onMouseLeave={handleAddMouseUp}
                      onTouchStart={handleAddMouseDown}
                      onTouchEnd={handleAddMouseUp}
                      className="w-5 h-5 flex items-center justify-center rounded-sm text-on-surface-variant hover:bg-on-surface/[0.12] hover:text-on-surface transition-colors"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </PopoverTrigger>
                </TooltipTrigger>
                <TooltipContent className="text-[10px]">Click to add • Hold for options</TooltipContent>
              </Tooltip>
              <PopoverContent 
                align="start" 
                sideOffset={4}
                className="w-44 p-1 bg-surface-container border-outline-variant"
              >
                <button
                  onClick={() => {
                    setAddMenuOpen(false);
                    onAddPrompt?.(selectedPromptId || null);
                  }}
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded-m3-sm text-body-sm text-on-surface hover:bg-on-surface/[0.08] transition-colors"
                >
                  <Plus className="h-4 w-4 text-on-surface-variant" />
                  New Prompt
                </button>
                <button
                  onClick={() => {
                    setAddMenuOpen(false);
                    onAddFromTemplate?.();
                  }}
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded-m3-sm text-body-sm text-on-surface hover:bg-on-surface/[0.08] transition-colors"
                >
                  <LayoutTemplate className="h-4 w-4 text-on-surface-variant" />
                  From Template
                </button>
              </PopoverContent>
            </Popover>
          </div>
        </div>
        
        <AnimatePresence>
          {getFilterLabel() && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="mx-1 mb-1.5 px-2 py-1 rounded-m3-sm bg-primary/10 border border-primary/20 flex items-center justify-between">
                <span className="text-[10px] text-primary flex items-center gap-1">
                  <Filter className="h-3 w-3" />
                  {getFilterLabel()}
                </span>
                <button
                  onClick={() => setActiveSmartFolder("all")}
                  className="text-[9px] text-primary/70 hover:text-primary underline"
                >
                  Show all
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        
        <div className="flex flex-col min-w-max">
          {isLoading && (
            <>
              <SkeletonListItem />
              <SkeletonListItem />
              <SkeletonListItem />
              <SkeletonListItem />
              <SkeletonListItem />
            </>
          )}
          
          {!isLoading && filteredTreeData.length === 0 && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="px-3 py-8 text-center"
            >
              {activeSmartFolder === "all" ? (
                <>
                  <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-surface-container flex items-center justify-center">
                    <FileText className="h-6 w-6 text-on-surface-variant/50" />
                  </div>
                  <p className="text-body-sm text-on-surface mb-1">No prompts yet</p>
                  <p className="text-[10px] text-on-surface-variant mb-3">
                    Create your first prompt to get started
                  </p>
                  <motion.button 
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => onAddPrompt?.(null)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-tree text-on-primary bg-primary hover:bg-primary/90 rounded-m3-sm transition-colors shadow-sm"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Create Prompt
                  </motion.button>
                </>
              ) : activeSmartFolder === "starred" ? (
                <>
                  <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-amber-500/10 flex items-center justify-center">
                    <Star className="h-6 w-6 text-amber-500/50" />
                  </div>
                  <p className="text-body-sm text-on-surface mb-1">No starred prompts</p>
                  <p className="text-[10px] text-on-surface-variant">
                    Star your favorite prompts for quick access
                  </p>
                </>
              ) : activeSmartFolder === "conversations" ? (
                <>
                  <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-primary/10 flex items-center justify-center">
                    <MessageSquare className="h-6 w-6 text-primary/50" />
                  </div>
                  <p className="text-body-sm text-on-surface mb-1">No conversations</p>
                  <p className="text-[10px] text-on-surface-variant">
                    Enable conversation mode on a prompt to start chatting
                  </p>
                </>
              ) : (
                <>
                  <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-surface-container flex items-center justify-center">
                    <Clock className="h-6 w-6 text-on-surface-variant/50" />
                  </div>
                  <p className="text-body-sm text-on-surface mb-1">No recent activity</p>
                  <p className="text-[10px] text-on-surface-variant">
                    Prompts edited in the last 24 hours will appear here
                  </p>
                </>
              )}
            </motion.div>
          )}
          
          {!isLoading && filteredTreeData.length > 0 && (
            <>
              <DropZone 
                onDrop={handleMoveBetween} 
                targetIndex={0}
                siblingIds={filteredTreeData.map(item => item.id || item.row_id || '')}
                isFirst 
              />
              {filteredTreeData.map((item, idx) => (
                <React.Fragment key={item.id || item.row_id}>
                  <TreeItem
                    item={item}
                    level={0}
                    isExpanded={expandedFolders[item.id || item.row_id || '']}
                    onToggle={onToggleFolder}
                    onMoveInto={handleMoveInto}
                    onMoveBetween={handleMoveBetween}
                    onSelect={onSelectPrompt}
                    onAdd={onAddPrompt}
                    onDelete={onDeletePrompt}
                    onDuplicate={onDuplicatePrompt}
                    onExport={onExportPrompt}
                    expandedFolders={expandedFolders}
                    selectedPromptId={selectedPromptId}
                    onRunPrompt={onRunPrompt}
                    onRunCascade={onRunCascade}
                    onToggleStar={onToggleStar}
                    onToggleExcludeCascade={onToggleExcludeCascade}
                    onToggleExcludeExport={onToggleExcludeExport}
                    isRunningPrompt={isRunningPrompt}
                    isRunningCascade={isRunningCascade}
                    isMultiSelectMode={isMultiSelectMode}
                    isSelected={selectedItems.has(item.id || item.row_id || '')}
                    onToggleSelect={handleToggleSelect}
                    lastSelectedId={lastSelectedId}
                    allFlatItems={allFlatItems}
                    onRangeSelect={handleRangeSelect}
                    selectedItems={selectedItems}
                    onSelectOnlyThis={handleSelectOnlyThis}
                    onIconChange={handleIconChange}
                    onRefresh={onRefresh}
                    supabase={supabase}
                    currentCascadePromptId={currentCascadePromptId}
                    isCascadeRunning={isCascadeRunning}
                    singleRunPromptId={singleRunPromptId}
                    deletingPromptIds={deletingPromptIds}
                    onSaveAsTemplate={onSaveAsTemplate}
                    openMenuId={openMenuId}
                    setOpenMenuId={setOpenMenuId}
                    isManusModelById={isManusModelById}
                  />
                  <DropZone 
                    onDrop={handleMoveBetween}
                    targetIndex={idx + 1}
                    siblingIds={filteredTreeData.map(i => i.id || i.row_id || '')}
                  />
                </React.Fragment>
              ))}
            </>
          )}
        </div>
      </div>
      
      <AnimatePresence>
        {isMultiSelectMode && (
          <motion.div
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 50, opacity: 0 }}
            className="absolute bottom-2 left-2 right-2 bg-surface-container-high border border-outline-variant rounded-m3-md shadow-lg p-2"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-on-surface-variant font-medium px-1">
                  {selectedItems.size} selected
                </span>
                <button
                  onClick={selectAll}
                  className="text-[9px] text-primary hover:underline px-1"
                >
                  Select all
                </button>
              </div>
              <div className="flex items-center gap-0.5">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button onClick={() => handleBatchStarClick(true)} className="w-6 h-6 flex items-center justify-center rounded-m3-full hover:bg-surface-container">
                      <Star className="h-3.5 w-3.5 text-on-surface-variant" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent className="text-[10px]">Star selected</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button onClick={handleBatchDuplicateClick} className="w-6 h-6 flex items-center justify-center rounded-m3-full hover:bg-surface-container">
                      <Copy className="h-3.5 w-3.5 text-on-surface-variant" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent className="text-[10px]">Duplicate selected</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button onClick={() => handleBatchExcludeCascadeClick(true)} className="w-6 h-6 flex items-center justify-center rounded-m3-full hover:bg-surface-container">
                      <Ban className="h-3.5 w-3.5 text-on-surface-variant" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent className="text-[10px]">Exclude from cascade</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button onClick={() => handleBatchExcludeExportClick(true)} className="w-6 h-6 flex items-center justify-center rounded-m3-full hover:bg-surface-container">
                      <FileX className="h-3.5 w-3.5 text-on-surface-variant" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent className="text-[10px]">Exclude from export</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button onClick={handleBatchDeleteClick} className="w-6 h-6 flex items-center justify-center rounded-m3-full hover:bg-surface-container">
                      <Trash2 className="h-3.5 w-3.5 text-red-500" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent className="text-[10px]">Delete selected</TooltipContent>
                </Tooltip>
                <div className="w-px h-4 bg-outline-variant mx-1" />
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button onClick={clearSelection} className="w-6 h-6 flex items-center justify-center rounded-m3-full hover:bg-surface-container">
                      <X className="h-3.5 w-3.5 text-on-surface-variant" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent className="text-[10px]">Clear selection</TooltipContent>
                </Tooltip>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default FolderPanel;
