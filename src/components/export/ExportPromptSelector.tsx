import React, { useMemo, useState, useRef, useEffect } from 'react';
import { Check, ChevronRight, ChevronDown, FileText, Bot, Folder, Search, CheckSquare, Square, ChevronsDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';

// Types
interface TreeNode {
  row_id: string;
  prompt_name?: string;
  is_assistant?: boolean;
  children?: TreeNode[];
}

interface PromptTreeNodeProps {
  node: TreeNode;
  level?: number;
  selectedIds: string[];
  onToggle: (id: string) => void;
  onToggleWithDescendants: (node: TreeNode, allSelected: boolean) => void;
  expandedIds: string[];
  onToggleExpand: (id: string) => void;
  searchQuery: string;
}

interface TreeContainerProps {
  treeData: TreeNode[];
  selectedPromptIds: string[];
  onTogglePrompt: (id: string) => void;
  onToggleWithDescendants: (node: TreeNode, allSelected: boolean) => void;
  expandedIds: string[];
  onToggleExpand: (id: string) => void;
  searchQuery: string;
}

interface ExportPromptSelectorProps {
  treeData: TreeNode[];
  selectedPromptIds: string[];
  onTogglePrompt: (id: string) => void;
  onToggleWithDescendants: (node: TreeNode, allSelected: boolean) => void;
  onSelectAll: (ids: string[]) => void;
  onClearSelection: () => void;
}

// Helper to collect all descendant IDs from a node
const collectDescendantIds = (node: TreeNode): string[] => {
  const ids: string[] = [node.row_id];
  if (node.children?.length) {
    node.children.forEach(child => {
      ids.push(...collectDescendantIds(child));
    });
  }
  return ids;
};

const PromptTreeNode: React.FC<PromptTreeNodeProps> = ({ 
  node, 
  level = 0, 
  selectedIds, 
  onToggle, 
  onToggleWithDescendants, 
  expandedIds, 
  onToggleExpand, 
  searchQuery 
}) => {
  const isSelected = selectedIds.includes(node.row_id);
  const isExpanded = expandedIds.includes(node.row_id);
  const hasChildren = node.children && node.children.length > 0;
  const isAssistant = node.is_assistant;

  // Check if all descendants are selected
  const allDescendantIds = useMemo(() => collectDescendantIds(node), [node]);
  const allDescendantsSelected = allDescendantIds.every(id => selectedIds.includes(id));
  const someDescendantsSelected = allDescendantIds.some(id => selectedIds.includes(id)) && !allDescendantsSelected;

  // Filter based on search query
  const matchesSearch = !searchQuery || 
    node.prompt_name?.toLowerCase().includes(searchQuery.toLowerCase());
  
  const hasMatchingDescendant = useMemo(() => {
    if (!searchQuery) return true;
    const checkDescendants = (n: TreeNode): boolean => {
      if (n.prompt_name?.toLowerCase().includes(searchQuery.toLowerCase())) return true;
      return n.children?.some(child => checkDescendants(child)) || false;
    };
    return checkDescendants(node);
  }, [node, searchQuery]);

  if (searchQuery && !matchesSearch && !hasMatchingDescendant) {
    return null;
  }

  const handleCheckboxClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleWithDescendants(node, allDescendantsSelected);
  };

  const handleExpandClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleExpand(node.row_id);
  };

  return (
    <div>
      <div
        className={cn(
          "flex items-center gap-2.5 py-2 px-3 rounded-lg cursor-pointer transition-all group",
          isSelected 
            ? "bg-primary/10 border border-primary/20" 
            : "hover:bg-muted/50 border border-transparent",
          matchesSearch && searchQuery && "bg-primary/5"
        )}
        style={{ marginLeft: `${level * 16}px` }}
        onClick={handleCheckboxClick}
      >
        {/* Expand/collapse button */}
        {hasChildren ? (
          <button
            onClick={handleExpandClick}
            className="p-0.5 hover:bg-muted rounded transition-colors"
          >
            {isExpanded ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
          </button>
        ) : (
          <div className="w-5" />
        )}

        {/* Checkbox */}
        <div
          className={cn(
            "h-4 w-4 rounded border-2 flex items-center justify-center transition-all flex-shrink-0",
            allDescendantsSelected
              ? "bg-primary border-primary"
              : someDescendantsSelected
                ? "bg-primary/50 border-primary"
                : "border-muted-foreground/30 group-hover:border-primary/50"
          )}
        >
          {allDescendantsSelected && <Check className="h-3 w-3 text-primary-foreground" />}
          {someDescendantsSelected && !allDescendantsSelected && (
            <div className="h-1.5 w-1.5 bg-primary-foreground rounded-sm" />
          )}
        </div>

        {/* Icon */}
        <div className={cn(
          "h-7 w-7 rounded-md flex items-center justify-center flex-shrink-0",
          isAssistant ? "bg-primary/10" : hasChildren ? "bg-amber-500/10" : "bg-muted"
        )}>
          {isAssistant ? (
            <Bot className="h-4 w-4 text-primary" />
          ) : hasChildren ? (
            <Folder className="h-4 w-4 text-amber-500" />
          ) : (
            <FileText className="h-4 w-4 text-muted-foreground" />
          )}
        </div>

        {/* Name */}
        <span className={cn(
          "text-sm truncate flex-1",
          isSelected ? "text-foreground font-medium" : "text-foreground/80"
        )}>
          {node.prompt_name}
        </span>

        {/* Child count badge */}
        {hasChildren && (
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5">
            {node.children!.length}
          </Badge>
        )}
      </div>

      {/* Children */}
      {hasChildren && isExpanded && (
        <div className="mt-0.5">
          {node.children!.map(child => (
            <PromptTreeNode
              key={child.row_id}
              node={child}
              level={level + 1}
              selectedIds={selectedIds}
              onToggle={onToggle}
              onToggleWithDescendants={onToggleWithDescendants}
              expandedIds={expandedIds}
              onToggleExpand={onToggleExpand}
              searchQuery={searchQuery}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const TreeContainer: React.FC<TreeContainerProps> = ({ 
  treeData, 
  selectedPromptIds, 
  onTogglePrompt, 
  onToggleWithDescendants, 
  expandedIds, 
  onToggleExpand, 
  searchQuery 
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showScrollIndicator, setShowScrollIndicator] = useState(false);

  useEffect(() => {
    const checkScroll = () => {
      if (scrollRef.current) {
        const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
        const hasScrollableContent = scrollHeight > clientHeight;
        const isNearBottom = scrollHeight - scrollTop - clientHeight < 30;
        setShowScrollIndicator(hasScrollableContent && !isNearBottom);
      }
    };
    
    checkScroll();
    const timer = setTimeout(checkScroll, 100);
    return () => clearTimeout(timer);
  }, [treeData, expandedIds, searchQuery]);

  const handleScroll = () => {
    if (scrollRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
      const isNearBottom = scrollHeight - scrollTop - clientHeight < 30;
      setShowScrollIndicator(!isNearBottom);
    }
  };

  return (
    <div className="border border-border/50 rounded-xl overflow-hidden bg-card/50 relative">
      <div 
        ref={scrollRef}
        onScroll={handleScroll}
        className="max-h-[55vh] overflow-y-auto p-3 space-y-0.5"
      >
        {treeData.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground text-sm">
            <FileText className="h-10 w-10 mx-auto mb-3 opacity-30" />
            No prompts available
          </div>
        ) : (
          treeData.map(node => (
            <PromptTreeNode
              key={node.row_id}
              node={node}
              selectedIds={selectedPromptIds}
              onToggle={onTogglePrompt}
              onToggleWithDescendants={onToggleWithDescendants}
              expandedIds={expandedIds}
              onToggleExpand={onToggleExpand}
              searchQuery={searchQuery}
            />
          ))
        )}
      </div>
      
      {/* Scroll indicator */}
      <div 
        className={cn(
          "absolute bottom-0 left-0 right-0 h-12 pointer-events-none transition-opacity duration-300",
          "bg-gradient-to-t from-card via-card/80 to-transparent",
          "flex items-end justify-center pb-1",
          showScrollIndicator ? "opacity-100" : "opacity-0"
        )}
      >
        <div className="flex items-center gap-1 text-muted-foreground text-xs animate-bounce">
          <ChevronsDown className="h-4 w-4" />
          <span>More below</span>
        </div>
      </div>
    </div>
  );
};

export const ExportPromptSelector: React.FC<ExportPromptSelectorProps> = ({
  treeData,
  selectedPromptIds,
  onTogglePrompt,
  onToggleWithDescendants,
  onSelectAll,
  onClearSelection
}) => {
  const [expandedIds, setExpandedIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Get all prompt IDs for select all
  const allPromptIds = useMemo(() => {
    const ids: string[] = [];
    const collectIds = (nodes: TreeNode[]) => {
      nodes.forEach(node => {
        ids.push(node.row_id);
        if (node.children?.length) {
          collectIds(node.children);
        }
      });
    };
    collectIds(treeData);
    return ids;
  }, [treeData]);

  const handleToggleExpand = (id: string) => {
    setExpandedIds(prev => {
      if (prev.includes(id)) {
        return prev.filter(x => x !== id);
      }
      return [...prev, id];
    });
  };

  const handleSelectAll = () => {
    onSelectAll(allPromptIds);
    setExpandedIds(allPromptIds);
  };

  const handleExpandAll = () => {
    setExpandedIds(allPromptIds);
  };

  const totalCount = allPromptIds.length;
  const selectedCount = selectedPromptIds.length;
  const allSelected = selectedCount === totalCount && totalCount > 0;

  return (
    <div className="space-y-4">
      {/* Header with search */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">Select prompts to export</h3>
          <Badge variant="outline" className="font-normal">
            {selectedCount} / {totalCount}
          </Badge>
        </div>
        
        {/* Search input */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search prompts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 bg-muted/50 border-muted-foreground/20"
          />
        </div>

        {/* Bulk actions */}
        <div className="flex items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={handleSelectAll}
                disabled={allSelected}
                className={cn(
                  "flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md transition-colors",
                  allSelected
                    ? "text-muted-foreground cursor-not-allowed bg-muted/30"
                    : "text-primary bg-primary/10 hover:bg-primary/20"
                )}
              >
                <CheckSquare className="h-3.5 w-3.5" />
                Select all
              </button>
            </TooltipTrigger>
            <TooltipContent>Select all {totalCount} prompts</TooltipContent>
          </Tooltip>
          
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={onClearSelection}
                disabled={selectedCount === 0}
                className={cn(
                  "flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md transition-colors",
                  selectedCount === 0
                    ? "text-muted-foreground cursor-not-allowed bg-muted/30"
                    : "text-muted-foreground bg-muted/50 hover:bg-muted hover:text-foreground"
                )}
              >
                <Square className="h-3.5 w-3.5" />
                Clear
              </button>
            </TooltipTrigger>
            <TooltipContent>Clear selection</TooltipContent>
          </Tooltip>

          <div className="flex-1" />

          <button
            onClick={handleExpandAll}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Expand all
          </button>
        </div>
      </div>

      {/* Tree container */}
      <TreeContainer
        treeData={treeData}
        selectedPromptIds={selectedPromptIds}
        onTogglePrompt={onTogglePrompt}
        onToggleWithDescendants={onToggleWithDescendants}
        expandedIds={expandedIds}
        onToggleExpand={handleToggleExpand}
        searchQuery={searchQuery}
      />
    </div>
  );
};