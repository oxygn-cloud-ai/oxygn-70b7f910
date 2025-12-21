import React, { useState, useCallback, useRef } from 'react';
import { ChevronRight, ChevronDown, Plus, Trash2, Copy, Settings2, Bot, MessageSquare, Wrench, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import HighlightedTextarea from '@/components/ui/highlighted-textarea';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { v4 as uuidv4 } from 'uuid';
import { useModels } from '@/hooks/useModels';
import VariablePicker from '@/components/VariablePicker';

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
      thread_mode: null,
      child_thread_strategy: null,
      default_child_thread_strategy: null,
      web_search_on: false,
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
            "flex items-center gap-1 py-1.5 px-2 rounded cursor-pointer transition-colors group",
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
          
          {node.is_assistant && (
            <Badge variant="secondary" className="text-[10px] px-1">
              <Bot className="h-3 w-3" />
            </Badge>
          )}
          
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
          <div className="p-2">
            {renderNode(structureWithId)}
          </div>
        </ScrollArea>
      </div>

      {/* Node Editor */}
      <div className="flex-1 overflow-auto">
        {selectedNode ? (
          <NodeEditor
            node={selectedNode}
            onUpdate={(updates) => updateNode(selectedNodeId, updates)}
            variableDefinitions={variableDefinitions}
            isRoot={selectedNodeId === 'root'}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
            Select a node to edit its settings
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * Comprehensive editor for a single node with all settings
 */
const NodeEditor = ({ node, onUpdate, variableDefinitions, isRoot }) => {
  const [activeSection, setActiveSection] = useState('prompts');
  const { models } = useModels();
  
  // Refs for textarea cursor position tracking
  const adminPromptRef = useRef(null);
  const userPromptRef = useRef(null);
  const cursorPositions = useRef({ input_admin_prompt: 0, input_user_prompt: 0 });

  const insertVariable = (field, varName) => {
    const currentValue = node[field] || '';
    const varText = `{{${varName}}}`;
    const pos = cursorPositions.current[field] || currentValue.length;
    const newValue = currentValue.slice(0, pos) + varText + currentValue.slice(pos);
    onUpdate({ [field]: newValue });
    
    // Update cursor position to after inserted variable
    cursorPositions.current[field] = pos + varText.length;
  };
  
  const handleCursorChange = (field) => (e) => {
    cursorPositions.current[field] = e.target.selectionStart;
  };

  const sections = [
    { id: 'prompts', label: 'Prompts', icon: MessageSquare },
    { id: 'model', label: 'Model Settings', icon: Settings2 },
    { id: 'assistant', label: 'Assistant', icon: Bot },
    { id: 'tools', label: 'Tools', icon: Wrench },
  ];

  return (
    <div className="h-full flex flex-col">
      {/* Section Tabs */}
      <div className="flex items-center gap-1 p-2 border-b border-border bg-muted/30">
        {sections.map(section => (
          <Button
            key={section.id}
            size="sm"
            variant={activeSection === section.id ? 'secondary' : 'ghost'}
            onClick={() => setActiveSection(section.id)}
            className="h-8"
          >
            <section.icon className="h-4 w-4 mr-1.5" />
            {section.label}
          </Button>
        ))}
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-6 max-w-2xl">
          {activeSection === 'prompts' && (
            <PromptsSection 
              node={node} 
              onUpdate={onUpdate} 
              variableDefinitions={variableDefinitions}
              insertVariable={insertVariable}
              adminPromptRef={adminPromptRef}
              userPromptRef={userPromptRef}
              onCursorChange={handleCursorChange}
            />
          )}

          {activeSection === 'model' && (
            <ModelSettingsSection 
              node={node} 
              onUpdate={onUpdate} 
              models={models}
            />
          )}

          {activeSection === 'assistant' && (
            <AssistantSection 
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
 * Prompts section - name, admin prompt, user prompt, note
 */
const PromptsSection = ({ node, onUpdate, variableDefinitions, insertVariable, adminPromptRef, userPromptRef, onCursorChange }) => (
  <div className="space-y-4">
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
        <VariablePicker 
          onInsert={(varName) => insertVariable('input_admin_prompt', varName)}
          userVariables={variableDefinitions}
        />
      </div>
      <HighlightedTextarea
        ref={adminPromptRef}
        value={node.input_admin_prompt || ''}
        onChange={(e) => {
          onUpdate({ input_admin_prompt: e.target.value });
          onCursorChange('input_admin_prompt')(e);
        }}
        onSelect={onCursorChange('input_admin_prompt')}
        onClick={onCursorChange('input_admin_prompt')}
        onKeyUp={onCursorChange('input_admin_prompt')}
        placeholder="System instructions for the AI..."
        rows={6}
      />
    </div>

    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>User Prompt</Label>
        <VariablePicker 
          onInsert={(varName) => insertVariable('input_user_prompt', varName)}
          userVariables={variableDefinitions}
        />
      </div>
      <HighlightedTextarea
        ref={userPromptRef}
        value={node.input_user_prompt || ''}
        onChange={(e) => {
          onUpdate({ input_user_prompt: e.target.value });
          onCursorChange('input_user_prompt')(e);
        }}
        onSelect={onCursorChange('input_user_prompt')}
        onClick={onCursorChange('input_user_prompt')}
        onKeyUp={onCursorChange('input_user_prompt')}
        placeholder="User message template..."
        rows={4}
      />
    </div>

    <div className="space-y-2">
      <Label>Notes</Label>
      <Textarea
        value={node.note || ''}
        onChange={(e) => onUpdate({ note: e.target.value })}
        placeholder="Internal notes about this prompt..."
        rows={2}
        className="text-sm"
      />
    </div>
  </div>
);

/**
 * Model settings section
 */
const ModelSettingsSection = ({ node, onUpdate, models }) => {
  const SettingRow = ({ label, field, type = 'text', min, max, step, options }) => {
    const isOn = node[`${field}_on`] || false;
    const value = node[field];

    const handleToggle = (checked) => {
      onUpdate({ [`${field}_on`]: checked });
    };

    const handleValueChange = (newValue) => {
      onUpdate({ [field]: newValue });
    };

    return (
      <div className="flex items-center gap-3 py-2">
        <Switch
          checked={isOn}
          onCheckedChange={handleToggle}
          className="scale-75"
        />
        <div className="flex-1 min-w-0">
          <Label className={cn("text-sm", !isOn && "text-muted-foreground")}>{label}</Label>
          {type === 'slider' && isOn && (
            <div className="flex items-center gap-2 mt-1">
              <Slider
                value={[parseFloat(value) || min]}
                min={min}
                max={max}
                step={step}
                onValueChange={([v]) => handleValueChange(String(v))}
                className="flex-1"
              />
              <span className="text-xs text-muted-foreground w-10 text-right">{value || min}</span>
            </div>
          )}
          {type === 'text' && isOn && (
            <Input
              value={value || ''}
              onChange={(e) => handleValueChange(e.target.value)}
              className="h-8 mt-1"
              placeholder="Enter value"
            />
          )}
          {type === 'number' && isOn && (
            <Input
              type="number"
              value={value || ''}
              onChange={(e) => handleValueChange(e.target.value)}
              className="h-8 mt-1"
              placeholder="Enter value"
              min={min}
              max={max}
            />
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Model Selection */}
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <Switch
            checked={node.model_on || false}
            onCheckedChange={(checked) => onUpdate({ model_on: checked })}
            className="scale-75"
          />
          <Label className={cn(!node.model_on && "text-muted-foreground")}>Model</Label>
        </div>
        {node.model_on && (
          <Select value={node.model || ''} onValueChange={(v) => onUpdate({ model: v })}>
            <SelectTrigger>
              <SelectValue placeholder="Select model" />
            </SelectTrigger>
            <SelectContent>
              {models?.map(m => (
                <SelectItem key={m.model_id} value={m.model_id}>
                  {m.model_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      <Separator />

      <SettingRow label="Temperature" field="temperature" type="slider" min={0} max={2} step={0.1} />
      <SettingRow label="Max Tokens" field="max_tokens" type="number" min={1} />
      <SettingRow label="Top P" field="top_p" type="slider" min={0} max={1} step={0.05} />
      <SettingRow label="Frequency Penalty" field="frequency_penalty" type="slider" min={-2} max={2} step={0.1} />
      <SettingRow label="Presence Penalty" field="presence_penalty" type="slider" min={-2} max={2} step={0.1} />
      
      <Separator />

      <SettingRow label="Stop Sequences" field="stop" type="text" />
      <SettingRow label="Response Format" field="response_format" type="text" />
      <SettingRow label="N (completions)" field="n" type="number" min={1} max={10} />
    </div>
  );
};

/**
 * Assistant configuration section
 */
const AssistantSection = ({ node, onUpdate, isRoot }) => (
  <div className="space-y-4">
    <div className="flex items-center justify-between py-2">
      <div>
        <Label>Assistant Mode</Label>
        <p className="text-xs text-muted-foreground">Enable OpenAI Assistant features</p>
      </div>
      <Switch
        checked={node.is_assistant || false}
        onCheckedChange={(checked) => onUpdate({ is_assistant: checked })}
      />
    </div>

    {node.is_assistant && (
      <>
        <Separator />

        <div className="space-y-2">
          <Label>Thread Mode</Label>
          <Select 
            value={node.thread_mode || 'inherit'} 
            onValueChange={(v) => onUpdate({ thread_mode: v === 'inherit' ? null : v })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Inherit from parent" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="inherit">Inherit from parent</SelectItem>
              <SelectItem value="isolated">Isolated (new thread each time)</SelectItem>
              <SelectItem value="persistent">Persistent (continue conversation)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Child Thread Strategy</Label>
          <Select 
            value={node.child_thread_strategy || 'inherit'} 
            onValueChange={(v) => onUpdate({ child_thread_strategy: v === 'inherit' ? null : v })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Inherit from parent" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="inherit">Inherit from parent</SelectItem>
              <SelectItem value="isolated">Isolated</SelectItem>
              <SelectItem value="shared">Shared with parent</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isRoot && (
          <div className="space-y-2">
            <Label>Default Child Thread Strategy</Label>
            <p className="text-xs text-muted-foreground">Default for new child prompts</p>
            <Select 
              value={node.default_child_thread_strategy || 'isolated'} 
              onValueChange={(v) => onUpdate({ default_child_thread_strategy: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="isolated">Isolated</SelectItem>
                <SelectItem value="shared">Shared</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      </>
    )}
  </div>
);

/**
 * Tools section
 */
const ToolsSection = ({ node, onUpdate }) => (
  <div className="space-y-4">
    <div className="flex items-center justify-between py-2">
      <div>
        <Label>Web Search</Label>
        <p className="text-xs text-muted-foreground">Enable web search capability</p>
      </div>
      <Switch
        checked={node.web_search_on || false}
        onCheckedChange={(checked) => onUpdate({ web_search_on: checked })}
      />
    </div>

    <div className="flex items-center justify-between py-2">
      <div>
        <Label>Confluence Integration</Label>
        <p className="text-xs text-muted-foreground">Enable Confluence page access</p>
      </div>
      <Switch
        checked={node.confluence_enabled || false}
        onCheckedChange={(checked) => onUpdate({ confluence_enabled: checked })}
      />
    </div>

    <Separator />

    <div className="p-3 rounded-lg bg-muted/50 text-sm text-muted-foreground">
      <p className="font-medium text-foreground mb-1">File attachments & Confluence pages</p>
      <p>
        File attachments and specific Confluence page links are configured after creating the prompt from this template.
        The template defines the structure and default settings.
      </p>
    </div>
  </div>
);

export default TemplateStructureEditor;
