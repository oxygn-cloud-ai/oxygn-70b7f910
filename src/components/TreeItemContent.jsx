import React, { useState } from 'react';
import { FileText, ChevronRight, ChevronDown, Bot, SkipForward, Loader2, FileX, Zap, icons } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { TreeItemActions } from './TreeItemActions';
import { OwnerChangeContent } from './OwnerChangePopover';
import { useAuth } from '../contexts/AuthContext';
import { useCascadeRun } from '@/contexts/CascadeRunContext';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { TOOLTIPS } from '@/config/labels';
import { getActionType } from '@/config/actionTypes';
import { IconPicker } from './IconPicker';
import { updatePromptIcon } from '@/services/promptMutations';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

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
  isDeleting,
  onExportPrompt
}) => {
  const { user, isAdmin } = useAuth();
  const { isRunning: isCascadeRunning, currentPromptRowId, singleRunPromptId } = useCascadeRun();
  const isOwner = user?.id === item.owner_id;
  const canChangeOwner = isAdmin || isOwner;
  
  // Icon picker state
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [isIconHovered, setIsIconHovered] = useState(false);
  
  // Check if this item is currently running (cascade or single run)
  const isCurrentlyRunning = (isCascadeRunning && currentPromptRowId === item.id) || 
                              (singleRunPromptId === item.id);
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
  
  // Handle right-click on icon to open picker
  const handleIconContextMenu = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setShowIconPicker(true);
  };
  
  // Handle icon hover - controls action menu visibility
  const handleIconMouseEnter = () => {
    setIsIconHovered(true);
    if (!isDeleting) setIsHovered(true);
  };
  
  const handleIconMouseLeave = () => {
    setIsIconHovered(false);
    setIsHovered(false);
  };
  
  // Handle icon selection
  const handleIconChange = async (iconName) => {
    try {
      await updatePromptIcon(supabase, item.id, iconName);
      if (onRefreshTreeData) {
        onRefreshTreeData();
      }
      toast.success(iconName ? 'Icon updated' : 'Icon reset to default');
    } catch (error) {
      console.error('Failed to update icon:', error);
      toast.error('Failed to update icon');
    }
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
  
  // M3 Render the icon based on custom icon_name or default
  const renderIcon = () => {
    const iconClasses = `
      flex items-center justify-center w-8 h-8 rounded-xl flex-shrink-0 
      cursor-pointer transition-all duration-short-4 ease-standard
      ${isIconHovered ? 'ring-2 ring-primary/30 scale-105' : ''}
    `;
    
    // Custom icon takes priority - icons are stored as PascalCase
    if (item.icon_name && icons[item.icon_name]) {
      const CustomIcon = icons[item.icon_name];
      return (
        <div 
          className={`${iconClasses} bg-primary/12 text-primary`}
          onMouseEnter={handleIconMouseEnter}
          onMouseLeave={handleIconMouseLeave}
          onContextMenu={handleIconContextMenu}
        >
          <CustomIcon className="h-4 w-4" />
        </div>
      );
    }
    
    // Default: Bot for assistants, FileText for others
    if (item.is_assistant) {
      return (
        <div 
          className={`${iconClasses} bg-primary/12 text-primary`}
          onMouseEnter={handleIconMouseEnter}
          onMouseLeave={handleIconMouseLeave}
          onContextMenu={handleIconContextMenu}
        >
          <Bot className="h-4 w-4" />
        </div>
      );
    }
    
    return (
      <div 
        className={`${iconClasses} bg-surface-container-high text-on-surface-variant ${isIconHovered ? 'bg-surface-container-highest' : ''}`}
        onMouseEnter={handleIconMouseEnter}
        onMouseLeave={handleIconMouseLeave}
        onContextMenu={handleIconContextMenu}
      >
        <FileText className="h-4 w-4" />
      </div>
    );
  };

  return (
    <>
      <div
        className={`
          m3-list-item group relative flex items-center
          py-2 px-3 rounded-2xl
          transition-all duration-medium-2 ease-standard
          ${isDeleting ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
          ${isActive && !isDeleting
            ? 'bg-secondary-container text-on-secondary-container shadow-elevation-1' 
            : 'hover:bg-on-surface/8 text-on-surface'
          }
        `}
        style={{ paddingLeft: `${level * 14 + 8}px` }}
        onClick={() => !isDeleting && setActiveItem(item.id)}
      >
        {/* Main content - truncates when needed */}
        <div className="flex items-center gap-1.5 flex-1 min-w-0 overflow-hidden">
          {/* M3 Expand/Collapse Button */}
          {hasChildren ? (
            <button
              type="button"
              className="p-0.5 h-6 w-6 flex-shrink-0 rounded-full inline-flex items-center justify-center text-on-surface-variant hover:bg-on-surface/8 transition-colors duration-short-4 ease-standard"
              onClick={handleToggle}
            >
              <div className={`transition-transform duration-short-4 ease-standard ${isExpanded ? 'rotate-90' : ''}`}>
                <ChevronRight className="h-4 w-4" />
              </div>
            </button>
          ) : (
            <div className="w-6 h-6 flex-shrink-0" />
          )}

          {/* M3 Type Icon - show spinning loader when running, otherwise custom/default icon */}
          {isCurrentlyRunning ? (
            <div className="flex items-center justify-center w-8 h-8 rounded-xl flex-shrink-0 bg-tertiary/12 text-tertiary">
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>
          ) : (
            renderIcon()
          )}

          {/* M3 Name */}
          {editingItem && editingItem.id === item.id ? (
            <Input
              value={editingItem.name}
              onChange={(e) => setEditingItem({ ...editingItem, name: e.target.value })}
              onKeyDown={handleKeyDown}
              onBlur={cancelRenaming}
              onClick={(e) => e.stopPropagation()}
              className="h-8 py-1 px-2 text-sm flex-1 min-w-0 rounded-xl bg-surface-container-highest border-outline focus:ring-primary"
              autoFocus
            />
          ) : (
            <span 
              className={`
                truncate text-body-medium font-medium flex-1 min-w-0
                transition-colors duration-short-4 ease-standard
                ${isDeleting 
                  ? 'text-on-surface/40' 
                  : isCurrentlyRunning
                    ? 'text-tertiary'
                    : isActive 
                      ? 'text-on-secondary-container' 
                      : 'text-on-surface'
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

          {/* Excluded from cascade indicator */}
          {item.exclude_from_cascade && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="ml-1 flex items-center justify-center w-4 h-4 rounded flex-shrink-0 bg-muted text-muted-foreground">
                    <SkipForward className="h-3 w-3" />
                  </div>
                </TooltipTrigger>
                <TooltipContent side="right" className="text-xs">
                  Excluded from cascade
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}

          {/* Excluded from export indicator */}
          {item.exclude_from_export && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="ml-1 flex items-center justify-center w-4 h-4 rounded flex-shrink-0 bg-orange-500/20 text-orange-500">
                    <FileX className="h-3 w-3" />
                  </div>
                </TooltipTrigger>
                <TooltipContent side="right" className="text-xs">
                  Excluded from export
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}

          {/* Action node indicator */}
          {item.node_type === 'action' && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="ml-1 flex items-center justify-center w-4 h-4 rounded flex-shrink-0 bg-amber-500/20 text-amber-500">
                    <Zap className="h-3 w-3" />
                  </div>
                </TooltipTrigger>
                <TooltipContent side="right" className="text-xs">
                  Action Node
                  {item.post_action && ` • ${getActionType(item.post_action)?.name || item.post_action}`}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}

          {/* M3 Child count badge */}
          {hasChildren && !isExpanded && (
            <Badge 
              variant="secondary" 
              className="ml-1 h-5 px-2 text-label-small font-medium bg-surface-container-high text-on-surface-variant rounded-full flex-shrink-0"
            >
              {childCount}
            </Badge>
          )}
        </div>

        {/* Actions - fixed to right edge with gradient fade, only visible on icon hover */}
        {!isDeleting && (
          <div 
            className={`
              absolute right-0 top-0 bottom-0 
              flex items-center justify-end
              transition-opacity duration-150
              ${isIconHovered || isActive ? 'opacity-100' : 'opacity-0 pointer-events-none'}
            `}
            style={{ maxWidth: `calc(100% - ${level * 14 + 4 + 56}px)` }}
          >
            {/* Gradient fade overlay - uses opaque color for active state */}
            <div className={`w-8 h-full flex-shrink-0 ${getActiveGradientClass()}`} />
            {/* Solid background for icons - opaque for active state */}
            <div className={`flex items-center gap-0.5 px-1.5 h-full flex-shrink-0 ${getActiveBgClass()}`}>
              <TreeItemActions
                item={item}
                addItem={addItem}
                deleteItem={deleteItem}
                duplicateItem={duplicateItem}
                startRenaming={startRenaming}
                siblings={siblings}
                onRefreshTreeData={onRefreshTreeData}
                onExportPrompt={onExportPrompt}
              />
            </div>
          </div>
        )}
      </div>
      
      {/* Icon Picker Dialog */}
      <IconPicker
        open={showIconPicker}
        onOpenChange={setShowIconPicker}
        currentIcon={item.icon_name}
        onIconSelect={handleIconChange}
      />
    </>
  );
};