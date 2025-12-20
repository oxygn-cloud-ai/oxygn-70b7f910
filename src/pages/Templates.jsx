import React, { useState, useMemo } from 'react';
import { Search, Plus, Trash2, Edit, Eye, LayoutTemplate, Save, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from '@/components/ui/sonner';
import useTemplates from '@/hooks/useTemplates';
import EmptyState from '@/components/EmptyState';
import { Loader2 } from 'lucide-react';

const Templates = () => {
  const { templates, isLoading, createTemplate, updateTemplate, deleteTemplate, extractTemplateVariables } = useTemplates();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newTemplate, setNewTemplate] = useState({
    name: '',
    description: '',
    category: 'general',
    structure: {}
  });

  const filteredTemplates = useMemo(() => {
    if (!searchQuery.trim()) return templates;
    const query = searchQuery.toLowerCase();
    return templates.filter(t => 
      t.template_name?.toLowerCase().includes(query) ||
      t.template_description?.toLowerCase().includes(query) ||
      t.category?.toLowerCase().includes(query)
    );
  }, [templates, searchQuery]);

  const handleCreateTemplate = async () => {
    if (!newTemplate.name.trim()) {
      toast.error('Template name is required');
      return;
    }
    const result = await createTemplate({
      name: newTemplate.name,
      description: newTemplate.description,
      category: newTemplate.category,
      structure: newTemplate.structure,
    });
    if (result) {
      setShowCreateDialog(false);
      setNewTemplate({ name: '', description: '', category: 'general', structure: {} });
    }
  };

  const handleUpdateTemplate = async () => {
    if (!editingTemplate) return;
    const success = await updateTemplate(editingTemplate.row_id, {
      template_name: editingTemplate.template_name,
      template_description: editingTemplate.template_description,
      category: editingTemplate.category,
    });
    if (success) {
      setEditingTemplate(null);
    }
  };

  const handleDeleteTemplate = async (template) => {
    if (window.confirm(`Delete template "${template.template_name}"?`)) {
      await deleteTemplate(template.row_id);
      if (selectedTemplate?.row_id === template.row_id) {
        setSelectedTemplate(null);
      }
    }
  };

  const getCategoryColor = (category) => {
    const colors = {
      general: 'bg-muted text-muted-foreground',
      marketing: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
      technical: 'bg-green-500/10 text-green-600 dark:text-green-400',
      creative: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
      business: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    };
    return colors[category] || colors.general;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] bg-background">
      {/* Templates List */}
      <div className="w-80 border-r border-border flex flex-col">
        <div className="p-4 border-b border-border space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <LayoutTemplate className="h-5 w-5 text-primary" />
              Templates
            </h2>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="icon" variant="ghost" onClick={() => setShowCreateDialog(true)}>
                  <Plus className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Create new template</TooltipContent>
            </Tooltip>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search templates..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {filteredTemplates.length === 0 ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                {searchQuery ? 'No templates match your search' : 'No templates yet'}
              </div>
            ) : (
              filteredTemplates.map(template => (
                <div
                  key={template.row_id}
                  onClick={() => setSelectedTemplate(template)}
                  className={`p-3 rounded-lg cursor-pointer transition-colors ${
                    selectedTemplate?.row_id === template.row_id
                      ? 'bg-primary/10 border border-primary/20'
                      : 'hover:bg-muted/50 border border-transparent'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{template.template_name}</p>
                      {template.template_description && (
                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                          {template.template_description}
                        </p>
                      )}
                    </div>
                    <Badge variant="secondary" className={`text-[10px] shrink-0 ${getCategoryColor(template.category)}`}>
                      {template.category || 'general'}
                    </Badge>
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Template Details */}
      <div className="flex-1 overflow-hidden">
        {selectedTemplate ? (
          <div className="h-full flex flex-col">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold">{selectedTemplate.template_name}</h3>
                {selectedTemplate.template_description && (
                  <p className="text-sm text-muted-foreground">{selectedTemplate.template_description}</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button size="icon" variant="ghost" onClick={() => setEditingTemplate({...selectedTemplate})}>
                      <Edit className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Edit template</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button size="icon" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => handleDeleteTemplate(selectedTemplate)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Delete template</TooltipContent>
                </Tooltip>
              </div>
            </div>

            <ScrollArea className="flex-1 p-4">
              <div className="space-y-6">
                <div>
                  <h4 className="text-sm font-medium mb-2">Category</h4>
                  <Badge className={getCategoryColor(selectedTemplate.category)}>
                    {selectedTemplate.category || 'general'}
                  </Badge>
                </div>

                <div>
                  <h4 className="text-sm font-medium mb-2">Variables</h4>
                  {extractTemplateVariables(selectedTemplate.structure).length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {extractTemplateVariables(selectedTemplate.structure).map(v => (
                        <Badge key={v} variant="outline" className="text-xs">
                          {`{{${v}}}`}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No variables defined</p>
                  )}
                </div>

                <div>
                  <h4 className="text-sm font-medium mb-2">Structure</h4>
                  <Card className="bg-muted/30">
                    <CardContent className="p-4">
                      <pre className="text-xs overflow-auto whitespace-pre-wrap">
                        {JSON.stringify(selectedTemplate.structure, null, 2)}
                      </pre>
                    </CardContent>
                  </Card>
                </div>

                <div className="text-xs text-muted-foreground">
                  <p>Created: {new Date(selectedTemplate.created_at).toLocaleDateString()}</p>
                  <p>Version: {selectedTemplate.version || 1}</p>
                </div>
              </div>
            </ScrollArea>
          </div>
        ) : (
          <EmptyState
            icon="template"
            title="Select a template"
            description="Choose a template from the list to view and edit its details."
            className="h-full"
          />
        )}
      </div>

      {/* Create Template Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Template</DialogTitle>
            <DialogDescription>Create a blank template to start from scratch.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Name</Label>
              <Input
                value={newTemplate.name}
                onChange={(e) => setNewTemplate(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Template name"
              />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea
                value={newTemplate.description}
                onChange={(e) => setNewTemplate(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Optional description"
                rows={2}
              />
            </div>
            <div>
              <Label>Category</Label>
              <Select value={newTemplate.category} onValueChange={(v) => setNewTemplate(prev => ({ ...prev, category: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="general">General</SelectItem>
                  <SelectItem value="marketing">Marketing</SelectItem>
                  <SelectItem value="technical">Technical</SelectItem>
                  <SelectItem value="creative">Creative</SelectItem>
                  <SelectItem value="business">Business</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Cancel</Button>
            <Button onClick={handleCreateTemplate}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Template Dialog */}
      <Dialog open={!!editingTemplate} onOpenChange={(open) => !open && setEditingTemplate(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Template</DialogTitle>
          </DialogHeader>
          {editingTemplate && (
            <div className="space-y-4">
              <div>
                <Label>Name</Label>
                <Input
                  value={editingTemplate.template_name}
                  onChange={(e) => setEditingTemplate(prev => ({ ...prev, template_name: e.target.value }))}
                />
              </div>
              <div>
                <Label>Description</Label>
                <Textarea
                  value={editingTemplate.template_description || ''}
                  onChange={(e) => setEditingTemplate(prev => ({ ...prev, template_description: e.target.value }))}
                  rows={2}
                />
              </div>
              <div>
                <Label>Category</Label>
                <Select value={editingTemplate.category || 'general'} onValueChange={(v) => setEditingTemplate(prev => ({ ...prev, category: v }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general">General</SelectItem>
                    <SelectItem value="marketing">Marketing</SelectItem>
                    <SelectItem value="technical">Technical</SelectItem>
                    <SelectItem value="creative">Creative</SelectItem>
                    <SelectItem value="business">Business</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingTemplate(null)}>Cancel</Button>
            <Button onClick={handleUpdateTemplate}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Templates;
