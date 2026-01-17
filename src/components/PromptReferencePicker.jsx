import React, { useState, useMemo, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronRight, ChevronDown, Search, FileText, Bot, Link2, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import useTreeData from '@/hooks/useTreeData';
import { useSupabase } from '@/hooks/useSupabase';

// Fields available for reference
const REFERENCE_FIELDS = [
  { key: 'output_response', label: 'AI Response', description: 'The AI-generated response' },
  { key: 'user_prompt_result', label: 'User Prompt Result', description: 'Result stored in user prompt field' },
  { key: 'input_admin_prompt', label: 'System Prompt', description: 'The admin/system prompt' },
  { key: 'input_user_prompt', label: 'User Prompt', description: 'The user input prompt' },
  { key: 'prompt_name', label: 'Name', description: 'The prompt name' },
];

// Recursive tree node component
const PromptTreeNode = ({ 
  node, 
  level = 0, 
  selectedPromptId, 
  onSelectPrompt, 
  expandedNodes, 
  onToggleExpand,
  searchQuery 
}) => {
  const hasChildren = node.children && node.children.length > 0;
  const isExpanded = expandedNodes.has(node.row_id);
  const isSelected = selectedPromptId === node.row_id;

  // Filter by search
  const matchesSearch = !searchQuery || 
    node.prompt_name?.toLowerCase().includes(searchQuery.toLowerCase());
  
  // Check if any descendants match search
  const hasMatchingDescendants = useMemo(() => {
    if (!searchQuery) return true;
    const checkDescendants = (n) => {
      if (n.prompt_name?.toLowerCase().includes(searchQuery.toLowerCase())) return true;
      return n.children?.some(checkDescendants) || false;
    };
    return checkDescendants(node);
  }, [node, searchQuery]);

  if (!matchesSearch && !hasMatchingDescendants) {
    return null;
  }

  return (
    <div>
      <div
        className={cn(
          "flex items-center gap-1 px-2 py-1.5 rounded cursor-pointer transition-colors",
          isSelected ? "bg-primary/10 text-primary" : "hover:bg-muted/50"
        )}
        style={{ paddingLeft: `${level * 16 + 8}px` }}
        onClick={() => onSelectPrompt(node)}
      >
        {/* Expand/collapse toggle */}
        {hasChildren ? (
          <button
            className="p-0.5 hover:bg-muted rounded"
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand(node.row_id);
            }}
          >
            {isExpanded ? (
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
            )}
          </button>
        ) : (
          <span className="w-5" />
        )}

        {/* Icon */}
        {node.is_assistant ? (
          <Bot className="h-4 w-4 text-primary shrink-0" />
        ) : (
          <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
        )}

        {/* Name */}
        <span className="text-sm truncate flex-1">{node.prompt_name || 'Untitled'}</span>

        {/* Selected indicator */}
        {isSelected && <Check className="h-4 w-4 text-primary" />}
      </div>

      {/* Children */}
      {hasChildren && isExpanded && (
        <div>
          {node.children.map((child) => (
            <PromptTreeNode
              key={child.row_id}
              node={child}
              level={level + 1}
              selectedPromptId={selectedPromptId}
              onSelectPrompt={onSelectPrompt}
              expandedNodes={expandedNodes}
              onToggleExpand={onToggleExpand}
              searchQuery={searchQuery}
            />
          ))}
        </div>
      )}
    </div>
  );
};

/**
 * Modal for selecting a prompt and field to create a reference variable
 * Returns syntax: {{q.ref[UUID].field}}
 */
