import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { ChevronRight, ChevronDown, Plus, Trash2, Copy, Settings2, Bot, MessageSquare, Wrench, ArrowUp, ArrowDown, Edit2, BookOpen, GripVertical } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';
import { v4 as uuidv4 } from 'uuid';
import { useModels } from '@/hooks/useModels';
import { ResizablePromptArea } from '@/components/shared';
import MarkdownNotesArea from '@/components/shared/MarkdownNotesArea';
import { SettingCard } from '@/components/ui/setting-card';
import { SettingRow } from '@/components/ui/setting-row';
import { SettingDivider } from '@/components/ui/setting-divider';
import { SettingModelSelect, SettingSelect } from '@/components/ui/setting-select';
import { DndProvider, useDrag, useDrop } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';

const DRAG_TYPE = 'TEMPLATE_NODE';

/**
 * Visual structure editor for template prompt hierarchy
 */
const TemplateStructureEditor = ({ structure, onChange, variableDefinitions = [] }) => {
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [expandedNodes, setExpandedNodes] = useState(new Set(['root']));
  const [renamingNodeId, setRenamingNodeId] = useState(null);
  const [renameValue, setRenameValue] = useState('');

  // Ensure root has an ID - moved BEFORE selectedNode computation
  const structureWithId = useMemo(() => {
    return structure?._id ? structure : { ...structure, _id: 'root' };
  }, [structure]);

  // Auto-select root node on mount so top-level prompt is immediately editable
  useEffect(() => {
    if (structureWithId && !selectedNodeId) {
      setSelectedNodeId('root');
    }
  }, [structureWithId]);

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

  // Get selected node data - now uses structureWithId
  const selectedNode = useMemo(() => {
    if (!selectedNodeId) return null;
    return findNode(structureWithId, selectedNodeId)?.node || null;
  }, [selectedNodeId, structureWithId, findNode]);

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
    
    const newStructure = updateInTree(structureWithId);
    onChange(newStructure);
  }, [structureWithId, onChange]);

  // Add child to a node
  const addChild = useCallback((parentId) => {
    const newChild = {
      _id: uuidv4(),
      prompt_name: 'New Prompt',
      input_admin_prompt: '',
      input_user_prompt: '',
      note: '',
      model: null,
      model_on: false,
      temperature: null,
      temperature_on: false,
      max_tokens: null,
      max_tokens_on: false,
      top_p: null,
      top_p_on: false,
      frequency_penalty: null,
      frequency_penalty_on: false,
      presence_penalty: null,
      presence_penalty_on: false,
      is_assistant: false,
      assistant_instructions: '',
      thread_mode: null,
      child_thread_strategy: null,
      default_child_thread_strategy: null,
      web_search_on: false,
      confluence_enabled: false,
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

    const newStructure = addToTree(structureWithId);
    onChange(newStructure);
    setExpandedNodes(prev => new Set([...prev, parentId]));
    setSelectedNodeId(newChild._id);
  }, [structureWithId, onChange]);

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

    const newStructure = removeFromTree(structureWithId);
    onChange(newStructure);
    if (selectedNodeId === nodeId) {
      setSelectedNodeId(null);
    }
  }, [structureWithId, onChange, selectedNodeId]);

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

    const newStructure = duplicateInTree(structureWithId);
    onChange(newStructure);
  }, [structureWithId, onChange]);

  // Move node up or down within its siblings
  const moveNode = useCallback((nodeId, direction) => {
    if (nodeId === 'root') return;

    const moveInTree = (node) => {
      if (!node) return node;
      if (node.children && node.children.length > 0) {
        const idx = node.children.findIndex(c => c._id === nodeId);
        if (idx !== -1) {
          const newChildren = [...node.children];
          const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
          if (targetIdx >= 0 && targetIdx < newChildren.length) {
            // Swap
            [newChildren[idx], newChildren[targetIdx]] = [newChildren[targetIdx], newChildren[idx]];
            return { ...node, children: newChildren };
          }
        }
        return {
          ...node,
          children: node.children.map(child => moveInTree(child))
        };
      }
      return node;
    };

    const newStructure = moveInTree(structureWithId);
    onChange(newStructure);
  }, [structureWithId, onChange]);

  // Drag-drop reorder: move draggedId to be a sibling of targetId at specified position
  const reorderNode = useCallback((draggedId, targetId, position = 'after') => {
    if (draggedId === targetId || draggedId === 'root') return;
    
    // Find dragged node and remove it from tree
    let draggedNode = null;
    
    const removeFromTree = (node) => {
      if (!node) return node;
      if (node.children && node.children.length > 0) {
        const idx = node.children.findIndex(c => c._id === draggedId);
        if (idx !== -1) {
          draggedNode = node.children[idx];
          const newChildren = [...node.children];
          newChildren.splice(idx, 1);
          return { ...node, children: newChildren };
        }
        return { ...node, children: node.children.map(c => removeFromTree(c)) };
      }
      return node;
    };
    
    // Insert node at target position
    const insertAtTarget = (node) => {
      if (!node) return node;
      if (node.children && node.children.length > 0) {
        const targetIdx = node.children.findIndex(c => c._id === targetId);
        if (targetIdx !== -1) {
          const newChildren = [...node.children];
          const insertIdx = position === 'before' ? targetIdx : targetIdx + 1;
          newChildren.splice(insertIdx, 0, draggedNode);
          return { ...node, children: newChildren };
        }
        return { ...node, children: node.children.map(c => insertAtTarget(c)) };
      }
      return node;
    };
    
    // First remove, then insert
    let newStructure = removeFromTree(structureWithId);
    if (draggedNode) {
      newStructure = insertAtTarget(newStructure);
      onChange(newStructure);
    }
  }, [structureWithId, onChange]);

  // Reparent: move draggedId to become a child of targetId
  const reparentNode = useCallback((draggedId, newParentId) => {
    if (draggedId === newParentId || draggedId === 'root') return;
    
    // Check if newParentId is a descendant of draggedId (would create cycle)
    const isDescendant = (parentNode, checkId) => {
      if (!parentNode) return false;
      if (parentNode._id === checkId) return true;
      if (parentNode.children) {
        return parentNode.children.some(child => isDescendant(child, checkId));
      }
      return false;
    };
    
    const draggedNodeData = findNode(structureWithId, draggedId)?.node;
    if (draggedNodeData && isDescendant(draggedNodeData, newParentId)) {
      return; // Can't reparent to own descendant
    }
    
    let draggedNode = null;
    
    // Remove from current location
    const removeFromTree = (node) => {
      if (!node) return node;
      if (node.children && node.children.length > 0) {
        const idx = node.children.findIndex(c => c._id === draggedId);
        if (idx !== -1) {
          draggedNode = node.children[idx];
          const newChildren = [...node.children];
          newChildren.splice(idx, 1);
          return { ...node, children: newChildren };
        }
        return { ...node, children: node.children.map(c => removeFromTree(c)) };
      }
      return node;
    };
    
    // Add as child of new parent
    const addToNewParent = (node) => {
      if (!node) return node;
      const currentId = node._id || 'root';
      if (currentId === newParentId) {
        const newChildren = [...(node.children || []), draggedNode];
        return { ...node, children: newChildren };
      }
      if (node.children) {
        return { ...node, children: node.children.map(c => addToNewParent(c)) };
      }
      return node;
    };
    
    let newStructure = removeFromTree(structureWithId);
    if (draggedNode) {
      newStructure = addToNewParent(newStructure);
      // Auto-expand the new parent
      setExpandedNodes(prev => new Set([...prev, newParentId]));
      onChange(newStructure);
    }
  }, [structureWithId, onChange, findNode]);

  // Get sibling info for a node (for move up/down buttons)
  const getSiblingInfo = useCallback((nodeId) => {
    if (nodeId === 'root') return { isFirst: true, isLast: true };
    
    const findInTree = (node) => {
      if (!node) return null;
      if (node.children && node.children.length > 0) {
        const idx = node.children.findIndex(c => c._id === nodeId);
        if (idx !== -1) {
          return {
            isFirst: idx === 0,
            isLast: idx === node.children.length - 1,
          };
        }
        for (const child of node.children) {
          const result = findInTree(child);
          if (result) return result;
        }
      }
      return null;
    };

    return findInTree(structureWithId) || { isFirst: true, isLast: true };
  }, [structureWithId]);

  // Start renaming a node
  const startRenaming = useCallback((nodeId, currentName) => {
    setRenamingNodeId(nodeId);
    setRenameValue(currentName || '');
  }, []);

  // Finish renaming
  const finishRenaming = useCallback(() => {
    if (renamingNodeId && renameValue.trim()) {
      updateNode(renamingNodeId, { prompt_name: renameValue.trim() });
    }
    setRenamingNodeId(null);
    setRenameValue('');
  }, [renamingNodeId, renameValue, updateNode]);

  // Cancel renaming
  const cancelRenaming = useCallback(() => {
    setRenamingNodeId(null);
    setRenameValue('');
  }, []);

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

  // Icon button for tree actions
  const TreeIconButton = ({ icon: Icon, onClick, tooltip, variant = 'default', disabled = false }) => (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={onClick}
          disabled={disabled}
          className={cn(
            "h-6 w-6 flex items-center justify-center rounded-m3-full transition-colors",
            disabled && "opacity-30 cursor-not-allowed",
            variant === 'destructive' 
              ? "text-red-500 hover:bg-red-500/10" 
              : "text-on-surface-variant hover:bg-surface-container hover:text-on-surface"
          )}
        >
          <Icon className="h-3 w-3" />
        </button>
      </TooltipTrigger>
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  );

  // Draggable tree node component
  const DraggableTreeNode = ({ node, depth = 0 }) => {
    if (!node) return null;
    const nodeId = node._id || 'root';
    const isExpanded = expandedNodes.has(nodeId);
    const isSelected = selectedNodeId === nodeId;
    const hasChildren = node.children && node.children.length > 0;
    const isRenaming = renamingNodeId === nodeId;
    const siblingInfo = getSiblingInfo(nodeId);
    const isRoot = nodeId === 'root';
    
    // Find variables in this node
    const nodeVariables = [
      ...extractVariables(node.input_admin_prompt),
      ...extractVariables(node.input_user_prompt),
    ];

    // Drag source - only non-root nodes can be dragged
    const [{ isDragging }, dragRef, previewRef] = useDrag({
      type: DRAG_TYPE,
      item: { id: nodeId, node },
      canDrag: !isRoot && !isRenaming,
      collect: (monitor) => ({
        isDragging: monitor.isDragging(),
      }),
    });

    // Track drop position for visual feedback
    const [dropPosition, setDropPosition] = useState(null); // 'before' | 'after' | 'child'

    // Drop target - supports reordering (edges) and reparenting (center)
    const [{ isOver, canDrop }, dropRef] = useDrop({
      accept: DRAG_TYPE,
      canDrop: (item) => {
        if (item.id === nodeId) return false;
        // Check if dropping on self's descendant (would create cycle)
        const isDescendant = (parentNode, checkId) => {
          if (!parentNode) return false;
          if (parentNode._id === checkId) return true;
          if (parentNode.children) {
            return parentNode.children.some(child => isDescendant(child, checkId));
          }
          return false;
        };
        return !isDescendant(item.node, nodeId);
      },
      hover: (item, monitor) => {
        if (!monitor.canDrop()) {
          setDropPosition(null);
          return;
        }
        const hoverBoundingRect = monitor.getClientOffset();
        const dropTargetRect = document.getElementById(`tree-node-${nodeId}`)?.getBoundingClientRect();
        if (!dropTargetRect || !hoverBoundingRect) {
          setDropPosition('child');
          return;
        }
        const hoverY = hoverBoundingRect.y - dropTargetRect.top;
        const height = dropTargetRect.height;
        const threshold = height * 0.25;
        
        if (hoverY < threshold) {
          setDropPosition('before');
        } else if (hoverY > height - threshold) {
          setDropPosition('after');
        } else {
          setDropPosition('child');
        }
      },
      drop: (item, monitor) => {
        if (monitor.didDrop()) return;
        
        if (dropPosition === 'child') {
          reparentNode(item.id, nodeId);
        } else if (dropPosition === 'before') {
          reorderNode(item.id, nodeId, 'before');
        } else {
          reorderNode(item.id, nodeId, 'after');
        }
        setDropPosition(null);
      },
      collect: (monitor) => ({
        isOver: monitor.isOver({ shallow: true }),
        canDrop: monitor.canDrop(),
      }),
    });

    // Reset drop position when not hovering
    useEffect(() => {
      if (!isOver) setDropPosition(null);
    }, [isOver]);

    // Combine refs
    const combinedRef = (el) => {
      previewRef(el);
      dropRef(el);
    };

    // Visual indicator styles based on drop position
    const getDropStyles = () => {
      if (!isOver || !canDrop || !dropPosition) return '';
      if (dropPosition === 'child') return 'ring-2 ring-primary bg-primary/10';
      if (dropPosition === 'before') return 'border-t-2 border-t-primary';
      if (dropPosition === 'after') return 'border-b-2 border-b-primary';
      return '';
    };

    return (
      <div key={nodeId} ref={combinedRef} className={cn(isDragging && "opacity-40")}>
        <div
          id={`tree-node-${nodeId}`}
          className={cn(
            "flex items-center gap-1 py-1.5 px-2 rounded-m3-sm cursor-pointer transition-colors group",
            isSelected ? "bg-secondary-container text-secondary-container-foreground" : "hover:bg-surface-container",
            getDropStyles(),
          )}
          style={{ paddingLeft: `${depth * 20 + 8}px` }}
          onClick={() => !isRenaming && setSelectedNodeId(nodeId)}
        >
          {/* Drag handle - only for non-root */}
          {!isRoot && !isRenaming && (
            <div
              ref={dragRef}
              className="cursor-grab active:cursor-grabbing p-0.5 text-on-surface-variant hover:text-on-surface"
              onClick={(e) => e.stopPropagation()}
            >
              <GripVertical className="h-3.5 w-3.5" />
            </div>
          )}
          
          {hasChildren ? (
            <button
              onClick={(e) => { e.stopPropagation(); toggleExpanded(nodeId); }}
              className="p-0.5 hover:bg-surface-container-high rounded-m3-sm"
            >
              {isExpanded ? <ChevronDown className="h-4 w-4 text-on-surface-variant" /> : <ChevronRight className="h-4 w-4 text-on-surface-variant" />}
            </button>
          ) : (
            <span className="w-5" />
          )}
          
          {isRenaming ? (
            <Input
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === 'Enter') finishRenaming();
                if (e.key === 'Escape') cancelRenaming();
              }}
              onBlur={finishRenaming}
              onClick={(e) => e.stopPropagation()}
              className="flex-1 h-6 text-tree py-0 px-1 bg-surface-container border-outline-variant"
              autoFocus
            />
          ) : (
            <span className="flex-1 text-tree truncate text-on-surface">{node.prompt_name || 'Untitled'}</span>
          )}
          
          {!isRenaming && node.is_assistant && (
            <span className="text-compact px-1 py-0.5 rounded bg-secondary-container text-secondary-container-foreground flex items-center">
              <Bot className="h-3 w-3" />
            </span>
          )}
          
          {!isRenaming && nodeVariables.length > 0 && (
            <span className="text-compact px-1 py-0.5 rounded border border-outline-variant text-on-surface-variant">
              {nodeVariables.length} var{nodeVariables.length > 1 ? 's' : ''}
            </span>
          )}
          
          {!isRenaming && (
            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
              <TreeIconButton
                icon={Plus}
                onClick={(e) => { e.stopPropagation(); addChild(nodeId); }}
                tooltip="Add child"
              />
              
              {!isRoot && (
                <>
                  <TreeIconButton
                    icon={ArrowUp}
                    onClick={(e) => { e.stopPropagation(); if (!siblingInfo.isFirst) moveNode(nodeId, 'up'); }}
                    tooltip="Move up"
                    disabled={siblingInfo.isFirst}
                  />
                  <TreeIconButton
                    icon={ArrowDown}
                    onClick={(e) => { e.stopPropagation(); if (!siblingInfo.isLast) moveNode(nodeId, 'down'); }}
                    tooltip="Move down"
                    disabled={siblingInfo.isLast}
                  />
                  <TreeIconButton
                    icon={Edit2}
                    onClick={(e) => { e.stopPropagation(); startRenaming(nodeId, node.prompt_name); }}
                    tooltip="Rename"
                  />
                  <TreeIconButton
                    icon={Copy}
                    onClick={(e) => { e.stopPropagation(); duplicateNode(nodeId); }}
                    tooltip="Duplicate"
                  />
                  <TreeIconButton
                    icon={Trash2}
                    onClick={(e) => { e.stopPropagation(); deleteNode(nodeId); }}
                    tooltip="Delete"
                    variant="destructive"
                  />
                </>
              )}
            </div>
          )}
        </div>
        
        {isExpanded && hasChildren && (
          <div>
            {node.children.map(child => <DraggableTreeNode key={child._id} node={child} depth={depth + 1} />)}
          </div>
        )}
      </div>
    );
  };

  return (
    <DndProvider backend={HTML5Backend}>
    <TooltipProvider>
    <div className="h-full flex">
      {/* Tree View */}
      <div className="w-72 border-r border-outline-variant flex flex-col bg-surface">
        <div className="p-3 border-b border-outline-variant flex items-center justify-between">
          <h4 className="text-tree text-on-surface font-medium">Prompt Hierarchy</h4>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => addChild('root')}
                className="w-8 h-8 flex items-center justify-center rounded-m3-full text-on-surface-variant hover:bg-surface-container transition-colors"
              >
                <Plus className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Add prompt</TooltipContent>
          </Tooltip>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-2">
            <DraggableTreeNode node={structureWithId} depth={0} />
          </div>
        </ScrollArea>
      </div>

      {/* Node Editor */}
      <div className="flex-1 overflow-auto bg-surface">
        {selectedNode ? (
          <NodeEditor
            node={selectedNode}
            onUpdate={(updates) => updateNode(selectedNodeId, updates)}
            variableDefinitions={variableDefinitions}
            isRoot={selectedNodeId === 'root'}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-on-surface-variant text-tree">
            Select a node to edit its settings
          </div>
        )}
      </div>
    </div>
    </TooltipProvider>
    </DndProvider>
  );
};

