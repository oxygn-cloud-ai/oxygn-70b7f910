import React, { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { 
  FileText, FolderPlus, MessageSquare, Search, 
  Sparkles, LayoutTemplate, Check, Bot, Loader2,
  ChevronRight, FileJson, Boxes, Zap
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTemplates } from '@/hooks/useTemplates';

type PromptType = 'prompt' | 'folder' | 'assistant';
type CreationMode = 'blank' | 'template';

interface Template {
  row_id: string;
  template_name: string;
  template_description?: string;
  category?: string;
  structure?: {
    children?: unknown[];
  };
}

interface NewPromptChoiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChoice: (type: PromptType, templateId?: string, templateData?: Template) => void;
  parentName?: string;
  isCreating?: boolean;
}

const PROMPT_TYPES = [
  {
    id: 'prompt' as PromptType,
    label: 'Prompt',
    description: 'A single AI prompt with configurable settings',
    icon: FileText,
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/10',
  },
  {
    id: 'folder' as PromptType,
    label: 'Folder',
    description: 'Organize prompts into groups',
    icon: FolderPlus,
    color: 'text-amber-500',
    bgColor: 'bg-amber-500/10',
  },
  {
    id: 'assistant' as PromptType,
    label: 'Assistant',
    description: 'Multi-turn conversation with memory',
    icon: Bot,
    color: 'text-purple-500',
    bgColor: 'bg-purple-500/10',
  },
];