const PromptReferencePicker = ({ 
  isOpen, 
  onClose, 
  onInsert,
  familyRootPromptRowId = null, // If provided, filter to only show prompts in this family
}) => {
  const supabase = useSupabase();
  const { treeData, isLoading } = useTreeData(supabase);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPrompt, setSelectedPrompt] = useState(null);
  const [selectedField, setSelectedField] = useState('');
  const [expandedNodes, setExpandedNodes] = useState(new Set());

  // Build tree structure from flat data
  const buildTree = useCallback((items) => {
    const itemMap = new Map();
    const roots = [];

    // First pass: create map
    items.forEach(item => {
      itemMap.set(item.row_id, { ...item, children: [] });
    });

    // Second pass: build tree
    items.forEach(item => {
      const node = itemMap.get(item.row_id);
      if (item.parent_row_id && itemMap.has(item.parent_row_id)) {
        itemMap.get(item.parent_row_id).children.push(node);
      } else {
        roots.push(node);
      }
    });

    // Sort children by position
    const sortChildren = (nodes) => {
      nodes.sort((a, b) => (a.position || 0) - (b.position || 0));
      nodes.forEach(node => {
        if (node.children.length > 0) {
          sortChildren(node.children);
        }
      });
    };
    sortChildren(roots);

    return roots;
  }, []);

  const fullTree = useMemo(() => buildTree(treeData), [treeData, buildTree]);

  // Filter tree to only show prompts within the specified family
  const tree = useMemo(() => {
    if (!familyRootPromptRowId) return fullTree;
    
    // Find and return only the family tree
    const findFamilyRoot = (nodes) => {
      for (const node of nodes) {
        if (node.row_id === familyRootPromptRowId) {
          return [node];
        }
        if (node.children?.length > 0) {
          const found = findFamilyRoot(node.children);
          if (found.length > 0) return found;
        }
      }
      return [];
    };
    
    return findFamilyRoot(fullTree);
  }, [fullTree, familyRootPromptRowId]);

  const handleToggleExpand = useCallback((nodeId) => {
    setExpandedNodes(prev => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  }, []);

  const handleSelectPrompt = useCallback((node) => {
    setSelectedPrompt(node);
    // Auto-expand when selecting
    if (node.children?.length > 0) {
      setExpandedNodes(prev => new Set(prev).add(node.row_id));
    }
  }, []);

  const handleInsert = useCallback(() => {
    if (!selectedPrompt || !selectedField) return;
    
    const reference = `{{q.ref[${selectedPrompt.row_id}].${selectedField}}}`;
    onInsert(reference);
    
    // Reset state
    setSelectedPrompt(null);
    setSelectedField('');
    setSearchQuery('');
    onClose();
  }, [selectedPrompt, selectedField, onInsert, onClose]);

  const handleClose = useCallback(() => {
    setSelectedPrompt(null);
    setSelectedField('');
    setSearchQuery('');
    onClose();
  }, [onClose]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-lg max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5" />
            Insert Prompt Reference
          </DialogTitle>
          <DialogDescription>
            Select a prompt and field to create a variable reference
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 flex-1 min-h-0">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search prompts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Prompt Tree */}
          <div className="flex-1 min-h-0 border rounded-md">
            <ScrollArea className="h-[250px]">
              <div className="p-2">
                {isLoading ? (
                  <div className="text-sm text-muted-foreground text-center py-8">
                    Loading prompts...
                  </div>
                ) : tree.length === 0 ? (
                  <div className="text-sm text-muted-foreground text-center py-8">
                    No prompts available
                  </div>
                ) : (
                  tree.map((node) => (
                    <PromptTreeNode
                      key={node.row_id}
                      node={node}
                      selectedPromptId={selectedPrompt?.row_id}
                      onSelectPrompt={handleSelectPrompt}
                      expandedNodes={expandedNodes}
                      onToggleExpand={handleToggleExpand}
                      searchQuery={searchQuery}
                    />
                  ))
                )}
              </div>
            </ScrollArea>
          </div>

          {/* Selected Prompt Info */}
          {selectedPrompt && (
            <div className="bg-muted/30 rounded-md p-3">
              <div className="text-sm text-muted-foreground mb-2">Selected prompt:</div>
              <div className="flex items-center gap-2 mb-3">
                {selectedPrompt.is_assistant ? (
                  <Bot className="h-4 w-4 text-primary" />
                ) : (
                  <FileText className="h-4 w-4 text-muted-foreground" />
                )}
                <span className="font-medium text-sm">{selectedPrompt.prompt_name}</span>
              </div>

              {/* Field Selector */}
              <div className="space-y-2">
                <label className="text-sm text-muted-foreground">Select field:</label>
                <Select value={selectedField} onValueChange={setSelectedField}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a field..." />
                  </SelectTrigger>
                  <SelectContent>
                    {REFERENCE_FIELDS.map((field) => (
                      <SelectItem key={field.key} value={field.key}>
                        {field.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Preview */}
              {selectedField && (
                <div className="mt-3 p-2 bg-background rounded border">
                  <div className="text-xs text-muted-foreground mb-1">Will insert:</div>
                  <code className="text-xs text-primary break-all">
                    {`{{q.ref[${selectedPrompt.row_id}].${selectedField}}}`}
                  </code>
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button 
              onClick={handleInsert}
              disabled={!selectedPrompt || !selectedField}
            >
              Insert Reference
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PromptReferencePicker;
export { REFERENCE_FIELDS };