/**
 * Tab button for node editor sections
 */
const TabButton = ({ icon: Icon, label, isActive, onClick }) => (
  <Tooltip>
    <TooltipTrigger asChild>
      <button
        onClick={onClick}
        className={cn(
          "h-8 w-9 flex items-center justify-center rounded-m3-sm transition-all duration-200",
          isActive 
            ? "bg-secondary-container text-secondary-container-foreground" 
            : "text-on-surface-variant hover:bg-surface-container"
        )}
      >
        <Icon className="h-4 w-4" />
      </button>
    </TooltipTrigger>
    <TooltipContent className="text-[10px]">{label}</TooltipContent>
  </Tooltip>
);

/**
 * Comprehensive editor for a single node with all settings
 */
const NodeEditor = ({ node, onUpdate, variableDefinitions, isRoot }) => {
  const [activeSection, setActiveSection] = useState('prompts');
  const { models } = useModels();
  
  // Transform variable definitions for ResizablePromptArea
  const transformedVariables = useMemo(() => {
    if (!variableDefinitions) return [];
    return variableDefinitions.map(v => ({
      variable_name: v.name || v.variable_name,
      variable_value: v.default_value || v.value || '',
      type: v.type || 'text'
    }));
  }, [variableDefinitions]);

  const sections = [
    { id: 'prompts', label: 'Prompts', icon: MessageSquare },
    { id: 'model', label: 'Model Settings', icon: Settings2 },
    { id: 'conversation', label: 'Conversation', icon: Bot },
    { id: 'tools', label: 'Tools', icon: Wrench },
  ];

  return (
    <div className="h-full flex flex-col">
      {/* Section Tabs */}
      <div className="flex items-center gap-1 p-2 border-b border-outline-variant bg-surface-container-low">
        {sections.map(section => (
          <TabButton 
            key={section.id}
            icon={section.icon}
            label={section.label}
            isActive={activeSection === section.id}
            onClick={() => setActiveSection(section.id)}
          />
        ))}
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4 max-w-2xl">
          {activeSection === 'prompts' && (
            <PromptsSection 
              node={node} 
              onUpdate={onUpdate} 
              variables={transformedVariables}
            />
          )}

          {activeSection === 'model' && (
            <ModelSettingsSection 
              node={node} 
              onUpdate={onUpdate} 
              models={models}
            />
          )}

          {activeSection === 'conversation' && (
            <ConversationSection 
              node={node} 
              onUpdate={onUpdate}
              isRoot={isRoot}
            />
          )}

          {activeSection === 'tools' && (
            <ToolsSection 
              node={node} 
              onUpdate={onUpdate}
            />
          )}
        </div>
      </ScrollArea>
    </div>
  );
};

