import React, { useState, useMemo } from 'react';
import { Search, Plus, Trash2, Copy, Download, Upload, LayoutTemplate, Loader2, FileJson, Link2, FileText } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { TOOLTIPS } from '@/config/labels';
import { toast } from '@/components/ui/sonner';
import useTemplates from '@/hooks/useTemplates';
import { useJsonSchemaTemplates } from '@/hooks/useJsonSchemaTemplates';
import { useExportTemplates } from '@/hooks/useExportTemplates';
import EmptyState from '@/components/EmptyState';
import { TemplateEditor } from '@/components/templates';
import { ExportTemplateDialog, ImportTemplateDialog } from '@/components/templates/TemplateImportExport';
import JsonSchemaEditor from '@/components/templates/JsonSchemaEditor';
import VariableMappingEditor from '@/components/templates/VariableMappingEditor';
import { DEFAULT_SCHEMAS } from '@/config/defaultSchemas';

const PROMPT_CATEGORIES = [
  { value: 'general', label: 'General', color: 'bg-muted text-muted-foreground' },
  { value: 'marketing', label: 'Marketing', color: 'bg-blue-500/10 text-blue-600 dark:text-blue-400' },
  { value: 'technical', label: 'Technical', color: 'bg-green-500/10 text-green-600 dark:text-green-400' },
  { value: 'creative', label: 'Creative', color: 'bg-purple-500/10 text-purple-600 dark:text-purple-400' },
  { value: 'business', label: 'Business', color: 'bg-amber-500/10 text-amber-600 dark:text-amber-400' },
];

