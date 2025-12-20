import React, { useState, useCallback } from 'react';
import { ChevronRight, ChevronDown, Plus, Trash2, Copy, GripVertical, Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { v4 as uuidv4 } from 'uuid';

/**
 * Visual structure editor for template prompt hierarchy
 */
const TemplateStructureEditor = ({ structure, onChange, variableDefinitions = [] }) => {
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [expandedNodes, setExpandedNodes] = useState(new Set(['root']));

  // Find node by ID in the tree
  const findNode = useCallback((node, id, path = []) => {
    if (!node) return null;
    const nodeId = node._id || 'root';
    if (nodeId === id) return { node, path };
    if (node.children) {
      for (let i = 0; i < node.children.length; i++) {
        const result = findNode(node.children[i], id, [...path, i]);
        if (result) return result;
      }
    }
    return null;
  }, []);

  // Update a specific node in the tree
  const updateNode = useCallback((nodeId, updates) => {
    const updateInTree = (node) => {
      if (!node) return node;
      const currentId = node._id || 'root';
      if (currentId === nodeId) {
        return { ...node, ...updates };
      }
      if (node.children) {
        return {
          ...node,
          children: node.children.map(child => updateInTree(child))
        };
      }
      return node;
    };
    
    const newStructure = updateInTree(structure);
    onChange(newStructure);
  }, [structure, onChange]);

  // Add child to a node
  const addChild = useCallback((parentId) => {
    const newChild = {
      _id: uuidv4(),
      prompt_name: 'New Prompt',
      input_admin_prompt: '',
      input_user_prompt: '',
      model: null,
      temperature: null,
      max_tokens: null,
      children: [],
    };

    const addToTree = (node) => {
      if (!node) return node;
      const currentId = node._id || 'root';
      if (currentId === parentId) {
        return {
          ...node,
          children: [...(node.children || []), newChild]
        };
      }
      if (node.children) {
        return {
          ...node,
          children: node.children.map(child => addToTree(child))
        };
      }
      return node;
    };

    const newStructure = addToTree(structure);
    onChange(newStructure);
    setExpandedNodes(prev => new Set([...prev, parentId]));
    setSelectedNodeId(newChild._id);
  }, [structure, onChange]);

  // Delete a node
  const deleteNode = useCallback((nodeId) => {
    if (nodeId === 'root') return; // Can't delete root

    const removeFromTree = (node) => {
      if (!node) return node;
      if (node.children) {
        return {
          ...node,
          children: node.children
            .filter(child => child._id !== nodeId)
            .map(child => removeFromTree(child))
        };
      }
      return node;
    };

    const newStructure = removeFromTree(structure);
    onChange(newStructure);
    if (selectedNodeId === nodeId) {
      setSelectedNodeId(null);
    }
  }, [structure, onChange, selectedNodeId]);

  // Duplicate a node
  const duplicateNode = useCallback((nodeId) => {
    if (nodeId === 'root') return;

    const duplicateInTree = (node) => {
      if (!node) return node;
      if (node.children) {
        const newChildren = [];
        for (const child of node.children) {
          newChildren.push(duplicateInTree(child));
          if (child._id === nodeId) {
            // Create a deep copy with new IDs
            const deepCopy = (n) => ({
              ...n,
              _id: uuidv4(),
              prompt_name: n.prompt_name + ' (copy)',
              children: n.children ? n.children.map(deepCopy) : [],
            });
            newChildren.push(deepCopy(child));
          }
        }
        return { ...node, children: newChildren };
      }
      return node;
    };

    const newStructure = duplicateInTree(structure);
    onChange(newStructure);
  }, [structure, onChange]);

  // Toggle node expansion
  const toggleExpanded = (nodeId) => {
    setExpandedNodes(prev => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  };

  // Extract variables from text
  const extractVariables = (text) => {
    if (!text) return [];
    const matches = text.match(/\{\{([^}]+)\}\}/g) || [];
    return matches.map(m => m.slice(2, -2).trim());
  };

  // Render tree node
  const renderNode = (node, depth = 0) => {
    if (!node) return null;
    const nodeId = node._id || 'root';
    const isExpanded = expandedNodes.has(nodeId);
    const isSelected = selectedNodeId === nodeId;
    const hasChildren = node.children && node.children.length > 0;
    
    // Find variables in this node
    const nodeVariables = [
      ...extractVariables(node.input_admin_prompt),
      ...extractVariables(node.input_user_prompt),
    ];

    return (
      <div key={nodeId}>
        <div
          className={cn(
            "flex items-center gap-1 py-1.5 px-2 rounded cursor-pointer transition-colors",
            isSelected ? "bg-primary/10 border border-primary/30" : "hover:bg-muted/50 border border-transparent",
          )}
          style={{ paddingLeft: `${depth * 20 + 8}px` }}
          onClick={() => setSelectedNodeId(nodeId)}
        >
          {hasChildren ? (
            <button
              onClick={(e) => { e.stopPropagation(); toggleExpanded(nodeId); }}
              className="p-0.5 hover:bg-muted rounded"
            >
              {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </button>
          ) : (
            <span className="w-5" />
          )}
          
          <span className="flex-1 text-sm truncate">{node.prompt_name || 'Untitled'}</span>
          
          {nodeVariables.length > 0 && (
            <Badge variant="outline" className="text-[10px] px-1">
              {nodeVariables.length} var{nodeVariables.length > 1 ? 's' : ''}
            </Badge>
          )}
          
          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6"
                  onClick={(e) => { e.stopPropagation(); addChild(nodeId); }}
                >
                  <Plus className="h-3 w-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Add child prompt</TooltipContent>
            </Tooltip>
            
            {nodeId !== 'root' && (
              <>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6"
                      onClick={(e) => { e.stopPropagation(); duplicateNode(nodeId); }}
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Duplicate</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6 text-destructive hover:text-destructive"
                      onClick={(e) => { e.stopPropagation(); deleteNode(nodeId); }}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Delete</TooltipContent>
                </Tooltip>
              </>
            )}
          </div>
        </div>
        
        {isExpanded && hasChildren && (
          <div>
            {node.children.map(child => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  // Get selected node data
  const selectedNode = selectedNodeId ? findNode(structure, selectedNodeId)?.node : null;

  // Ensure root has an ID
  const structureWithId = structure?._id ? structure : { ...structure, _id: 'root' };

  return (
    <div className="h-full flex">
      {/* Tree View */}
      <div className="w-72 border-r border-border flex flex-col">
        <div className="p-3 border-b border-border flex items-center justify-between">
          <h4 className="text-sm font-medium">Prompt Hierarchy</h4>
          <Button size="sm" variant="ghost" onClick={() => addChild('root')}>
            <Plus className="h-4 w-4 mr-1" />
            Add
          </Button>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-2 group">
            {renderNode(structureWithId)}
          </div>
        </ScrollArea>
      </div>

      {/* Node Editor */}
      <div className="flex-1 overflow-auto p-4">
        {selectedNode ? (
          <NodeEditor
            node={selectedNode}
            onUpdate={(updates) => updateNode(selectedNodeId, updates)}
            variableDefinitions={variableDefinitions}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
            Select a node to edit
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * Editor for a single node
 */
const NodeEditor = ({ node, onUpdate, variableDefinitions }) => {
  const [showSettings, setShowSettings] = useState(false);

  const insertVariable = (field, varName) => {
    const currentValue = node[field] || '';
    onUpdate({ [field]: currentValue + `{{${varName}}}` });
  };

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="space-y-2">
        <Label>Prompt Name</Label>
        <Input
          value={node.prompt_name || ''}
          onChange={(e) => onUpdate({ prompt_name: e.target.value })}
          placeholder="Enter prompt name"
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>System Prompt</Label>
          {variableDefinitions.length > 0 && (
            <Select onValueChange={(v) => insertVariable('input_admin_prompt', v)}>
              <SelectTrigger className="w-auto h-7 text-xs">
                <span className="text-muted-foreground">Insert variable...</span>
              </SelectTrigger>
              <SelectContent>
                {variableDefinitions.map(v => (
                  <SelectItem key={v.name} value={v.name}>
                    {`{{${v.name}}}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
        <Textarea
          value={node.input_admin_prompt || ''}
          onChange={(e) => onUpdate({ input_admin_prompt: e.target.value })}
          placeholder="System instructions for the AI..."
          rows={6}
          className="font-mono text-sm"
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>User Prompt</Label>
          {variableDefinitions.length > 0 && (
            <Select onValueChange={(v) => insertVariable('input_user_prompt', v)}>
              <SelectTrigger className="w-auto h-7 text-xs">
                <span className="text-muted-foreground">Insert variable...</span>
              </SelectTrigger>
              <SelectContent>
                {variableDefinitions.map(v => (
                  <SelectItem key={v.name} value={v.name}>
                    {`{{${v.name}}}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
        <Textarea
          value={node.input_user_prompt || ''}
          onChange={(e) => onUpdate({ input_user_prompt: e.target.value })}
          placeholder="User message template..."
          rows={4}
          className="font-mono text-sm"
        />
      </div>

      {/* Model Settings Collapsible */}
      <Collapsible open={showSettings} onOpenChange={setShowSettings}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" className="w-full justify-between">
            <span className="flex items-center gap-2">
              <Settings2 className="h-4 w-4" />
              Model Settings
            </span>
            <ChevronRight className={cn("h-4 w-4 transition-transform", showSettings && "rotate-90")} />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-4 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Model</Label>
              <Input
                value={node.model || ''}
                onChange={(e) => onUpdate({ model: e.target.value || null })}
                placeholder="Inherit from defaults"
              />
            </div>
            <div className="space-y-2">
              <Label>Temperature</Label>
              <Input
                type="number"
                min="0"
                max="2"
                step="0.1"
                value={node.temperature ?? ''}
                onChange={(e) => onUpdate({ temperature: e.target.value ? parseFloat(e.target.value) : null })}
                placeholder="Inherit"
              />
            </div>
            <div className="space-y-2">
              <Label>Max Tokens</Label>
              <Input
                type="number"
                min="1"
                value={node.max_tokens ?? ''}
                onChange={(e) => onUpdate({ max_tokens: e.target.value ? parseInt(e.target.value) : null })}
                placeholder="Inherit"
              />
            </div>
            <div className="space-y-2">
              <Label>Top P</Label>
              <Input
                type="number"
                min="0"
                max="1"
                step="0.1"
                value={node.top_p ?? ''}
                onChange={(e) => onUpdate({ top_p: e.target.value ? parseFloat(e.target.value) : null })}
                placeholder="Inherit"
              />
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
};

export default TemplateStructureEditor;
