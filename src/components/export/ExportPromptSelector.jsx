import React, { useMemo } from 'react';
import { Check, ChevronRight, ChevronDown, FileText, Bot, Folder } from 'lucide-react';
import { cn } from '@/lib/utils';

const PromptTreeNode = ({ node, level = 0, selectedIds, onToggle, expandedIds, onToggleExpand }) => {
  const isSelected = selectedIds.includes(node.row_id);
  const isExpanded = expandedIds.includes(node.row_id);
  const hasChildren = node.children && node.children.length > 0;
  const isAssistant = node.is_assistant;

  const handleCheckboxClick = (e) => {
    e.stopPropagation();
    onToggle(node.row_id);
  };

  const handleExpandClick = (e) => {
    e.stopPropagation();
    onToggleExpand(node.row_id);
  };

  return (
    <div>
      <div
        className={cn(
          "flex items-center gap-2 py-1.5 px-2 rounded-md cursor-pointer transition-colors hover:bg-muted/50",
          isSelected && "bg-primary/10"
        )}
        style={{ paddingLeft: `${level * 16 + 8}px` }}
        onClick={handleCheckboxClick}
      >
        {/* Expand/collapse button */}
        {hasChildren ? (
          <button
            onClick={handleExpandClick}
            className="p-0.5 hover:bg-muted rounded"
          >
            {isExpanded ? (
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
            )}
          </button>
        ) : (
          <div className="w-4.5" />
        )}

        {/* Checkbox */}
        <div
          className={cn(
            "h-4 w-4 rounded border flex items-center justify-center transition-colors flex-shrink-0",
            isSelected
              ? "bg-primary border-primary"
              : "border-border hover:border-primary/50"
          )}
        >
          {isSelected && <Check className="h-3 w-3 text-primary-foreground" />}
        </div>

        {/* Icon */}
        {isAssistant ? (
          <Bot className="h-4 w-4 text-primary flex-shrink-0" />
        ) : hasChildren ? (
          <Folder className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        ) : (
          <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        )}

        {/* Name */}
        <span className={cn(
          "text-sm truncate",
          isSelected ? "text-foreground font-medium" : "text-muted-foreground"
        )}>
          {node.prompt_name}
        </span>
      </div>

      {/* Children */}
      {hasChildren && isExpanded && (
        <div>
          {node.children.map(child => (
            <PromptTreeNode
              key={child.row_id}
              node={child}
              level={level + 1}
              selectedIds={selectedIds}
              onToggle={onToggle}
              expandedIds={expandedIds}
              onToggleExpand={onToggleExpand}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export const ExportPromptSelector = ({
  treeData,
  selectedPromptIds,
  onTogglePrompt,
  onSelectAll,
  onClearSelection
}) => {
  const [expandedIds, setExpandedIds] = React.useState([]);

  // Get all prompt IDs for select all
  const allPromptIds = useMemo(() => {
    const ids = [];
    const collectIds = (nodes) => {
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

  const handleToggleExpand = (id) => {
    setExpandedIds(prev => {
      if (prev.includes(id)) {
        return prev.filter(x => x !== id);
      }
      return [...prev, id];
    });
  };

  const handleSelectAll = () => {
    onSelectAll(allPromptIds);
    // Expand all
    setExpandedIds(allPromptIds);
  };

  const totalCount = allPromptIds.length;
  const selectedCount = selectedPromptIds.length;
  const allSelected = selectedCount === totalCount && totalCount > 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-foreground">Select prompts to export</h3>
        <div className="flex items-center gap-2">
          <button
            onClick={handleSelectAll}
            disabled={allSelected}
            className={cn(
              "text-xs px-2 py-1 rounded transition-colors",
              allSelected
                ? "text-muted-foreground cursor-not-allowed"
                : "text-primary hover:bg-primary/10"
            )}
          >
            Select all ({totalCount})
          </button>
          <button
            onClick={onClearSelection}
            disabled={selectedCount === 0}
            className={cn(
              "text-xs px-2 py-1 rounded transition-colors",
              selectedCount === 0
                ? "text-muted-foreground cursor-not-allowed"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            )}
          >
            Clear
          </button>
        </div>
      </div>

      <div className="border border-border rounded-lg overflow-hidden">
        <div className="max-h-[400px] overflow-y-auto p-2">
          {treeData.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              No prompts available
            </div>
          ) : (
            treeData.map(node => (
              <PromptTreeNode
                key={node.row_id}
                node={node}
                selectedIds={selectedPromptIds}
                onToggle={onTogglePrompt}
                expandedIds={expandedIds}
                onToggleExpand={handleToggleExpand}
              />
            ))
          )}
        </div>
      </div>

      <div className="text-xs text-muted-foreground">
        {selectedCount} of {totalCount} prompts selected
      </div>
    </div>
  );
};