/**
 * Prompts section - matching prompt editor patterns
 */
const PromptsSection = ({ node, onUpdate, variables }) => {
  return (
    <div className="space-y-4">
      {/* Prompt Name */}
      <SettingCard label="Prompt Name">
        <Input
          value={node.prompt_name || ''}
          onChange={(e) => onUpdate({ prompt_name: e.target.value })}
          placeholder="Enter prompt name"
          className="h-8 bg-surface-container border-outline-variant text-tree text-on-surface"
        />
      </SettingCard>

      {/* System Prompt */}
      <ResizablePromptArea 
        label="System Prompt"
        value={node.input_admin_prompt || ''}
        placeholder="System instructions for the AI..."
        defaultHeight={160}
        onSave={(value) => onUpdate({ input_admin_prompt: value })}
        variables={variables}
      />

      {/* User Prompt */}
      <ResizablePromptArea 
        label="User Prompt"
        value={node.input_user_prompt || ''}
        placeholder="User message template..."
        defaultHeight={80}
        onSave={(value) => onUpdate({ input_user_prompt: value })}
        variables={variables}
      />

      {/* Notes */}
      <MarkdownNotesArea 
        label="Notes"
        value={node.note || ''}
        placeholder="Internal notes about this prompt..."
        defaultHeight={80}
        onSave={(value) => onUpdate({ note: value })}
      />
    </div>
  );
};

