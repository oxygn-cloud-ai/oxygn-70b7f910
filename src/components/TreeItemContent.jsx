import React from 'react';
import { FileText, ChevronRight, ChevronDown, Bot } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { TreeItemActions } from './TreeItemActions';
import { OwnerChangeContent } from './OwnerChangePopover';
import { useAuth } from '../contexts/AuthContext';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { TOOLTIPS } from '@/config/labels';

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
  searchQuery,
  isDeleting
}) => {
  const { user, isAdmin } = useAuth();
  const isOwner = user?.id === item.owner_id;
  const canChangeOwner = isAdmin || isOwner;
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

  // For active state, use opaque background to prevent text bleed-through
  const getActiveGradientClass = () => {
    if (isActive && !isDeleting) {
      return 'bg-gradient-to-r from-transparent to-[hsl(var(--tree-active-bg))]';
    }
    return 'bg-gradient-to-r from-transparent to-background';
  };

  const getActiveBgClass = () => {
    if (isActive && !isDeleting) {
      return 'bg-[hsl(var(--tree-active-bg))]';
    }
    return 'bg-background';
  };

  return (
    <div
      className={`
        group relative flex items-center
        py-1.5 px-2 rounded-md
        transition-all duration-150
        ${isDeleting ? 'pointer-events-none opacity-60' : 'cursor-pointer'}
        ${isActive && !isDeleting
          ? 'bg-primary/10 border border-primary/30 shadow-sm' 
          : 'hover:bg-muted/60 border border-transparent'
        }
      `}
      style={{ paddingLeft: `${level * 14 + 4}px` }}
      onMouseEnter={() => !isDeleting && setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={() => !isDeleting && setActiveItem(item.id)}
    >
      {/* Main content - truncates when needed */}
      <div className="flex items-center gap-1.5 flex-1 min-w-0 overflow-hidden">
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
                {item.assistantStatus === 'active' ? TOOLTIPS.prompts.assistant.active : TOOLTIPS.prompts.assistant.notInstantiated}
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
              truncate text-sm font-medium flex-1 min-w-0
              ${isDeleting 
                ? 'text-muted-foreground/50' 
                : isActive 
                  ? 'text-primary' 
                  : 'text-foreground'
              }
            `}
            onDoubleClick={() => !isDeleting && startRenaming(item.id, item.prompt_name)}
            title={isDeleting ? 'Deleting...' : displayName}
          >
            {isDeleting ? 'Deleting...' : highlightMatch(displayName)}
          </span>
        )}

        {/* Owner badge with avatar for all top-level items */}
        {item.showOwner && item.ownerDisplay && (
          canChangeOwner ? (
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="ml-1 inline-flex items-center gap-1 h-5 px-1.5 text-[10px] font-medium rounded-sm border border-muted-foreground/30 text-muted-foreground cursor-pointer hover:border-primary/50 hover:text-primary transition-colors bg-transparent flex-shrink-0"
                  onClick={(e) => e.stopPropagation()}
                  title="Click to change owner"
                >
                  <Avatar className="h-3.5 w-3.5">
                    <AvatarImage src={item.ownerAvatar} alt={item.ownerDisplay} />
                    <AvatarFallback className="text-[8px]">
                      {item.ownerDisplay?.[0]?.toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  {item.ownerDisplay}
                </button>
              </PopoverTrigger>
              <PopoverContent 
                className="w-80 p-3 bg-popover" 
                onClick={(e) => e.stopPropagation()}
                align="start"
              >
                <OwnerChangeContent
                  promptRowId={item.id}
                  currentOwnerId={item.owner_id}
                  isPrivate={item.is_private}
                  onOwnerChanged={onRefreshTreeData}
                />
              </PopoverContent>
            </Popover>
          ) : (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge 
                    variant="outline" 
                    className="ml-1 h-5 px-1.5 text-[10px] font-medium border-muted-foreground/30 text-muted-foreground gap-1 flex-shrink-0"
                  >
                    <Avatar className="h-3.5 w-3.5">
                      <AvatarImage src={item.ownerAvatar} alt={item.ownerDisplay} />
                      <AvatarFallback className="text-[8px]">
                        {item.ownerDisplay?.[0]?.toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    {item.ownerDisplay}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent side="right" className="text-xs">
                  {TOOLTIPS.ownership.ownedBy(item.ownerDisplay)}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )
        )}

        {/* Child count badge */}
        {hasChildren && !isExpanded && (
          <Badge 
            variant="secondary" 
            className="ml-1 h-4 px-1.5 text-[10px] font-medium bg-muted text-muted-foreground flex-shrink-0"
          >
            {childCount}
          </Badge>
        )}
      </div>

      {/* Actions - fixed to right edge with gradient fade */}
      {!isDeleting && (
        <div 
          className={`
            absolute right-0 top-0 bottom-0 
            flex items-center
            transition-opacity duration-150
            ${isHovered ? 'opacity-100' : 'opacity-0 pointer-events-none'}
          `}
        >
          {/* Gradient fade overlay - uses opaque color for active state */}
          <div className={`w-8 h-full ${getActiveGradientClass()}`} />
          {/* Solid background for icons - opaque for active state */}
          <div className={`flex items-center gap-0.5 px-1.5 h-full ${getActiveBgClass()}`}>
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
      )}
    </div>
  );
};
