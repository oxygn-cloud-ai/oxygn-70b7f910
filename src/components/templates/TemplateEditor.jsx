import React, { useState, useEffect, useCallback } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FileText, GitBranch, Variable, Eye, Save, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/sonner';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { TOOLTIPS } from '@/config/labels';
import TemplateOverviewTab from './TemplateOverviewTab';
import TemplateStructureEditor from './TemplateStructureEditor';
import TemplateVariablesTab from './TemplateVariablesTab';
import TemplatePreviewTab from './TemplatePreviewTab';

/**
 * Main template editor with tabbed interface
 */
const TemplateEditor = ({ template, onUpdate, onClose }) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [editedTemplate, setEditedTemplate] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Initialize edited template when template prop changes
  useEffect(() => {
    if (template) {
      setEditedTemplate({
        ...template,
        structure: template.structure || { prompt_name: 'Root Prompt', children: [] },
        variable_definitions: template.variable_definitions || [],
      });
      setHasChanges(false);
    }
  }, [template?.row_id]);

  const handleFieldChange = useCallback((field, value) => {
    setEditedTemplate(prev => {
      if (!prev) return prev;
      return { ...prev, [field]: value };
    });
    setHasChanges(true);
  }, []);

  const handleStructureChange = useCallback((newStructure) => {
    setEditedTemplate(prev => {
      if (!prev) return prev;
      return { ...prev, structure: newStructure };
    });
    setHasChanges(true);
  }, []);

  const handleVariablesChange = useCallback((newVariables) => {
    setEditedTemplate(prev => {
      if (!prev) return prev;
      return { ...prev, variable_definitions: newVariables };
    });
    setHasChanges(true);
  }, []);

  const handleSave = async () => {
    if (!editedTemplate || !onUpdate) return;
    
    setIsSaving(true);
    try {
      const success = await onUpdate(editedTemplate.row_id, {
        template_name: editedTemplate.template_name,
        template_description: editedTemplate.template_description,
        category: editedTemplate.category,
        is_private: editedTemplate.is_private,
        structure: editedTemplate.structure,
        variable_definitions: editedTemplate.variable_definitions,
      });
      
      if (success) {
        setHasChanges(false);
        toast.success('Template saved');
      }
    } catch (error) {
      console.error('Error saving template:', error);
      toast.error('Failed to save template');
    } finally {
      setIsSaving(false);
    }
  };

  if (!editedTemplate) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        Select a template to edit
      </div>
    );
  }

  const tabs = [
    { id: 'overview', label: 'Overview', icon: FileText },
    { id: 'structure', label: 'Structure', icon: GitBranch },
    { id: 'variables', label: 'Variables', icon: Variable },
    { id: 'preview', label: 'Preview', icon: Eye },
  ];

  return (
    <TooltipProvider>
      <div className="h-full flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-semibold truncate">{editedTemplate.template_name}</h3>
            {editedTemplate.template_description && (
              <p className="text-sm text-muted-foreground truncate">{editedTemplate.template_description}</p>
            )}
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
          <div className="flex items-center border-b border-border px-4">
            <TabsList className="justify-start rounded-none bg-transparent h-auto py-0 gap-1">
              {tabs.map(tab => (
                <Tooltip key={tab.id}>
                  <TooltipTrigger asChild>
                    <TabsTrigger
                      value={tab.id}
                      className="rounded-none border-b-2 border-transparent py-3 px-3 transition-colors !text-muted-foreground hover:!text-foreground hover:!bg-sidebar-accent data-[state=active]:!text-primary data-[state=active]:!bg-transparent data-[state=active]:border-primary"
                    >
                      <tab.icon className="h-4 w-4" />
                    </TabsTrigger>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    <p>{tab.label}</p>
                  </TooltipContent>
                </Tooltip>
              ))}
            </TabsList>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={handleSave}
                  disabled={!hasChanges || isSaving}
                  className={`p-2 rounded-md transition-colors ml-1 ${
                    hasChanges 
                      ? 'animate-attention-flash' 
                      : 'text-muted-foreground opacity-50 cursor-not-allowed'
                  }`}
                >
                  {isSaving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p>{hasChanges ? TOOLTIPS.actions.save : TOOLTIPS.actions.noChanges}</p>
              </TooltipContent>
            </Tooltip>
          </div>

        <div className="flex-1 overflow-hidden">
          <TabsContent value="overview" className="h-full m-0 p-4 overflow-auto">
            <TemplateOverviewTab
              template={editedTemplate}
              onChange={handleFieldChange}
            />
          </TabsContent>

          <TabsContent value="structure" className="h-full m-0 overflow-hidden">
            <TemplateStructureEditor
              structure={editedTemplate.structure}
              onChange={handleStructureChange}
              variableDefinitions={editedTemplate.variable_definitions}
            />
          </TabsContent>

          <TabsContent value="variables" className="h-full m-0 p-4 overflow-auto">
            <TemplateVariablesTab
              structure={editedTemplate.structure}
              variableDefinitions={editedTemplate.variable_definitions}
              onChange={handleVariablesChange}
            />
          </TabsContent>

          <TabsContent value="preview" className="h-full m-0 p-4 overflow-auto">
            <TemplatePreviewTab
              template={editedTemplate}
            />
          </TabsContent>
        </div>
      </Tabs>
      </div>
    </TooltipProvider>
  );
};

export default TemplateEditor;