/**
 * Model settings section - matching prompt editor patterns
 */
const ModelSettingsSection = ({ node, onUpdate, models }) => {
  const { getModelConfig } = useModels();
  const sliderDebounceRef = useRef({});

  const currentModel = node?.model || '';
  const modelConfig = getModelConfig(currentModel);
  const currentModelData = models?.find(m => m.model_id === currentModel);
  const supportedSettings = currentModelData?.supported_settings || modelConfig?.supportedSettings || [];

  // Local state for sliders
  const [temperature, setTemperature] = useState([parseFloat(node?.temperature || '0.7')]);
  const [topP, setTopP] = useState([parseFloat(node?.top_p || '1')]);
  const [frequencyPenalty, setFrequencyPenalty] = useState([parseFloat(node?.frequency_penalty || '0')]);
  const [presencePenalty, setPresencePenalty] = useState([parseFloat(node?.presence_penalty || '0')]);

  // Sync state when node changes
  useEffect(() => {
    setTemperature([parseFloat(node?.temperature || '0.7')]);
  }, [node?.temperature]);

  useEffect(() => {
    setTopP([parseFloat(node?.top_p || '1')]);
  }, [node?.top_p]);

  useEffect(() => {
    setFrequencyPenalty([parseFloat(node?.frequency_penalty || '0')]);
  }, [node?.frequency_penalty]);

  useEffect(() => {
    setPresencePenalty([parseFloat(node?.presence_penalty || '0')]);
  }, [node?.presence_penalty]);

  // Debounced slider change handler
  const handleSliderChange = (field, value, setter) => {
    setter(value);
    
    if (sliderDebounceRef.current[field]) {
      clearTimeout(sliderDebounceRef.current[field]);
    }
    
    sliderDebounceRef.current[field] = setTimeout(() => {
      onUpdate({ [field]: String(value[0]) });
    }, 500);
  };

  const hasSetting = (setting) => supportedSettings.includes(setting);

  return (
    <div className="space-y-4">
      {/* Model Selection */}
      <SettingCard label="Model">
        <SettingRow label="Override Model">
          <Switch
            checked={node.model_on || false}
            onCheckedChange={(checked) => onUpdate({ model_on: checked })}
          />
        </SettingRow>
        {node.model_on && (
          <SettingModelSelect
            value={node.model || ''}
            onValueChange={(v) => onUpdate({ model: v })}
            models={models || []}
          />
        )}
      </SettingCard>

      {/* Supported settings tags */}
      {supportedSettings.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {supportedSettings.map(setting => (
            <span key={setting} className="text-[9px] px-1.5 py-0.5 bg-surface-container rounded text-on-surface-variant">
              {setting.replace(/_/g, ' ')}
            </span>
          ))}
        </div>
      )}

      {/* Model Parameters */}
      <SettingCard label="Parameters">
        {/* Temperature */}
        <SettingRow label="Temperature">
          <Switch
            checked={node.temperature_on || false}
            onCheckedChange={(checked) => onUpdate({ temperature_on: checked })}
          />
        </SettingRow>
        {node.temperature_on && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-compact text-on-surface-variant">Value</span>
              <span className="text-tree text-on-surface font-mono">{temperature[0]}</span>
            </div>
            <Slider
              value={temperature}
              onValueChange={(v) => handleSliderChange('temperature', v, setTemperature)}
              max={2}
              step={0.1}
              className="w-full"
            />
            <div className="flex justify-between text-compact text-on-surface-variant">
              <span>Precise</span>
              <span>Creative</span>
            </div>
          </div>
        )}

        <SettingDivider />

        {/* Max Tokens */}
        <SettingRow label="Max Tokens">
          <Switch
            checked={node.max_tokens_on || false}
            onCheckedChange={(checked) => onUpdate({ max_tokens_on: checked })}
          />
        </SettingRow>
        {node.max_tokens_on && (
          <Input
            type="number"
            value={node.max_tokens || ''}
            onChange={(e) => onUpdate({ max_tokens: e.target.value })}
            placeholder="4096"
            min={1}
            className="h-8 bg-surface-container border-outline-variant text-tree text-on-surface"
          />
        )}

        <SettingDivider />

        {/* Top P */}
        <SettingRow label="Top P">
          <Switch
            checked={node.top_p_on || false}
            onCheckedChange={(checked) => onUpdate({ top_p_on: checked })}
          />
        </SettingRow>
        {node.top_p_on && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-compact text-on-surface-variant">Value</span>
              <span className="text-tree text-on-surface font-mono">{topP[0]}</span>
            </div>
            <Slider
              value={topP}
              onValueChange={(v) => handleSliderChange('top_p', v, setTopP)}
              max={1}
              step={0.05}
              className="w-full"
            />
          </div>
        )}

        <SettingDivider />

        {/* Frequency Penalty */}
        <SettingRow label="Frequency Penalty">
          <Switch
            checked={node.frequency_penalty_on || false}
            onCheckedChange={(checked) => onUpdate({ frequency_penalty_on: checked })}
          />
        </SettingRow>
        {node.frequency_penalty_on && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-compact text-on-surface-variant">Value</span>
              <span className="text-tree text-on-surface font-mono">{frequencyPenalty[0]}</span>
            </div>
            <Slider
              value={frequencyPenalty}
              onValueChange={(v) => handleSliderChange('frequency_penalty', v, setFrequencyPenalty)}
              min={-2}
              max={2}
              step={0.1}
              className="w-full"
            />
          </div>
        )}

        <SettingDivider />

        {/* Presence Penalty */}
        <SettingRow label="Presence Penalty">
          <Switch
            checked={node.presence_penalty_on || false}
            onCheckedChange={(checked) => onUpdate({ presence_penalty_on: checked })}
          />
        </SettingRow>
        {node.presence_penalty_on && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-compact text-on-surface-variant">Value</span>
              <span className="text-tree text-on-surface font-mono">{presencePenalty[0]}</span>
            </div>
            <Slider
              value={presencePenalty}
              onValueChange={(v) => handleSliderChange('presence_penalty', v, setPresencePenalty)}
              min={-2}
              max={2}
              step={0.1}
              className="w-full"
            />
          </div>
        )}
      </SettingCard>

      {/* Advanced Settings */}
      <SettingCard label="Advanced">
        <SettingRow label="Stop Sequences">
          <Switch
            checked={node.stop_on || false}
            onCheckedChange={(checked) => onUpdate({ stop_on: checked })}
          />
        </SettingRow>
        {node.stop_on && (
          <Input
            value={node.stop || ''}
            onChange={(e) => onUpdate({ stop: e.target.value })}
            placeholder="Enter stop sequences"
            className="h-8 bg-surface-container border-outline-variant text-tree text-on-surface"
          />
        )}

        <SettingDivider />

        <SettingRow label="Response Format">
          <Switch
            checked={node.response_format_on || false}
            onCheckedChange={(checked) => onUpdate({ response_format_on: checked })}
          />
        </SettingRow>
        {node.response_format_on && (
          <Input
            value={node.response_format || ''}
            onChange={(e) => onUpdate({ response_format: e.target.value })}
            placeholder="json_object"
            className="h-8 bg-surface-container border-outline-variant text-tree text-on-surface"
          />
        )}
      </SettingCard>
    </div>
  );
};

