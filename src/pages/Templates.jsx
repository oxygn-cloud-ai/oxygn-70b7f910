import React, { useState, useMemo } from 'react';
import { Search, Plus, Trash2, Copy, Download, Upload, LayoutTemplate, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
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
import { TemplateEditor } from '@/components/templates';
import { ExportTemplateDialog, ImportTemplateDialog } from '@/components/templates/TemplateImportExport';

const CATEGORIES = [
  { value: 'general', label: 'General', color: 'bg-muted text-muted-foreground' },
  { value: 'marketing', label: 'Marketing', color: 'bg-blue-500/10 text-blue-600 dark:text-blue-400' },
  { value: 'technical', label: 'Technical', color: 'bg-green-500/10 text-green-600 dark:text-green-400' },
  { value: 'creative', label: 'Creative', color: 'bg-purple-500/10 text-purple-600 dark:text-purple-400' },
  { value: 'business', label: 'Business', color: 'bg-amber-500/10 text-amber-600 dark:text-amber-400' },
];

const Templates = () => {
  const { templates, isLoading, createTemplate, updateTemplate, deleteTemplate, extractTemplateVariables } = useTemplates();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newTemplate, setNewTemplate] = useState({ name: '', description: '', category: 'general' });

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
      structure: { prompt_name: 'Root Prompt', input_admin_prompt: '', input_user_prompt: '', children: [] },
    });
    if (result) {
      setShowCreateDialog(false);
      setNewTemplate({ name: '', description: '', category: 'general' });
      setSelectedTemplate(result);
    }
  };

  const handleDuplicateTemplate = async (template) => {
    const result = await createTemplate({
      name: template.template_name + ' (copy)',
      description: template.template_description,
      category: template.category,
      structure: template.structure,
    });
    if (result) {
      setSelectedTemplate(result);
      toast.success('Template duplicated');
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

  const handleImportTemplate = async (data) => {
    const result = await createTemplate({
      name: data.name,
      description: data.description,
      category: data.category,
      structure: data.structure,
    });
    if (result && data.variableDefinitions?.length > 0) {
      await updateTemplate(result.row_id, { variable_definitions: data.variableDefinitions });
    }
    if (result) setSelectedTemplate(result);
  };

  const getCategoryColor = (category) => {
    return CATEGORIES.find(c => c.value === category)?.color || CATEGORIES[0].color;
  };

  const countNodes = (node) => {
    if (!node) return 0;
    let count = 1;
    if (node.children) node.children.forEach(c => count += countNodes(c));
    return count;
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
            <div className="flex items-center gap-1">
              <ImportTemplateDialog onImport={handleImportTemplate} trigger={
                <Button size="icon" variant="ghost"><Upload className="h-4 w-4" /></Button>
              } />
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button size="icon" variant="ghost" onClick={() => setShowCreateDialog(true)}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Create template</TooltipContent>
              </Tooltip>
            </div>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search templates..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9" />
          </div>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {filteredTemplates.length === 0 ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                {searchQuery ? 'No templates match your search' : 'No templates yet'}
              </div>
            ) : (
              filteredTemplates.map(template => {
                const varCount = extractTemplateVariables(template.structure).length;
                const nodeCount = countNodes(template.structure);
                return (
                  <div
                    key={template.row_id}
                    onClick={() => setSelectedTemplate(template)}
                    className={`p-3 rounded-lg cursor-pointer transition-colors group ${
                      selectedTemplate?.row_id === template.row_id
                        ? 'bg-primary/10 border border-primary/20'
                        : 'hover:bg-muted/50 border border-transparent'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{template.template_name}</p>
                        {template.template_description && (
                          <p className="text-xs text-muted-foreground truncate mt-0.5">{template.template_description}</p>
                        )}
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] text-muted-foreground">{nodeCount} nodes</span>
                          {varCount > 0 && <span className="text-[10px] text-muted-foreground">• {varCount} vars</span>}
                        </div>
                      </div>
                      <Badge variant="secondary" className={`text-[10px] shrink-0 ${getCategoryColor(template.category)}`}>
                        {template.category || 'general'}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Tooltip><TooltipTrigger asChild>
                        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); handleDuplicateTemplate(template); }}>
                          <Copy className="h-3 w-3" />
                        </Button>
                      </TooltipTrigger><TooltipContent>Duplicate</TooltipContent></Tooltip>
                      <ExportTemplateDialog template={template} trigger={
                        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={(e) => e.stopPropagation()}>
                          <Download className="h-3 w-3" />
                        </Button>
                      } />
                      <Tooltip><TooltipTrigger asChild>
                        <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive" onClick={(e) => { e.stopPropagation(); handleDeleteTemplate(template); }}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </TooltipTrigger><TooltipContent>Delete</TooltipContent></Tooltip>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Template Editor */}
      <div className="flex-1 overflow-hidden">
        {selectedTemplate ? (
          <TemplateEditor template={selectedTemplate} onUpdate={updateTemplate} />
        ) : (
          <EmptyState icon="template" title="Select a template" description="Choose a template to view and edit, or create a new one." className="h-full" />
        )}
      </div>

      {/* Create Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Template</DialogTitle>
            <DialogDescription>Start with a blank template.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div><Label>Name</Label><Input value={newTemplate.name} onChange={(e) => setNewTemplate(p => ({ ...p, name: e.target.value }))} placeholder="Template name" /></div>
            <div><Label>Description</Label><Textarea value={newTemplate.description} onChange={(e) => setNewTemplate(p => ({ ...p, description: e.target.value }))} placeholder="Optional description" rows={2} /></div>
            <div><Label>Category</Label>
              <Select value={newTemplate.category} onValueChange={(v) => setNewTemplate(p => ({ ...p, category: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Cancel</Button>
            <Button onClick={handleCreateTemplate}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Templates;
