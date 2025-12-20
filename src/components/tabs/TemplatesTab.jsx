import React, { useState } from 'react';
import { LayoutTemplate, Plus, Download, Upload, Search, Trash2, Eye } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTemplates } from '../../hooks/useTemplates';
import { toast } from '@/components/ui/sonner';

const TemplatesTab = ({ selectedItemData, projectRowId, isTopLevel }) => {
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
  const [selectedTemplate, setSelectedTemplate] = useState(null);

  const filteredTemplates = templates.filter(t => 
    t.template_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.template_description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.category?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const categories = [...new Set(templates.map(t => t.category).filter(Boolean))];

  const handleSaveAsTemplate = async () => {
    if (!templateName.trim()) {
      toast.error('Please enter a template name');
      return;
    }

    setIsSaving(true);
    try {
      const result = await createFromPrompt(projectRowId, templateName);
      if (result) {
        setShowSaveDialog(false);
        setTemplateName('');
        setTemplateDescription('');
        toast.success('Template created successfully');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteTemplate = async (templateId, e) => {
    e.stopPropagation();
    if (confirm('Are you sure you want to delete this template?')) {
      await deleteTemplate(templateId);
    }
  };

  const handlePreviewTemplate = (template) => {
    setSelectedTemplate(template);
  };

  return (
    <div className="space-y-6">
      {/* Save as Template Section */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Upload className="h-4 w-4" />
            Save as Template
          </CardTitle>
          <CardDescription className="text-xs">
            Save the current prompt structure as a reusable template
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
            <DialogTrigger asChild>
              <Button className="w-full">
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
        </CardContent>
      </Card>

      {/* Browse Templates Section */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <Download className="h-4 w-4" />
                Available Templates
              </CardTitle>
              <CardDescription className="text-xs mt-1">
                Browse and apply templates to create new prompts
              </CardDescription>
            </div>
            <Badge variant="secondary">{templates.length} templates</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search */}
          <div className="relative">
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
            <div className="space-y-2 max-h-[400px] overflow-auto">
              {filteredTemplates.map(template => {
                const variables = extractTemplateVariables(template.structure);
                
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
                        <div className="flex items-center gap-1 mt-1">
                          <span className="text-xs text-muted-foreground">Variables:</span>
                          {variables.slice(0, 3).map(v => (
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
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-7 w-7 p-0 hover:text-destructive"
                        onClick={(e) => handleDeleteTemplate(template.row_id, e)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

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
