import React, { useState } from 'react';
import { ChevronDown, ChevronRight, FileText, Folder, FolderOpen, Home, Loader2, File } from 'lucide-react';
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

const PageTreeNode = ({ node, level = 0, selectedId, onSelect, expandedIds, onToggleExpand }) => {
  const isSelected = selectedId === node.id;
  const isExpanded = expandedIds.includes(node.id);
  const hasChildren = node.children && node.children.length > 0;
  const isFolder = node.isFolder || node.type === 'folder';
  const isContainer = node.isContainer;

  if (isContainer) {
    // Skip container nodes like "Blog"
    return null;
  }

  const handleClick = () => {
    onSelect(node.id);
  };

  const handleExpandClick = (e) => {
    e.stopPropagation();
    onToggleExpand(node.id);
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

  return (
    <div>
      <div
        onClick={handleClick}
        className={cn(
          "flex items-center gap-1.5 py-1 px-2 rounded cursor-pointer transition-colors text-sm",
          isSelected ? "bg-primary/10 text-primary" : "hover:bg-muted text-foreground"
        )}
        style={{ paddingLeft: `${level * 12 + 8}px` }}
      >
        {hasChildren ? (
          <button onClick={handleExpandClick} className="p-0.5 hover:bg-muted rounded">
            {isExpanded ? (
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
  STANDARD_FIELDS
}) => {
  const [expandedIds, setExpandedIds] = useState([]);

  const handleToggleExpand = (id) => {
    setExpandedIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

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

  return (
    <div className="space-y-6">
      {/* Page Title */}
      <div className="space-y-2">
        <Label htmlFor="page-title">Page Title</Label>
        <Input
          id="page-title"
          value={pageTitle}
          onChange={(e) => onSetPageTitle(e.target.value)}
          placeholder="Enter page title..."
          className="bg-background"
        />
      </div>

      {/* Space Selection */}
      <div className="space-y-2">
        <Label>Confluence Space</Label>
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

      {/* Parent Page/Folder Selection */}
      {selectedSpaceKey && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Parent Page (optional)</Label>
            {selectedParentId && (
              <button
                onClick={() => onSelectParent(null)}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Clear
              </button>
            )}
          </div>
          
          {isLoadingTree ? (
            <div className="flex items-center justify-center py-6 border border-border rounded-lg">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="border border-border rounded-lg max-h-48 overflow-y-auto">
              {spaceTree.length === 0 ? (
                <div className="text-center py-4 text-sm text-muted-foreground">
                  No pages found
                </div>
              ) : (
                <div className="p-1">
                  {spaceTree.map(node => (
                    <PageTreeNode
                      key={node.id}
                      node={node}
                      selectedId={selectedParentId}
                      onSelect={onSelectParent}
                      expandedIds={expandedIds}
                      onToggleExpand={handleToggleExpand}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
          
          {selectedParentNode && (
            <div className="text-xs text-muted-foreground">
              New page will be created under: <span className="font-medium">{selectedParentNode.title}</span>
            </div>
          )}
        </div>
      )}

      {/* Template Selection */}
      {selectedSpaceKey && (
        <div className="space-y-3">
          <Label>Page Template</Label>
          
          <div className="flex gap-2">
            <button
              onClick={onChooseBlankPage}
              className={cn(
                "flex-1 py-2 px-3 rounded-lg border text-sm font-medium transition-colors",
                useBlankPage
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border hover:border-primary/50 text-muted-foreground hover:text-foreground"
              )}
            >
              Blank Page
            </button>
            
            {isLoadingTemplates ? (
              <div className="flex-1 flex items-center justify-center py-2 border border-border rounded-lg">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            ) : templates.length === 0 ? (
              <div className="flex-1 py-2 px-3 border border-dashed border-border rounded-lg text-sm text-muted-foreground text-center">
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
                  "flex-1 bg-background",
                  !useBlankPage && selectedTemplate && "border-primary"
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