/**
 * Conversation configuration section
 */
const ConversationSection = ({ node, onUpdate, isRoot }) => {
  const threadModeOptions = [
    { value: 'inherit', label: 'Inherit from parent' },
    { value: 'isolated', label: 'Isolated (new thread each time)' },
    { value: 'persistent', label: 'Persistent (continue conversation)' },
  ];

  const childStrategyOptions = [
    { value: 'inherit', label: 'Inherit from parent' },
    { value: 'isolated', label: 'Isolated' },
    { value: 'shared', label: 'Shared with parent' },
  ];

  const defaultStrategyOptions = [
    { value: 'isolated', label: 'Isolated' },
    { value: 'shared', label: 'Shared' },
  ];

  return (
    <div className="space-y-4">
      {/* Conversation Mode Toggle */}
      <SettingCard>
        <SettingRow 
          label="Conversation Mode" 
          description="Enable conversation features with context memory"
        >
          <Switch
            checked={node.is_assistant || false}
            onCheckedChange={(checked) => onUpdate({ is_assistant: checked })}
          />
        </SettingRow>
      </SettingCard>

      {node.is_assistant && (
        <>
          {/* Instructions */}
          <ResizablePromptArea 
            label="Conversation Instructions"
            value={node.assistant_instructions || ''}
            placeholder="You are a helpful assistant that..."
            defaultHeight={120}
            onSave={(value) => onUpdate({ assistant_instructions: value })}
          />

          {/* Thread Settings */}
          <SettingCard label="Thread Settings">
            <SettingRow label="Thread Mode" />
            <SettingSelect
              value={node.thread_mode || 'inherit'}
              onValueChange={(v) => onUpdate({ thread_mode: v === 'inherit' ? null : v })}
              options={threadModeOptions}
            />

            <SettingDivider />

            <SettingRow label="Child Thread Strategy" />
            <SettingSelect
              value={node.child_thread_strategy || 'inherit'}
              onValueChange={(v) => onUpdate({ child_thread_strategy: v === 'inherit' ? null : v })}
              options={childStrategyOptions}
            />

            {isRoot && (
              <>
                <SettingDivider />
                <SettingRow label="Default Child Strategy" description="Default for new child prompts" />
                <SettingSelect
                  value={node.default_child_thread_strategy || 'isolated'}
                  onValueChange={(v) => onUpdate({ default_child_thread_strategy: v })}
                  options={defaultStrategyOptions}
                />
              </>
            )}
          </SettingCard>
        </>
      )}
    </div>
  );
};

/**
 * Tools section
 */
const ToolsSection = ({ node, onUpdate }) => (
  <div className="space-y-4">
    <SettingCard label="AI Tools">
      <SettingRow 
        label="Web Search" 
        description="Enable web search capability"
      >
        <Switch
          checked={node.web_search_on || false}
          onCheckedChange={(checked) => onUpdate({ web_search_on: checked })}
        />
      </SettingRow>

      <SettingDivider />

      <SettingRow 
        label="Confluence Integration" 
        description="Enable Confluence page access"
      >
        <Switch
          checked={node.confluence_enabled || false}
          onCheckedChange={(checked) => onUpdate({ confluence_enabled: checked })}
        />
      </SettingRow>
    </SettingCard>

    {/* Info Card */}
    <SettingCard>
      <div className="flex items-start gap-3">
        <BookOpen className="h-4 w-4 text-on-surface-variant shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="text-tree text-on-surface font-medium">File attachments & Confluence pages</p>
          <p className="text-compact text-on-surface-variant">
            File attachments and specific Confluence page links are configured after creating the prompt from this template.
            The template defines the structure and default settings.
          </p>
        </div>
      </div>
    </SettingCard>
  </div>
);

export default TemplateStructureEditor;
