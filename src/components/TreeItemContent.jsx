import React from 'react';
import { FileText, ChevronRight, ChevronDown, Bot, User } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { TreeItemActions } from './TreeItemActions';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export const TreeItemContent = ({
  item,
  level,
  isExpanded,
  isActive,
  toggleItem,
  setActiveItem,
  editingItem,
  setEditingItem,
  finishRenaming,
  cancelRenaming,
  startRenaming,
  isHovered,
  setIsHovered,
  addItem,
  deleteItem,
  duplicateItem,
  siblings,
  onRefreshTreeData,
  searchQuery
}) => {
  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      finishRenaming();
    } else if (e.key === 'Escape') {
      cancelRenaming();
    }
  };

  const handleToggle = (e) => {
    e.stopPropagation();
    toggleItem(item.id);
  };

  const displayName = item.prompt_name && item.prompt_name.trim() !== '' ? item.prompt_name : 'New Prompt';
  const hasChildren = item.children && item.children.length > 0;
  const childCount = item.children?.length || 0;

  // Highlight search matches
  const highlightMatch = (text) => {
    if (!searchQuery || !text) return text;
    const regex = new RegExp(`(${searchQuery})`, 'gi');
    const parts = text.split(regex);
    return parts.map((part, i) => 
      regex.test(part) ? (
        <mark key={i} className="bg-primary/20 text-primary rounded px-0.5">
          {part}
        </mark>
      ) : part
    );
  };

  return (
    <div
      className={`
        group flex items-center
        py-1.5 px-2 rounded-md
        transition-all duration-150 cursor-pointer
        ${isActive 
          ? 'bg-primary/10 border border-primary/30 shadow-sm' 
          : 'hover:bg-muted/60 border border-transparent'
        }
      `}
      style={{ paddingLeft: `${level * 14 + 4}px` }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={() => setActiveItem(item.id)}
    >
      <div className="flex items-center gap-1.5 min-w-0">
        {/* Expand/Collapse Button */}
        {hasChildren ? (
          <Button
            variant="ghost"
            size="sm"
            className="p-0 h-5 w-5 flex-shrink-0 hover:bg-muted"
            onClick={handleToggle}
          >
            {isExpanded ? (
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
            )}
          </Button>
        ) : (
          <div className="w-5 h-5 flex-shrink-0" />
        )}

        {/* Type Icon */}
        {item.is_assistant ? (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className={`
                  flex items-center justify-center w-5 h-5 rounded flex-shrink-0
                  ${item.assistantStatus === 'active' 
                    ? 'bg-primary/15 text-primary' 
                    : 'bg-muted text-muted-foreground'
                  }
                `}>
                  <Bot className="h-3.5 w-3.5" />
                </div>
              </TooltipTrigger>
              <TooltipContent side="right" className="text-xs">
                Assistant {item.assistantStatus === 'active' ? '• Active' : '• Not Instantiated'}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ) : (
          <div className="flex items-center justify-center w-5 h-5 rounded flex-shrink-0 text-muted-foreground">
            <FileText className="h-3.5 w-3.5" />
          </div>
        )}

        {/* Name */}
        {editingItem && editingItem.id === item.id ? (
          <Input
            value={editingItem.name}
            onChange={(e) => setEditingItem({ ...editingItem, name: e.target.value })}
            onKeyDown={handleKeyDown}
            onBlur={cancelRenaming}
            onClick={(e) => e.stopPropagation()}
            className="h-6 py-0.5 px-1.5 text-sm flex-1 min-w-0 focus:ring-primary"
            autoFocus
          />
        ) : (
          <span 
            className={`
              truncate text-sm font-medium
              ${isActive ? 'text-primary' : 'text-foreground'}
            `}
            onDoubleClick={() => startRenaming(item.id, item.prompt_name)}
            title={displayName}
          >
            {highlightMatch(displayName)}
          </span>
        )}

        {/* Owner badge for top-level items owned by others */}
        {item.showOwner && item.ownerDisplay && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge 
                  variant="outline" 
                  className="ml-1 h-4 px-1.5 text-[10px] font-medium border-muted-foreground/30 text-muted-foreground gap-0.5"
                >
                  <User className="h-2.5 w-2.5" />
                  {item.ownerDisplay}
                </Badge>
              </TooltipTrigger>
              <TooltipContent side="right" className="text-xs">
                Owned by {item.ownerDisplay}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}

        {/* Child count badge */}
        {hasChildren && !isExpanded && (
          <Badge 
            variant="secondary" 
            className="ml-1 h-4 px-1.5 text-[10px] font-medium bg-muted text-muted-foreground"
          >
            {childCount}
          </Badge>
        )}
      </div>

      {/* Actions - only show on hover, immediately after content */}
      <div className={`
        flex-shrink-0 ml-2 transition-opacity duration-150
        ${isHovered ? 'opacity-100' : 'opacity-0'}
      `}>
        <TreeItemActions
          item={item}
          addItem={addItem}
          deleteItem={deleteItem}
          duplicateItem={duplicateItem}
          startRenaming={startRenaming}
          siblings={siblings}
          onRefreshTreeData={onRefreshTreeData}
        />
      </div>
    </div>
  );
};
