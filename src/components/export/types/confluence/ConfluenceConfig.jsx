import React, { useState, useCallback } from 'react';
import { ChevronDown, ChevronRight, FileText, Folder, FolderOpen, Home, Loader2, File, Type, Globe, FolderTree, LayoutTemplate } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ConfluenceTemplateMapper } from './ConfluenceTemplateMapper';
import { VariableSourcePicker } from './VariableSourcePicker';

const PageTreeNode = ({ 
  node, 
  level = 0, 
  selectedId, 
  onSelect, 
  expandedIds, 
  onToggleExpand,
  loadingNodes,
  spaceKey 
}) => {
  const isSelected = selectedId === node.id;
  const isExpanded = expandedIds.includes(node.id);
  const hasChildren = node.children && node.children.length > 0;
  const isFolder = node.isFolder || node.type === 'folder';
  const isContainer = node.isContainer;
  const isBlogContainer = node.isBlogContainer;
  const isLoading = loadingNodes?.has(node.id);

  // For containers: render children directly without the container wrapper
  // But allow blog containers to show their children
  if (isContainer && !isBlogContainer) {
    return null;
  }

  // For blog containers, render a non-selectable header and its children
  if (isBlogContainer) {
    return (
      <div>
        <div
          className="flex items-center gap-1.5 py-1.5 px-2 rounded-lg text-sm text-muted-foreground"
          style={{ paddingLeft: `${level * 12 + 8}px` }}
        >
          {hasChildren ? (
            <button onClick={(e) => { e.stopPropagation(); onToggleExpand(node.id, node.type); }} className="p-0.5 hover:bg-muted rounded">
              {isLoading ? (
                <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
              ) : isExpanded ? (
                <ChevronDown className="h-3 w-3 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-3 w-3 text-muted-foreground" />
              )}
            </button>
          ) : (
            <div className="w-4" />
          )}
          <Folder className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="truncate italic">{node.title}</span>
        </div>
        {hasChildren && isExpanded && (
          <div>
            {node.children.map(child => (
              <PageTreeNode
                key={child.id}
                node={child}
                level={level + 1}
                selectedId={selectedId}
                onSelect={onSelect}
                expandedIds={expandedIds}
                onToggleExpand={onToggleExpand}
                loadingNodes={loadingNodes}
                spaceKey={spaceKey}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  const handleClick = () => {
    onSelect(node.id);
  };

  const handleExpandClick = (e) => {
    e.stopPropagation();
    onToggleExpand(node.id, node.type);
  };

  const getIcon = () => {
    if (node.isHomepage) return <Home className="h-3.5 w-3.5 text-primary" />;
    if (isFolder) {
      return isExpanded 
        ? <FolderOpen className="h-3.5 w-3.5 text-amber-500" />
        : <Folder className="h-3.5 w-3.5 text-amber-500" />;
    }
    return <File className="h-3.5 w-3.5 text-muted-foreground" />;
  };

  // Check if this node can have children (folders and pages can)
  const canHaveChildren = isFolder || node.type === 'page' || (!node.loaded && !hasChildren);

  return (
    <div>
      <div
        onClick={handleClick}
        className={cn(
          "flex items-center gap-1.5 py-1.5 px-2 rounded-lg cursor-pointer transition-all text-sm",
          isSelected 
            ? "bg-primary/10 text-primary border border-primary/20" 
            : "hover:bg-muted border border-transparent text-foreground"
        )}
        style={{ paddingLeft: `${level * 12 + 8}px` }}
      >
        {canHaveChildren ? (
          <button onClick={handleExpandClick} className="p-0.5 hover:bg-muted rounded">
            {isLoading ? (
              <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
            ) : isExpanded ? (
              <ChevronDown className="h-3 w-3 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-3 w-3 text-muted-foreground" />
            )}
          </button>
        ) : (
          <div className="w-4" />
        )}
        {getIcon()}
        <span className="truncate">{node.title}</span>
      </div>

      {hasChildren && isExpanded && (
        <div>
          {node.children.map(child => (
            <PageTreeNode
              key={child.id}
              node={child}
              level={level + 1}
              selectedId={selectedId}
              onSelect={onSelect}
              expandedIds={expandedIds}
              onToggleExpand={onToggleExpand}
              loadingNodes={loadingNodes}
              spaceKey={spaceKey}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export const ConfluenceConfig = ({
  spaces,
  templates,
  spaceTree,
  selectedSpaceKey,
  selectedParentId,
  selectedTemplate,
  templateMappings,
  pageTitle,
  useBlankPage,
  pageTitleSource,
  isLoadingTree,
  isLoadingTemplates,
  promptsData,
  variablesData,
  selectedFields,
  selectedVariables,
  onSelectSpace,
  onSelectParent,
  onSelectTemplate,
  onChooseBlankPage,
  onUpdateMapping,
  onSetPageTitle,
  onSetPageTitleSource,
  onGetPageChildren,
  onSetSpaceTree,
  STANDARD_FIELDS
}) => {
  const [expandedIds, setExpandedIds] = useState([]);
  const [loadingNodes, setLoadingNodes] = useState(new Set());
  const [titleMode, setTitleMode] = useState(pageTitleSource ? 'variable' : 'static');

  // Sync titleMode with pageTitleSource when it changes externally
  React.useEffect(() => {
    if (pageTitleSource && titleMode !== 'variable') {
      setTitleMode('variable');
    } else if (!pageTitleSource && titleMode !== 'static') {
      setTitleMode('static');
    }
  }, [pageTitleSource]);

  // Helper to update a node in the tree
  const updateNodeInTree = useCallback((tree, nodeId, updates) => {
    return tree.map(node => {
      if (node.id === nodeId) {
        return { ...node, ...updates };
      }
      if (node.children?.length) {
        return {
          ...node,
          children: updateNodeInTree(node.children, nodeId, updates)
        };
      }
      return node;
    });
  }, []);

  const handleToggleExpand = useCallback(async (id, nodeType) => {
    const isCurrentlyExpanded = expandedIds.includes(id);
    
    if (isCurrentlyExpanded) {
      // Collapse
      setExpandedIds(prev => prev.filter(x => x !== id));
      return;
    }

    // Find the node in the tree
    const findNode = (nodes) => {
      for (const node of nodes) {
        if (node.id === id) return node;
        if (node.children?.length) {
          const found = findNode(node.children);
          if (found) return found;
        }
      }
      return null;
    };

    const node = findNode(spaceTree);
    
    // If node already has children loaded, just expand
    if (node?.children?.length > 0 || node?.loaded) {
      setExpandedIds(prev => [...prev, id]);
      return;
    }

    // Need to fetch children
    if (onGetPageChildren && selectedSpaceKey) {
      setLoadingNodes(prev => new Set([...prev, id]));
      
      try {
        const children = await onGetPageChildren(id, selectedSpaceKey, nodeType || node?.type || 'page');
        
        if (children && onSetSpaceTree) {
          // Update the tree with the new children
          const updatedTree = updateNodeInTree(spaceTree, id, {
            children: children,
            loaded: true
          });
          onSetSpaceTree(updatedTree);
        }
        
        setExpandedIds(prev => [...prev, id]);
      } catch (error) {
        console.error('[ConfluenceConfig] Failed to load children:', error);
      } finally {
        setLoadingNodes(prev => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }
    } else {
      // No fetch function, just expand
      setExpandedIds(prev => [...prev, id]);
    }
  }, [expandedIds, spaceTree, selectedSpaceKey, onGetPageChildren, onSetSpaceTree, updateNodeInTree]);

  const selectedParentNode = React.useMemo(() => {
    if (!selectedParentId) return null;
    const findNode = (nodes) => {
      for (const node of nodes) {
        if (node.id === selectedParentId) return node;
        if (node.children?.length) {
          const found = findNode(node.children);
          if (found) return found;
        }
      }
      return null;
    };
    return findNode(spaceTree);
  }, [selectedParentId, spaceTree]);

  const handleTitleModeChange = (mode) => {
    setTitleMode(mode);
    if (mode === 'static') {
      onSetPageTitleSource?.(null);
    }
  };

  // Get preview of dynamic title
  const getDynamicTitlePreview = () => {
    if (!pageTitleSource || !promptsData?.length) return null;
    const prompt = promptsData.find(p => p.row_id === pageTitleSource.promptId);
    if (!prompt) return null;
    
    let value = '';
    if (pageTitleSource.sourceType === 'field') {
      value = prompt[pageTitleSource.sourceId] || '';
    } else if (pageTitleSource.sourceType === 'variable') {
      // Variables are in variablesData, not in promptsData directly
      const promptVars = variablesData?.[pageTitleSource.promptId] || [];
      const variable = promptVars.find(v => v.variable_name === pageTitleSource.sourceId);
      value = variable?.variable_value || variable?.default_value || '';
    }
    return value ? `Preview: "${value.substring(0, 50)}${value.length > 50 ? '...' : ''}"` : null;
  };

  return (
    <div className="space-y-4">
      {/* Page Title Card */}
      <div className="border border-border/50 rounded-xl p-4 bg-card/50 space-y-3">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Type className="h-4 w-4 text-primary" />
          </div>
          <div>
            <Label className="text-sm font-semibold">Page Title</Label>
            <p className="text-xs text-muted-foreground">Set a static title or use a variable value. If the name exists, a number will be appended automatically.</p>
          </div>
        </div>
        
        {/* Title Mode Toggle */}
        <div className="flex gap-2">
          <button
            onClick={() => handleTitleModeChange('static')}
            className={cn(
              "flex-1 py-2 px-3 rounded-lg border-2 text-xs font-medium transition-all",
              titleMode === 'static'
                ? "border-primary bg-primary/10 text-primary"
                : "border-border/50 hover:border-primary/30 text-muted-foreground hover:text-foreground"
            )}
          >
            Static Title
          </button>
          <button
            onClick={() => handleTitleModeChange('variable')}
            className={cn(
              "flex-1 py-2 px-3 rounded-lg border-2 text-xs font-medium transition-all",
              titleMode === 'variable'
                ? "border-primary bg-primary/10 text-primary"
                : "border-border/50 hover:border-primary/30 text-muted-foreground hover:text-foreground"
            )}
          >
            From Variable
          </button>
        </div>
        
        {titleMode === 'static' ? (
          <Input
            id="page-title"
            value={pageTitle}
            onChange={(e) => onSetPageTitle(e.target.value)}
            placeholder="A New Qonsol Generated Page"
            className="bg-background"
          />
        ) : (
          <div className="space-y-2">
            <VariableSourcePicker
              value={pageTitleSource}
              onChange={onSetPageTitleSource}
              promptsData={promptsData}
              variablesData={variablesData}
              selectedFields={selectedFields}
              selectedVariables={selectedVariables}
              STANDARD_FIELDS={STANDARD_FIELDS}
              placeholder="Select title source..."
              className="w-full"
            />
            {getDynamicTitlePreview() && (
              <p className="text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
                {getDynamicTitlePreview()}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Space Selection Card */}
      <div className="border border-border/50 rounded-xl p-4 bg-card/50 space-y-3">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
            <Globe className="h-4 w-4 text-blue-500" />
          </div>
          <div>
            <Label className="text-sm font-semibold">Confluence Space</Label>
            <p className="text-xs text-muted-foreground">Select the space for your page</p>
          </div>
        </div>
        <Select value={selectedSpaceKey || ''} onValueChange={onSelectSpace}>
          <SelectTrigger className="bg-background">
            <SelectValue placeholder="Select a space..." />
          </SelectTrigger>
          <SelectContent>
            {spaces.map(space => (
              <SelectItem key={space.key} value={space.key}>
                {space.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Parent Page Selection Card */}
      {selectedSpaceKey && (
        <div className="border border-border/50 rounded-xl p-4 bg-card/50 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
                <FolderTree className="h-4 w-4 text-amber-500" />
              </div>
              <div>
                <Label className="text-sm font-semibold">Parent Page</Label>
                <p className="text-xs text-muted-foreground">Optional: nest under existing page</p>
              </div>
            </div>
            {selectedParentId && (
              <button
                onClick={() => onSelectParent(null)}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Clear
              </button>
            )}
          </div>
          
          {isLoadingTree ? (
            <div className="flex items-center justify-center py-8 border border-border/30 rounded-lg bg-muted/20">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="border border-border/30 rounded-lg max-h-48 overflow-y-auto bg-background/50">
              {spaceTree.length === 0 ? (
                <div className="text-center py-6 text-sm text-muted-foreground">
                  No pages found
                </div>
              ) : (
                <div className="p-1.5">
                  {spaceTree.map(node => (
                    <PageTreeNode
                      key={node.id}
                      node={node}
                      selectedId={selectedParentId}
                      onSelect={onSelectParent}
                      expandedIds={expandedIds}
                      onToggleExpand={handleToggleExpand}
                      loadingNodes={loadingNodes}
                      spaceKey={selectedSpaceKey}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
          
          {selectedParentNode && (
            <div className="text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
              New page will be created under: <span className="font-medium text-foreground">{selectedParentNode.title}</span>
            </div>
          )}
        </div>
      )}

      {/* Template Selection Card */}
      {selectedSpaceKey && (
        <div className="border border-border/50 rounded-xl p-4 bg-card/50 space-y-3">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-purple-500/10 flex items-center justify-center">
              <LayoutTemplate className="h-4 w-4 text-purple-500" />
            </div>
            <div>
              <Label className="text-sm font-semibold">Page Template</Label>
              <p className="text-xs text-muted-foreground">Choose a template or start blank</p>
            </div>
          </div>
          
          <div className="flex gap-2">
            <button
              onClick={onChooseBlankPage}
              className={cn(
                "flex-1 py-2.5 px-4 rounded-lg border-2 text-sm font-medium transition-all",
                useBlankPage
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border/50 hover:border-primary/30 text-muted-foreground hover:text-foreground"
              )}
            >
              Blank Page
            </button>
            
            {isLoadingTemplates ? (
              <div className="flex-1 flex items-center justify-center py-2.5 border-2 border-border/50 rounded-lg">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            ) : templates.length === 0 ? (
              <div className="flex-1 py-2.5 px-4 border-2 border-dashed border-border/30 rounded-lg text-sm text-muted-foreground text-center">
                No templates
              </div>
            ) : (
              <Select
                value={selectedTemplate?.templateId || ''}
                onValueChange={(templateId) => {
                  const template = templates.find(t => t.templateId === templateId);
                  if (template) onSelectTemplate(template);
                }}
              >
                <SelectTrigger className={cn(
                  "flex-1 bg-background border-2",
                  !useBlankPage && selectedTemplate ? "border-primary" : "border-border/50"
                )}>
                  <SelectValue placeholder="Choose template..." />
                </SelectTrigger>
                <SelectContent>
                  {templates.map(template => (
                    <SelectItem key={template.templateId} value={template.templateId}>
                      {template.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>
      )}

      {/* Template Variable Mapping */}
      {!useBlankPage && selectedTemplate && selectedTemplate.variables?.length > 0 && (
        <ConfluenceTemplateMapper
          template={selectedTemplate}
          mappings={templateMappings}
          promptsData={promptsData}
          variablesData={variablesData}
          selectedFields={selectedFields}
          selectedVariables={selectedVariables}
          onUpdateMapping={onUpdateMapping}
          STANDARD_FIELDS={STANDARD_FIELDS}
        />
      )}
    </div>
  );
};