const SCHEMA_CATEGORIES = [
  { value: 'general', label: 'General', color: 'bg-muted text-muted-foreground' },
  { value: 'action', label: 'Action', color: 'bg-orange-500/10 text-orange-600 dark:text-orange-400' },
  { value: 'extraction', label: 'Extraction', color: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400' },
  { value: 'analysis', label: 'Analysis', color: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400' },
];

const Templates = () => {
  // Prompt templates
  const { templates: promptTemplates, isLoading: promptsLoading, createTemplate: createPromptTemplate, updateTemplate: updatePromptTemplate, deleteTemplate: deletePromptTemplate, extractTemplateVariables } = useTemplates();
  
  // JSON Schema templates
  const { templates: schemaTemplates, isLoading: schemasLoading, createTemplate: createSchemaTemplate, updateTemplate: updateSchemaTemplate, deleteTemplate: deleteSchemaTemplate, duplicateTemplate: duplicateSchemaTemplate } = useJsonSchemaTemplates();
  
  // Export/Variable Mapping templates
  const { templates: exportTemplates, isLoading: exportsLoading, fetchTemplates: fetchExportTemplates, saveTemplate: saveExportTemplate, updateTemplate: updateExportTemplate, deleteTemplate: deleteExportTemplate } = useExportTemplates();

  const [activeTab, setActiveTab] = useState('prompts');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedItem, setSelectedItem] = useState(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newTemplate, setNewTemplate] = useState({ name: '', description: '', category: 'general' });

  // Fetch export templates when tab changes
  React.useEffect(() => {
    if (activeTab === 'mappings') {
      fetchExportTemplates('confluence');
    }
  }, [activeTab, fetchExportTemplates]);

  // Filter based on active tab
  const filteredItems = useMemo(() => {
    const query = searchQuery.toLowerCase();
    
    if (activeTab === 'prompts') {
      if (!searchQuery.trim()) return promptTemplates;
      return promptTemplates.filter(t => 
        t.template_name?.toLowerCase().includes(query) ||
        t.template_description?.toLowerCase().includes(query) ||
        t.category?.toLowerCase().includes(query)
      );
    } else if (activeTab === 'schemas') {
      if (!searchQuery.trim()) return schemaTemplates;
      return schemaTemplates.filter(t => 
        t.schema_name?.toLowerCase().includes(query) ||
        t.schema_description?.toLowerCase().includes(query) ||
        t.category?.toLowerCase().includes(query)
      );
    } else {
      if (!searchQuery.trim()) return exportTemplates;
      return exportTemplates.filter(t => 
        t.template_name?.toLowerCase().includes(query)
      );
    }
  }, [activeTab, searchQuery, promptTemplates, schemaTemplates, exportTemplates]);

  const isLoading = activeTab === 'prompts' ? promptsLoading : activeTab === 'schemas' ? schemasLoading : exportsLoading;

  // Create handlers
  const handleCreate = async () => {
    if (!newTemplate.name.trim()) {
      toast.error('Name is required');
      return;
    }

    if (activeTab === 'prompts') {
      const result = await createPromptTemplate({
        name: newTemplate.name,
        description: newTemplate.description,
        category: newTemplate.category,
        structure: { prompt_name: 'Root Prompt', input_admin_prompt: '', input_user_prompt: '', children: [] },
      });
      if (result) {
        setSelectedItem(result);
      }
    } else if (activeTab === 'schemas') {
      const result = await createSchemaTemplate({
        schemaName: newTemplate.name,
        schemaDescription: newTemplate.description,
        category: newTemplate.category,
        jsonSchema: DEFAULT_SCHEMAS[0].schema
      });
      if (result) {
        setSelectedItem(result);
      }
    } else {
      const result = await saveExportTemplate({
        templateName: newTemplate.name,
        exportType: 'confluence',
        selectedFields: [],
        selectedVariables: {},
        confluenceConfig: {}
      });
      if (result) {
        setSelectedItem(result);
      }
    }
    
    setShowCreateDialog(false);
    setNewTemplate({ name: '', description: '', category: 'general' });
  };

  const handleDuplicate = async (item) => {
    if (activeTab === 'prompts') {
      const result = await createPromptTemplate({
        name: item.template_name + ' (copy)',
        description: item.template_description,
        category: item.category,
        structure: item.structure,
      });
      if (result) setSelectedItem(result);
    } else if (activeTab === 'schemas') {
      const result = await duplicateSchemaTemplate(item);
      if (result) setSelectedItem(result);
    }
    toast.success('Template duplicated');
  };

  const handleDelete = async (item) => {
    const name = activeTab === 'prompts' ? item.template_name : activeTab === 'schemas' ? item.schema_name : item.template_name;
    if (window.confirm(`Delete "${name}"?`)) {
      if (activeTab === 'prompts') {
        await deletePromptTemplate(item.row_id);
      } else if (activeTab === 'schemas') {
        await deleteSchemaTemplate(item.row_id);
      } else {
        await deleteExportTemplate(item.row_id);
      }
      if (selectedItem?.row_id === item.row_id) {
        setSelectedItem(null);
      }
    }
  };

  const handleImport = async (data) => {
    const result = await createPromptTemplate({
      name: data.name,
      description: data.description,
      category: data.category,
      structure: data.structure,
    });
    if (result && data.variableDefinitions?.length > 0) {
      await updatePromptTemplate(result.row_id, { variable_definitions: data.variableDefinitions });
    }
    if (result) setSelectedItem(result);
  };

  const getCategoryColor = (category, type = 'prompt') => {
    const categories = type === 'schema' ? SCHEMA_CATEGORIES : PROMPT_CATEGORIES;
    return categories.find(c => c.value === category)?.color || categories[0].color;
  };

  const countNodes = (node) => {
    if (!node) return 0;
    let count = 1;
    if (node.children) node.children.forEach(c => count += countNodes(c));
    return count;
  };

  // Clear selection when tab changes
  React.useEffect(() => {
    setSelectedItem(null);
    setSearchQuery('');
  }, [activeTab]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const renderListItem = (item) => {
    if (activeTab === 'prompts') {
      const varCount = extractTemplateVariables(item.structure).length;
      const nodeCount = countNodes(item.structure);
      return (
        <div
          key={item.row_id}
          onClick={() => setSelectedItem(item)}
          className={`p-3 rounded-lg cursor-pointer transition-colors group ${
            selectedItem?.row_id === item.row_id
              ? 'bg-primary/10 border border-primary/20'
              : 'hover:bg-muted/50 border border-transparent'
          }`}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate">{item.template_name}</p>
              {item.template_description && (
                <p className="text-xs text-muted-foreground truncate mt-0.5">{item.template_description}</p>
              )}
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[10px] text-muted-foreground">{nodeCount} nodes</span>
                {varCount > 0 && <span className="text-[10px] text-muted-foreground">• {varCount} vars</span>}
              </div>
            </div>
            <Badge variant="secondary" className={`text-[10px] shrink-0 ${getCategoryColor(item.category)}`}>
              {item.category || 'general'}
            </Badge>
          </div>
          <div className="flex items-center gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <Tooltip><TooltipTrigger asChild>
              <Button size="icon" variant="ghost" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); handleDuplicate(item); }}>
                <Copy className="h-3 w-3" />
              </Button>
            </TooltipTrigger><TooltipContent>Duplicate</TooltipContent></Tooltip>
            <ExportTemplateDialog template={item} trigger={
              <Button size="icon" variant="ghost" className="h-6 w-6" onClick={(e) => e.stopPropagation()}>
                <Download className="h-3 w-3" />
              </Button>
            } />
            <Tooltip><TooltipTrigger asChild>
              <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive" onClick={(e) => { e.stopPropagation(); handleDelete(item); }}>
                <Trash2 className="h-3 w-3" />
              </Button>
            </TooltipTrigger><TooltipContent>Delete</TooltipContent></Tooltip>
          </div>
        </div>
      );
    } else if (activeTab === 'schemas') {
      return (
        <div
          key={item.row_id}
          onClick={() => setSelectedItem(item)}
          className={`p-3 rounded-lg cursor-pointer transition-colors group ${
            selectedItem?.row_id === item.row_id
              ? 'bg-primary/10 border border-primary/20'
              : 'hover:bg-muted/50 border border-transparent'
          }`}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate">{item.schema_name}</p>
              {item.schema_description && (
                <p className="text-xs text-muted-foreground truncate mt-0.5">{item.schema_description}</p>
              )}
            </div>
            <Badge variant="secondary" className={`text-[10px] shrink-0 ${getCategoryColor(item.category, 'schema')}`}>
              {item.category || 'general'}
            </Badge>
          </div>
          <div className="flex items-center gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <Tooltip><TooltipTrigger asChild>
              <Button size="icon" variant="ghost" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); handleDuplicate(item); }}>
                <Copy className="h-3 w-3" />
              </Button>
            </TooltipTrigger><TooltipContent>Duplicate</TooltipContent></Tooltip>
            <Tooltip><TooltipTrigger asChild>
              <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive" onClick={(e) => { e.stopPropagation(); handleDelete(item); }}>
                <Trash2 className="h-3 w-3" />
              </Button>
            </TooltipTrigger><TooltipContent>Delete</TooltipContent></Tooltip>
          </div>
        </div>
      );
    } else {
      return (
        <div
          key={item.row_id}
          onClick={() => setSelectedItem(item)}
          className={`p-3 rounded-lg cursor-pointer transition-colors group ${
            selectedItem?.row_id === item.row_id
              ? 'bg-primary/10 border border-primary/20'
              : 'hover:bg-muted/50 border border-transparent'
          }`}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate">{item.template_name}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {item.selected_fields?.length || 0} fields • {Object.keys(item.selected_variables || {}).length} vars
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <Tooltip><TooltipTrigger asChild>
              <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive" onClick={(e) => { e.stopPropagation(); handleDelete(item); }}>
                <Trash2 className="h-3 w-3" />
              </Button>
            </TooltipTrigger><TooltipContent>Delete</TooltipContent></Tooltip>
          </div>
        </div>
      );
    }
  };

  const renderEditor = () => {
    if (!selectedItem) {
      const emptyMessages = {
        prompts: { title: 'Select a prompt template', description: 'Choose a template to view and edit, or create a new one.' },
        schemas: { title: 'Select a JSON schema', description: 'Choose a schema to view and edit, or create a new one.' },
        mappings: { title: 'Select a variable mapping', description: 'Choose a mapping template to view and edit.' }
      };
      return <EmptyState icon="template" {...emptyMessages[activeTab]} className="h-full" />;
    }

    if (activeTab === 'prompts') {
      return <TemplateEditor template={selectedItem} onUpdate={updatePromptTemplate} />;
    } else if (activeTab === 'schemas') {
      return <JsonSchemaEditor template={selectedItem} onUpdate={updateSchemaTemplate} />;
    } else {
      return <VariableMappingEditor template={selectedItem} onUpdate={updateExportTemplate} />;
    }
  };

  const getTabIcon = (tab) => {
    switch (tab) {
      case 'prompts': return <FileText className="h-4 w-4" />;
      case 'schemas': return <FileJson className="h-4 w-4" />;
      case 'mappings': return <Link2 className="h-4 w-4" />;
      default: return null;
    }
  };

  return (
    <TooltipProvider>
      <div className="flex h-[calc(100vh-4rem)] bg-background">
        {/* Left Panel - List */}
        <div className="w-80 border-r border-border flex flex-col">
          <div className="p-4 border-b border-border space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <LayoutTemplate className="h-5 w-5 text-primary" />
                Templates
              </h2>
              <div className="flex items-center gap-1">
                {activeTab === 'prompts' && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span>
                        <ImportTemplateDialog onImport={handleImport} trigger={
                          <Button size="icon" variant="ghost"><Upload className="h-4 w-4" /></Button>
                        } />
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>Import</TooltipContent>
                  </Tooltip>
                )}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button size="icon" variant="ghost" onClick={() => setShowCreateDialog(true)}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Create New</TooltipContent>
                </Tooltip>
              </div>
            </div>

            {/* Type Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="w-full grid grid-cols-3 h-8">
                <TabsTrigger value="prompts" className="text-xs gap-1 px-2">
                  {getTabIcon('prompts')}
                  <span className="hidden sm:inline">Prompts</span>
                </TabsTrigger>
                <TabsTrigger value="schemas" className="text-xs gap-1 px-2">
                  {getTabIcon('schemas')}
                  <span className="hidden sm:inline">Schemas</span>
                </TabsTrigger>
                <TabsTrigger value="mappings" className="text-xs gap-1 px-2">
                  {getTabIcon('mappings')}
                  <span className="hidden sm:inline">Mappings</span>
                </TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder={`Search ${activeTab}...`} 
                value={searchQuery} 
                onChange={(e) => setSearchQuery(e.target.value)} 
                className="pl-9" 
              />
            </div>
          </div>

          <ScrollArea className="flex-1">
            <div className="p-2 space-y-1">
              {filteredItems.length === 0 ? (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  {searchQuery ? 'No matches found' : `No ${activeTab} yet`}
                </div>
              ) : (
                filteredItems.map(item => renderListItem(item))
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Right Panel - Editor */}
        <div className="flex-1 overflow-hidden">
          {renderEditor()}
        </div>

        {/* Create Dialog */}
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                Create New {activeTab === 'prompts' ? 'Prompt Template' : activeTab === 'schemas' ? 'JSON Schema' : 'Variable Mapping'}
              </DialogTitle>
              <DialogDescription>
                {activeTab === 'prompts' && 'Create a reusable prompt structure.'}
                {activeTab === 'schemas' && 'Create a JSON schema for structured AI outputs.'}
                {activeTab === 'mappings' && 'Create a variable mapping template for exports.'}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Name</Label>
                <Input 
                  value={newTemplate.name} 
                  onChange={(e) => setNewTemplate(p => ({ ...p, name: e.target.value }))} 
                  placeholder="Template name" 
                />
              </div>
              {activeTab !== 'mappings' && (
                <>
                  <div>
                    <Label>Description</Label>
                    <Textarea 
                      value={newTemplate.description} 
                      onChange={(e) => setNewTemplate(p => ({ ...p, description: e.target.value }))} 
                      placeholder="Optional description" 
                      rows={2} 
                    />
                  </div>
                  <div>
                    <Label>Category</Label>
                    <Select value={newTemplate.category} onValueChange={(v) => setNewTemplate(p => ({ ...p, category: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {(activeTab === 'schemas' ? SCHEMA_CATEGORIES : PROMPT_CATEGORIES).map(c => (
                          <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Cancel</Button>
              <Button onClick={handleCreate}>Create</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
};

export default Templates;
