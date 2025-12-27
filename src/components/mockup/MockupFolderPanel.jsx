import React, { useState, useRef, useMemo } from "react";
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
  Sparkles,
  Link2,
  Upload,
  GripVertical,
  Workflow,
  RefreshCw,
  Loader2
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useDrag, useDrop } from "react-dnd";
import { SkeletonListItem } from "./shared/MockupSkeletons";
import { toast } from "@/components/ui/sonner";

const ITEM_TYPE = "PROMPT_ITEM";

const SmartFolder = ({ icon: Icon, label, count, isActive = false, onClick }) => (
  <button
    onClick={onClick}
    className={`
      w-full h-7 flex items-center gap-2 px-2.5 rounded-m3-sm
      transition-all duration-200 ease-emphasized group
      ${isActive 
        ? "bg-secondary-container text-secondary-container-foreground" 
        : "text-on-surface-variant hover:bg-on-surface/[0.08] hover:translate-x-0.5"
      }
    `}
    style={{ height: "28px" }}
  >
    <Icon className={`h-4 w-4 flex-shrink-0 transition-transform duration-200 ${isActive ? '' : 'group-hover:scale-110'}`} />
    <span className="flex-1 text-left text-[11px] truncate">{label}</span>
    <span className={`text-[10px] px-1.5 py-0.5 rounded-full transition-colors ${
      isActive ? 'bg-secondary-container-foreground/10' : 'bg-on-surface/[0.05]'
    }`}>{count}</span>
  </button>
);

const IconButton = ({ icon: Icon, label, className = "", onClick }) => (
  <Tooltip>
    <TooltipTrigger asChild>
      <button
        onClick={(e) => { e.stopPropagation(); onClick?.(); }}
        className={`w-5 h-5 flex items-center justify-center rounded-sm text-on-surface-variant hover:bg-on-surface/[0.12] hover:scale-110 transition-all duration-150 ${className}`}
      >
        <Icon className="h-3 w-3" />
      </button>
    </TooltipTrigger>
    <TooltipContent className="text-[10px]">{label}</TooltipContent>
  </Tooltip>
);

const OwnerAvatar = ({ initials, color }) => (
  <div 
    className={`w-4 h-4 rounded-full flex items-center justify-center text-[7px] font-medium ${color}`}
    style={{ width: "16px", height: "16px" }}
  >
    {initials}
  </div>
);

// Drop zone between items for inserting
const DropZone = ({ onDrop, isFirst = false }) => {
  const [{ isOver, canDrop }, drop] = useDrop({
    accept: ITEM_TYPE,
    drop: (item) => {
      onDrop(item.id, 'between');
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
      canDrop: monitor.canDrop(),
    }),
  });

  return (
    <div
      ref={drop}
      className={`
        h-0.5 mx-2 rounded-full transition-all duration-150
        ${isOver && canDrop ? 'h-0.5 bg-primary' : 'bg-transparent'}
        ${canDrop && !isOver ? 'hover:bg-primary/30' : ''}
      `}
      style={{ 
        marginTop: isFirst ? 0 : '-1px',
        marginBottom: '-1px'
      }}
    />
  );
};

