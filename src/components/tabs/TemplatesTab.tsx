import React, { useState } from 'react';
import { LayoutTemplate, Plus, Download, Upload, Search, Trash2, Eye } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useTemplates } from '../../hooks/useTemplates';
import { toast } from '@/components/ui/sonner';
import { trackEvent } from '@/lib/posthog';

interface Template {
  row_id: string;
  template_name: string;
  template_description?: string;
  category?: string;
  structure?: Record<string, unknown>;
}

interface TemplatesTabProps {
  selectedItemData?: Record<string, unknown> | null;
  projectRowId?: string | null;
  isTopLevel?: boolean;
  promptRowId?: string | null;
}

const TemplatesTab: React.FC<TemplatesTabProps> = ({ selectedItemData, projectRowId, isTopLevel, promptRowId }) => {
  const { 
    templates, 
    isLoading, 
    createFromPrompt, 
    deleteTemplate,
    extractTemplateVariables 
  } = useTemplates();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [templateDescription, setTemplateDescription] = useState('');
  const [templateCategory, setTemplateCategory] = useState('general');
  const [isSaving, setIsSaving] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);

  const filteredTemplates = (templates as Template[]).filter(t => 
    t.template_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.template_description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.category?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSaveAsTemplate = async () => {
    if (!templateName.trim()) {
      toast.error('Please enter a template name');
      return;
    }

    if (!promptRowId) {
      toast.error('No prompt selected');
      return;
    }

    setIsSaving(true);
    try {
      const result = await createFromPrompt(promptRowId, {
        name: templateName,
        description: templateDescription,
        category: templateCategory,
        isPrivate: false,
        includeChildren: true,
      });
      if (result) {
        setShowSaveDialog(false);
        setTemplateName('');
        setTemplateDescription('');
        toast.success('Template created successfully');
        trackEvent('template_saved_from_prompt', { prompt_row_id: promptRowId, template_name: templateName });
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteTemplate = async (templateId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Are you sure you want to delete this template?')) {
      await deleteTemplate(templateId);
      trackEvent('template_deleted_from_tab', { template_id: templateId });
    }
  };

  const handlePreviewTemplate = (template: Template) => {
    setSelectedTemplate(template);
  };

  return (
    <div className="space-y-4">
      {/* Save as Template Section */}
      <div className="space-y-2 p-4 border rounded-lg">
        <div className="flex items-center gap-2">
          <Upload className="h-4 w-4 text-muted-foreground" />
          <Label className="text-sm font-medium">Save as Template</Label>
        </div>
        <p className="text-xs text-muted-foreground">
          Save the current prompt structure as a reusable template
        </p>
        <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
          <DialogTrigger asChild>
            <Button variant="secondary" className="w-full mt-2">
              <Plus className="h-4 w-4 mr-2" />
              Create Template from Current Prompt
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Template</DialogTitle>
              <DialogDescription>
                Save this prompt hierarchy as a reusable template
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="templateName">Template Name</Label>
                <Input
                  id="templateName"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  placeholder="My Template"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="templateDescription">Description</Label>
                <Textarea
                  id="templateDescription"
                  value={templateDescription}
                  onChange={(e) => setTemplateDescription(e.target.value)}
                  placeholder="Describe what this template is for..."
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="templateCategory">Category</Label>
                <Select value={templateCategory} onValueChange={setTemplateCategory}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general">General</SelectItem>
                    <SelectItem value="writing">Writing</SelectItem>
                    <SelectItem value="coding">Coding</SelectItem>
                    <SelectItem value="analysis">Analysis</SelectItem>
                    <SelectItem value="creative">Creative</SelectItem>
                    <SelectItem value="business">Business</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowSaveDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleSaveAsTemplate} disabled={isSaving}>
                {isSaving ? 'Saving...' : 'Save Template'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Browse Templates Section */}
      <div className="space-y-3 p-4 border rounded-lg">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Download className="h-4 w-4 text-muted-foreground" />
              <Label className="text-sm font-medium">Available Templates</Label>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Browse and apply templates to create new prompts
            </p>
          </div>
          <Badge variant="secondary" className="text-xs">{templates.length} templates</Badge>
        </div>

        {/* Search */}
        <div className="relative pt-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search templates..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Templates List */}
        {isLoading ? (
          <div className="text-sm text-muted-foreground text-center py-8">
            Loading templates...
          </div>
        ) : filteredTemplates.length === 0 ? (
          <div className="text-sm text-muted-foreground text-center py-8">
            {searchQuery ? 'No templates match your search' : 'No templates available yet'}
          </div>
        ) : (
          <div className="space-y-2 max-h-[400px] overflow-auto pt-2">
            {filteredTemplates.map(template => {
              const variables = extractTemplateVariables(template.structure || {});
              
              return (
                <div 
                  key={template.row_id}
                  className="flex items-center justify-between p-3 rounded-lg border border-border hover:border-primary/50 hover:bg-muted/50 transition-colors cursor-pointer"
                  onClick={() => handlePreviewTemplate(template)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <LayoutTemplate className="h-4 w-4 text-primary" />
                      <span className="font-medium text-sm truncate">{template.template_name}</span>
                      {template.category && (
                        <Badge variant="outline" className="text-xs">{template.category}</Badge>
                      )}
                    </div>
                    {template.template_description && (
                      <p className="text-xs text-muted-foreground mt-1 truncate">
                        {template.template_description}
                      </p>
                    )}
                    {variables.length > 0 && (
                      <div className="flex items-center gap-1 mt-1 flex-wrap">
                        <span className="text-xs text-muted-foreground">Variables:</span>
                        {variables.slice(0, 3).map((v: string) => (
                          <Badge key={v} variant="secondary" className="text-xs font-mono">
                            {`{{${v}}}`}
                          </Badge>
                        ))}
                        {variables.length > 3 && (
                          <span className="text-xs text-muted-foreground">+{variables.length - 3} more</span>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 ml-2">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground">
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Preview</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                            onClick={(e) => handleDeleteTemplate(template.row_id, e)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Delete</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Template Preview Dialog */}
      <Dialog open={!!selectedTemplate} onOpenChange={() => setSelectedTemplate(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <LayoutTemplate className="h-5 w-5" />
              {selectedTemplate?.template_name}
            </DialogTitle>
            <DialogDescription>
              {selectedTemplate?.template_description || 'No description provided'}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <pre className="p-4 rounded-lg bg-muted text-xs overflow-auto max-h-[400px]">
              {JSON.stringify(selectedTemplate?.structure, null, 2)}
            </pre>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedTemplate(null)}>
              Close
            </Button>
            <Button>
              Apply Template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TemplatesTab;