const NewPromptChoiceDialog: React.FC<NewPromptChoiceDialogProps> = ({
  open,
  onOpenChange,
  onChoice,
  parentName,
  isCreating = false,
}) => {
  const [selectedType, setSelectedType] = useState<PromptType>('prompt');
  const [creationMode, setCreationMode] = useState<CreationMode>('blank');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);

  const { templates, isLoading: templatesLoading } = useTemplates();

  // Filter templates based on search
  const filteredTemplates = useMemo(() => {
    if (!templates) return [];
    if (!searchQuery.trim()) return templates;
    
    const query = searchQuery.toLowerCase();
    return templates.filter((t: Template) => 
      t.template_name?.toLowerCase().includes(query) ||
      t.template_description?.toLowerCase().includes(query) ||
      t.category?.toLowerCase().includes(query)
    );
  }, [templates, searchQuery]);

  // Group templates by category
  const templatesByCategory = useMemo(() => {
    const grouped: Record<string, Template[]> = {};
    filteredTemplates.forEach((t: Template) => {
      const cat = t.category || 'Uncategorized';
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(t);
    });
    return grouped;
  }, [filteredTemplates]);

  const handleTypeSelect = (type: PromptType) => {
    setSelectedType(type);
    // Folders and assistants are always blank
    if (type === 'folder' || type === 'assistant') {
      setCreationMode('blank');
    }
  };

  const handleCreate = () => {
    if (creationMode === 'template' && selectedTemplateId) {
      const template = templates?.find((t: Template) => t.row_id === selectedTemplateId);
      onChoice(selectedType, selectedTemplateId, template);
    } else {
      onChoice(selectedType);
    }
  };

  const handleTemplateSelect = (templateId: string) => {
    setSelectedTemplateId(templateId);
  };

  const handleTemplateDoubleClick = (templateId: string) => {
    const template = templates?.find((t: Template) => t.row_id === templateId);
    onChoice(selectedType, templateId, template);
  };

  const selectedTemplate = useMemo(() => {
    if (!selectedTemplateId || !templates) return null;
    return templates.find((t: Template) => t.row_id === selectedTemplateId);
  }, [selectedTemplateId, templates]);

  const canCreate = selectedType && (creationMode === 'blank' || (creationMode === 'template' && selectedTemplateId));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] p-0 gap-0 overflow-hidden">
        <DialogHeader className="p-4 pb-0">
          <DialogTitle className="text-base flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Create New
            {parentName && (
              <span className="text-muted-foreground font-normal">
                in {parentName}
              </span>
            )}
          </DialogTitle>
          <DialogDescription className="text-xs">
            Choose what to create and how to start
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col flex-1 overflow-hidden">
          {/* Type Selection */}
          <div className="px-4 py-3 border-b">
            <div className="flex gap-2">
              {PROMPT_TYPES.map((type) => {
                const Icon = type.icon;
                const isSelected = selectedType === type.id;
                
                return (
                  <TooltipProvider key={type.id}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          onClick={() => handleTypeSelect(type.id)}
                          className={cn(
                            "flex-1 flex flex-col items-center gap-1.5 p-3 rounded-lg border-2 transition-all",
                            isSelected
                              ? "border-primary bg-primary/5"
                              : "border-transparent bg-muted/50 hover:bg-muted"
                          )}
                        >
                          <div className={cn("p-2 rounded-lg", type.bgColor)}>
                            <Icon className={cn("h-5 w-5", type.color)} />
                          </div>
                          <span className="text-xs font-medium">{type.label}</span>
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="text-xs">{type.description}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                );
              })}
            </div>
          </div>

          {/* Creation Mode Tabs (only for prompts) */}
          {selectedType === 'prompt' && (
            <Tabs 
              value={creationMode} 
              onValueChange={(v) => setCreationMode(v as CreationMode)}
              className="flex-1 flex flex-col overflow-hidden"
            >
              <div className="px-4 pt-3">
                <TabsList className="grid w-full grid-cols-2 h-8">
                  <TabsTrigger value="blank" className="text-xs gap-1.5">
                    <FileText className="h-3.5 w-3.5" />
                    Start Blank
                  </TabsTrigger>
                  <TabsTrigger value="template" className="text-xs gap-1.5">
                    <LayoutTemplate className="h-3.5 w-3.5" />
                    Use Template
                  </TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="blank" className="flex-1 p-4 m-0">
                <div className="flex flex-col items-center justify-center h-full text-center space-y-3 py-8">
                  <div className="p-4 rounded-full bg-primary/10">
                    <FileText className="h-8 w-8 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Start with a blank prompt</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Configure everything from scratch
                    </p>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="template" className="flex-1 flex flex-col overflow-hidden p-0 m-0">
                {/* Template Search */}
                <div className="px-4 py-2 border-b">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search templates..."
                      className="h-8 pl-8 text-xs"
                    />
                  </div>
                </div>

                {/* Template List */}
                <ScrollArea className="flex-1">
                  <div className="p-4 space-y-4">
                    {templatesLoading ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                      </div>
                    ) : Object.keys(templatesByCategory).length === 0 ? (
                      <div className="text-center py-8">
                        <LayoutTemplate className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                        <p className="text-sm text-muted-foreground">
                          {searchQuery ? 'No templates found' : 'No templates available'}
                        </p>
                      </div>
                    ) : (
                      Object.entries(templatesByCategory).map(([category, categoryTemplates]) => (
                        <div key={category}>
                          <div className="flex items-center gap-2 mb-2">
                            <Boxes className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                              {category}
                            </span>
                            <Badge variant="secondary" className="text-[10px] h-4 px-1">
                              {categoryTemplates.length}
                            </Badge>
                          </div>
                          <div className="space-y-1">
                            {categoryTemplates.map((template: Template) => (
                              <button
                                key={template.row_id}
                                onClick={() => handleTemplateSelect(template.row_id)}
                                onDoubleClick={() => handleTemplateDoubleClick(template.row_id)}
                                className={cn(
                                  "w-full flex items-center gap-3 p-2.5 rounded-lg text-left transition-all",
                                  selectedTemplateId === template.row_id
                                    ? "bg-primary/10 border border-primary"
                                    : "bg-muted/30 hover:bg-muted/50 border border-transparent"
                                )}
                              >
                                <div className={cn(
                                  "p-1.5 rounded",
                                  selectedTemplateId === template.row_id
                                    ? "bg-primary/20"
                                    : "bg-muted"
                                )}>
                                  <LayoutTemplate className={cn(
                                    "h-4 w-4",
                                    selectedTemplateId === template.row_id
                                      ? "text-primary"
                                      : "text-muted-foreground"
                                  )} />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium truncate">
                                    {template.template_name}
                                  </p>
                                  {template.template_description && (
                                    <p className="text-[10px] text-muted-foreground truncate">
                                      {template.template_description}
                                    </p>
                                  )}
                                </div>
                                {template.structure?.children && template.structure.children.length > 0 && (
                                  <Badge variant="outline" className="text-[10px] h-4 px-1 shrink-0">
                                    {template.structure.children.length} children
                                  </Badge>
                                )}
                                {selectedTemplateId === template.row_id && (
                                  <Check className="h-4 w-4 text-primary shrink-0" />
                                )}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </ScrollArea>

                {/* Selected Template Preview */}
                {selectedTemplate && (
                  <div className="px-4 py-2 border-t bg-muted/30">
                    <div className="flex items-center gap-2">
                      <Check className="h-3.5 w-3.5 text-primary" />
                      <span className="text-xs font-medium">{selectedTemplate.template_name}</span>
                      <span className="text-[10px] text-muted-foreground">selected</span>
                    </div>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          )}

          {/* Non-prompt type info */}
          {selectedType !== 'prompt' && (
            <div className="flex-1 p-4">
              <div className="flex flex-col items-center justify-center h-full text-center space-y-3 py-8">
                {selectedType === 'folder' && (
                  <>
                    <div className="p-4 rounded-full bg-amber-500/10">
                      <FolderPlus className="h-8 w-8 text-amber-500" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">Create a folder</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Organize your prompts into logical groups
                      </p>
                    </div>
                  </>
                )}
                {selectedType === 'assistant' && (
                  <>
                    <div className="p-4 rounded-full bg-purple-500/10">
                      <Bot className="h-8 w-8 text-purple-500" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">Create an assistant</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Multi-turn conversations with persistent memory and tools
                      </p>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="px-4 py-3 border-t bg-muted/30 flex items-center justify-end gap-2">
            <button
              onClick={() => onOpenChange(false)}
              className="px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              disabled={isCreating}
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={!canCreate || isCreating}
              className={cn(
                "px-4 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5",
                canCreate && !isCreating
                  ? "bg-primary text-primary-foreground hover:bg-primary/90"
                  : "bg-muted text-muted-foreground cursor-not-allowed"
              )}
            >
              {isCreating ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Zap className="h-3.5 w-3.5" />
                  Create {PROMPT_TYPES.find(t => t.id === selectedType)?.label}
                </>
              )}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default NewPromptChoiceDialog;