const TreeItem = ({ 
  item,
  level = 0, 
  isExpanded = false, 
  onToggle, 
  isActive = false,
  onMoveInto,
  onMoveBetween,
  onSelect,
  onAdd,
  onDelete,
  onDuplicate,
  expandedFolders,
  selectedPromptId,
  // Phase 1 handlers
  onRunPrompt,
  onRunCascade,
  onToggleStar,
  onToggleExcludeCascade,
  onToggleExcludeExport,
  isRunningPrompt,
  isRunningCascade
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const ref = useRef(null);
  const visualLevel = Math.min(level, 4);
  const paddingLeft = 10 + visualLevel * 12;
  const depthIndicator = level > 4 ? `${level}` : null;
  
  const hasChildren = item.children && item.children.length > 0;
  const starred = item.starred || false;
  const excludedFromCascade = item.exclude_from_cascade || false;
  const excludedFromExport = item.exclude_from_export || false;
  const isConversation = item.is_assistant || false;
  const label = item.name || item.prompt_name || 'Untitled';
  const id = item.id || item.row_id;

  const [{ isDragging }, drag, preview] = useDrag({
    type: ITEM_TYPE,
    item: { id, level },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });

  // Drop on item to make it a child
  const [{ isOver, canDrop }, drop] = useDrop({
    accept: ITEM_TYPE,
    canDrop: (dragItem) => dragItem.id !== id,
    drop: (dragItem, monitor) => {
      if (!monitor.didDrop() && dragItem.id !== id && onMoveInto) {
        onMoveInto(dragItem.id, id);
      }
    },
    collect: (monitor) => ({
      isOver: monitor.isOver({ shallow: true }),
      canDrop: monitor.canDrop(),
    }),
  });

  drag(drop(ref));
  
  const Icon = isConversation ? MessageSquare : FileText;
  const itemIsActive = selectedPromptId === id;
  
  // Handle toggle click
  const handleToggleClick = (e) => {
    e.stopPropagation();
    onToggle?.(id);
  };
  
  // Handle row click - if has children, toggle; otherwise select
  const handleRowClick = () => {
    if (hasChildren) {
      onToggle?.(id);
    }
    onSelect?.(id);
  };
  
  return (
    <>
      <div
        ref={ref}
        onClick={handleRowClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={`
          w-full h-7 flex items-center gap-1.5 pr-1.5 rounded-m3-sm cursor-pointer
          transition-all duration-200 ease-emphasized group
          ${itemIsActive 
            ? "bg-secondary-container text-secondary-container-foreground" 
            : "text-on-surface-variant hover:bg-on-surface/[0.08]"
          }
          ${isDragging ? "opacity-50 scale-95" : "hover:translate-x-0.5"}
          ${isOver && canDrop ? "ring-1 ring-primary bg-primary/10" : ""}
        `}
        style={{ height: "28px", paddingLeft: `${paddingLeft}px` }}
      >
        {/* Drag handle - only on hover */}
        <GripVertical className={`h-2.5 w-2.5 flex-shrink-0 cursor-grab transition-opacity ${isHovered ? 'text-on-surface-variant/60' : 'text-transparent'}`} />
        
        {depthIndicator && (
          <span className="text-[7px] text-on-surface-variant/50 w-2.5 flex-shrink-0">{depthIndicator}</span>
        )}
        
        {/* Expand/collapse chevron - always show for items with children */}
        {hasChildren ? (
          <button 
            onClick={handleToggleClick}
            className="w-5 h-5 flex items-center justify-center rounded-sm hover:bg-on-surface/[0.12] transition-all flex-shrink-0"
          >
            {isExpanded 
              ? <ChevronDown className="h-3.5 w-3.5" />
              : <ChevronRight className="h-3.5 w-3.5" />
            }
          </button>
        ) : (
          <span className="w-5 flex-shrink-0" />
        )}
        
        <Icon className="h-3.5 w-3.5 flex-shrink-0" />
        <span className="flex-1 text-left text-[11px] truncate font-medium">{label}</span>
        
        {/* Child count badge when collapsed */}
        {hasChildren && !isExpanded && (
          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-on-surface/[0.08] text-on-surface-variant">
            {item.children.length}
          </span>
        )}
        
        {/* Hover actions or status icons */}
        {isHovered ? (
          <div className="flex items-center gap-0.5">
            <IconButton 
              icon={Star} 
              label={starred ? "Unstar" : "Star"} 
              className={starred ? "text-amber-500" : ""} 
              onClick={() => onToggleStar?.(id)}
            />
            <IconButton 
              icon={isRunningPrompt ? Loader2 : Sparkles} 
              label="Run" 
              onClick={() => onRunPrompt?.(id)}
              className={isRunningPrompt ? "animate-spin" : ""}
            />
            {hasChildren && (
              <IconButton 
                icon={isRunningCascade ? Loader2 : Workflow} 
                label="Run Cascade" 
                onClick={() => onRunCascade?.(id)}
                className={isRunningCascade ? "animate-spin" : ""}
              />
            )}
            <IconButton icon={Link2} label="Copy Variable Reference" onClick={() => {
              navigator.clipboard.writeText(`{{q.ref[${id}]}}`);
              toast.success('Copied variable reference');
            }} />
            <IconButton icon={Plus} label="Add Child" onClick={() => onAdd?.(id)} />
            <IconButton icon={Copy} label="Duplicate" onClick={() => onDuplicate?.(id)} />
            <IconButton icon={Upload} label="Export" />
            <IconButton 
              icon={Ban} 
              label={excludedFromCascade ? "Include in Cascade" : "Exclude from Cascade"} 
              className={excludedFromCascade ? "text-warning" : ""}
              onClick={() => onToggleExcludeCascade?.(id)}
            />
            <IconButton 
              icon={FileX} 
              label={excludedFromExport ? "Include in Export" : "Exclude from Export"} 
              className={excludedFromExport ? "text-warning" : ""}
              onClick={() => onToggleExcludeExport?.(id)}
            />
            <IconButton icon={Trash2} label="Delete" onClick={() => onDelete?.(id)} />
          </div>
        ) : (
          <div className="flex items-center gap-0.5">
            {starred && <Star className="h-2.5 w-2.5 text-amber-500 fill-amber-500" />}
            {excludedFromCascade && <Ban className="h-2.5 w-2.5 text-warning" />}
            {excludedFromExport && <FileX className="h-2.5 w-2.5 text-warning" />}
          </div>
        )}
      </div>
      
      {/* Drop indicator when hovering - shows "drop to make child" hint */}
      {isOver && canDrop && (
        <div className="mx-2 py-0.5 text-[8px] text-primary text-center bg-primary/5 rounded">
          Drop to make child of "{label}"
        </div>
      )}
      
      {/* Render children recursively - with indentation line */}
      {hasChildren && isExpanded && (
        <div className="relative">
          {/* Vertical indent line */}
          <div 
            className="absolute top-0 bottom-0 w-px bg-outline-variant/50"
            style={{ left: `${paddingLeft + 10}px` }}
          />
          {item.children.map((child, idx) => (
            <React.Fragment key={child.id || child.row_id}>
              <TreeItem
                item={child}
                level={level + 1}
                isExpanded={expandedFolders[child.id || child.row_id]}
                onToggle={onToggle}
                onMoveInto={onMoveInto}
                onMoveBetween={onMoveBetween}
                onSelect={onSelect}
                onAdd={onAdd}
                onDelete={onDelete}
                onDuplicate={onDuplicate}
                expandedFolders={expandedFolders}
                selectedPromptId={selectedPromptId}
                onRunPrompt={onRunPrompt}
                onRunCascade={onRunCascade}
                onToggleStar={onToggleStar}
                onToggleExcludeCascade={onToggleExcludeCascade}
                onToggleExcludeExport={onToggleExcludeExport}
                isRunningPrompt={isRunningPrompt}
                isRunningCascade={isRunningCascade}
              />
              <DropZone onDrop={onMoveBetween} />
            </React.Fragment>
          ))}
        </div>
      )}
    </>
  );
};

const MockupFolderPanel = ({ 
  treeData = [], 
  isLoading = false, 
  selectedPromptId, 
  onSelectPrompt,
  onAddPrompt,
  onDeletePrompt,
  onDuplicatePrompt,
  onMovePrompt,
  onRefresh,
  // Phase 1 handlers
  onRunPrompt,
  onRunCascade,
  onToggleStar,
  onToggleExcludeCascade,
  onToggleExcludeExport,
  isRunningPrompt = false,
  isRunningCascade = false
}) => {
  const [expandedFolders, setExpandedFolders] = useState({});
  const [activeSmartFolder, setActiveSmartFolder] = useState("all");

  const toggleFolder = (id) => {
    setExpandedFolders(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleMoveInto = async (draggedId, targetId) => {
    if (onMovePrompt) {
      await onMovePrompt(draggedId, targetId);
    }
  };

  const handleMoveBetween = (draggedId, position) => {
    // For now, just log - full implementation would calculate new position
    console.log(`Insert ${draggedId} at position`);
  };

  // Calculate smart folder counts
  const counts = useMemo(() => {
    const flatCount = (items) => {
      let count = 0;
      items.forEach(item => {
        count += 1;
        if (item.children) {
          count += flatCount(item.children);
        }
      });
      return count;
    };
    
    const countWithConversations = (items) => {
      let count = 0;
      items.forEach(item => {
        if (item.is_assistant) count += 1;
        if (item.children) {
          count += countWithConversations(item.children);
        }
      });
      return count;
    };
    
    const countStarred = (items) => {
      let count = 0;
      items.forEach(item => {
        if (item.starred) count += 1;
        if (item.children) {
          count += countStarred(item.children);
        }
      });
      return count;
    };

    const getRecentItems = (items, acc = []) => {
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
        const updatedAt = new Date(item.updated_at || item.created_at);
        const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        return updatedAt > dayAgo;
      })
      .length || Math.min(5, flatCount(treeData));
    
    return {
      all: flatCount(treeData),
      conversations: countWithConversations(treeData),
      starred: countStarred(treeData),
      recent: recentCount
    };
  }, [treeData]);

  // Filter tree data based on smart folder selection
  const filteredTreeData = useMemo(() => {
    if (activeSmartFolder === "all") {
      return treeData;
    }

    // Helper to flatten tree and then rebuild filtered
    const flattenTree = (items, acc = []) => {
      items.forEach(item => {
        acc.push(item);
        if (item.children) {
          flattenTree(item.children, acc);
        }
      });
      return acc;
    };

    const allItems = flattenTree(treeData);
    
    let filtered = [];
    
    if (activeSmartFolder === "starred") {
      filtered = allItems.filter(item => item.starred);
    } else if (activeSmartFolder === "conversations") {
      filtered = allItems.filter(item => item.is_assistant);
    } else if (activeSmartFolder === "recent") {
      filtered = allItems
        .sort((a, b) => {
          const aDate = new Date(a.updated_at || a.created_at);
          const bDate = new Date(b.updated_at || b.created_at);
          return bDate - aDate;
        })
        .slice(0, 10);
    }

    // Return as flat list for filtered views (no hierarchy)
    return filtered.map(item => ({ ...item, children: [] }));
  }, [treeData, activeSmartFolder]);

  return (
    <div className="h-full flex flex-col bg-surface-container-low overflow-hidden">
      {/* Smart Folders */}
      <div className="p-1.5">
        <p className="px-2 py-1 text-[9px] text-on-surface-variant uppercase tracking-wider">
          Smart Folders
        </p>
        <div className="flex flex-col gap-0.5">
          <SmartFolder 
            icon={Inbox} 
            label="All Prompts" 
            count={counts.all} 
            isActive={activeSmartFolder === "all"}
            onClick={() => setActiveSmartFolder("all")}
          />
          <SmartFolder 
            icon={MessageSquare} 
            label="Conversations" 
            count={counts.conversations}
            isActive={activeSmartFolder === "conversations"}
            onClick={() => setActiveSmartFolder("conversations")}
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
          />
        </div>
      </div>

      {/* Divider */}
      <div className="mx-2 h-px bg-outline-variant" />

      {/* Prompts Tree */}
      <div className="flex-1 overflow-auto p-1.5 scrollbar-thin">
        <div className="flex items-center justify-between px-2 py-1">
          <p className="text-[9px] text-on-surface-variant uppercase tracking-wider">
            Prompts
          </p>
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
            <Tooltip>
              <TooltipTrigger asChild>
                <button 
                  onClick={() => onAddPrompt?.(null)}
                  className="w-5 h-5 flex items-center justify-center rounded-sm text-on-surface-variant hover:bg-on-surface/[0.12] hover:text-on-surface transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent className="text-[10px]">Create new prompt</TooltipContent>
            </Tooltip>
          </div>
        </div>
        
        <div className="flex flex-col">
          {/* Loading state */}
          {isLoading && (
            <>
              <SkeletonListItem />
              <SkeletonListItem />
              <SkeletonListItem />
              <SkeletonListItem />
              <SkeletonListItem />
            </>
          )}
          
          {/* Empty state */}
          {!isLoading && filteredTreeData.length === 0 && (
            <div className="px-2 py-8 text-center">
              <FileText className="h-8 w-8 mx-auto mb-2 text-on-surface-variant/40" />
              <p className="text-[11px] text-on-surface-variant">
                {activeSmartFolder === "all" ? "No prompts yet" : 
                 activeSmartFolder === "starred" ? "No starred prompts" :
                 activeSmartFolder === "conversations" ? "No conversations" :
                 "No recent prompts"}
              </p>
              {activeSmartFolder === "all" && (
                <button 
                  onClick={() => onAddPrompt?.(null)}
                  className="mt-2 px-3 py-1 text-[10px] text-primary hover:bg-primary/10 rounded-m3-sm transition-colors"
                >
                  Create your first prompt
                </button>
              )}
            </div>
          )}
          
          {/* Real tree data - filtered */}
          {!isLoading && filteredTreeData.length > 0 && (
            <>
              <DropZone onDrop={handleMoveBetween} isFirst />
              {filteredTreeData.map((item, idx) => (
                <React.Fragment key={item.id || item.row_id}>
                  <TreeItem
                    item={item}
                    level={0}
                    isExpanded={expandedFolders[item.id || item.row_id]}
                    onToggle={toggleFolder}
                    onMoveInto={handleMoveInto}
                    onMoveBetween={handleMoveBetween}
                    onSelect={onSelectPrompt}
                    onAdd={onAddPrompt}
                    onDelete={onDeletePrompt}
                    onDuplicate={onDuplicatePrompt}
                    expandedFolders={expandedFolders}
                    selectedPromptId={selectedPromptId}
                    onRunPrompt={onRunPrompt}
                    onRunCascade={onRunCascade}
                    onToggleStar={onToggleStar}
                    onToggleExcludeCascade={onToggleExcludeCascade}
                    onToggleExcludeExport={onToggleExcludeExport}
                    isRunningPrompt={isRunningPrompt}
                    isRunningCascade={isRunningCascade}
                  />
                  <DropZone onDrop={handleMoveBetween} />
                </React.Fragment>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default MockupFolderPanel;