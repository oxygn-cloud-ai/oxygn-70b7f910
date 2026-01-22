import React, { useState, useEffect, useCallback } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FileText, GitBranch, Variable, Eye, Save, Loader2, Paperclip, LucideIcon } from 'lucide-react';
import { toast } from '@/components/ui/sonner';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { TOOLTIPS } from '@/config/labels';
import { usePromptLibrary } from '@/hooks/usePromptLibrary';
import TemplateOverviewTab from './TemplateOverviewTab';
import TemplateStructureEditor from './TemplateStructureEditor';
import TemplateVariablesTab from './TemplateVariablesTab';
import TemplatePreviewTab from './TemplatePreviewTab';
import TemplateAttachmentsTab from './TemplateAttachmentsTab';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface VariableDefinition {
  name: string;
  type?: string;
  default?: string;
  description?: string;
}

interface TemplateStructure {
  _id?: string;
  prompt_name: string;
  input_admin_prompt?: string;
  input_user_prompt?: string;
  note?: string;
  model?: string | null;
  children?: TemplateStructure[];
  attachments?: {
    confluencePages?: Array<{
      page_id: string;
      page_title: string;
      page_url?: string;
      space_key?: string;
    }>;
  };
  [key: string]: unknown;
}

interface Template {
  row_id: string;
  template_name: string;
  template_description?: string;
  category?: string;
  is_private?: boolean;
  structure?: TemplateStructure;
  variable_definitions?: VariableDefinition[];
}

interface TabConfig {
  id: string;
  label: string;
  icon: LucideIcon;
}

interface TemplateEditorProps {
  template: Template | null;
  onUpdate: (rowId: string, updates: Partial<Template>) => Promise<boolean>;
  onClose?: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

const TemplateEditor: React.FC<TemplateEditorProps> = ({ template, onUpdate, onClose }) => {
  const [activeTab, setActiveTab] = useState<string>('overview');
  const [editedTemplate, setEditedTemplate] = useState<Template | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [hasChanges, setHasChanges] = useState<boolean>(false);
  
  // Fetch library items for the ResizablePromptArea library picker
  const { libraryItems } = usePromptLibrary();

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

  const handleFieldChange = useCallback((field: keyof Template, value: unknown) => {
    setEditedTemplate(prev => {
      if (!prev) return prev;
      return { ...prev, [field]: value };
    });
    setHasChanges(true);
  }, []);

  const handleStructureChange = useCallback((newStructure: TemplateStructure) => {
    setEditedTemplate(prev => {
      if (!prev) return prev;
      return { ...prev, structure: newStructure };
    });
    setHasChanges(true);
  }, []);

  const handleVariablesChange = useCallback((newVariables: VariableDefinition[]) => {
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
      <div className="flex items-center justify-center h-full text-on-surface-variant">
        Select a template to edit
      </div>
    );
  }

  const tabs: TabConfig[] = [
    { id: 'overview', label: 'Overview', icon: FileText },
    { id: 'structure', label: 'Structure', icon: GitBranch },
    { id: 'variables', label: 'Variables', icon: Variable },
    { id: 'attachments', label: 'Attachments', icon: Paperclip },
    { id: 'preview', label: 'Preview', icon: Eye },
  ];

  return (
    <TooltipProvider>
      <div className="h-full flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-outline-variant">
          <div className="flex-1 min-w-0">
            <h3 className="text-title-sm font-medium text-on-surface truncate">{editedTemplate.template_name}</h3>
            {editedTemplate.template_description && (
              <p className="text-body-sm text-on-surface-variant truncate">{editedTemplate.template_description}</p>
            )}
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
          <div className="flex items-center border-b border-outline-variant px-4">
            <TabsList className="justify-start rounded-none bg-transparent h-auto py-0 gap-1">
              {tabs.map(tab => {
                const isActive = activeTab === tab.id;
                const IconComponent = tab.icon;
                return (
                  <Tooltip key={tab.id}>
                    <TooltipTrigger asChild>
                      <TabsTrigger
                        value={tab.id}
                        className="group rounded-none border-b-2 border-transparent py-3 px-3 transition-colors bg-transparent hover:bg-surface-container data-[state=active]:bg-transparent data-[state=active]:shadow-none"
                      >
                        <IconComponent
                          className={`h-4 w-4 transition-colors ${
                            isActive ? 'text-primary' : 'text-on-surface-variant group-hover:text-on-surface'
                          }`}
                        />
                      </TabsTrigger>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">
                      <p>{tab.label}</p>
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </TabsList>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={handleSave}
                  disabled={!hasChanges || isSaving}
                  className={`p-2 rounded-m3-full transition-colors ml-1 ${
                    hasChanges 
                      ? 'animate-attention-flash' 
                      : 'text-on-surface-variant opacity-50 cursor-not-allowed'
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
                structure={editedTemplate.structure!}
                onChange={handleStructureChange}
                variableDefinitions={editedTemplate.variable_definitions}
                libraryItems={libraryItems}
                templateId={editedTemplate.row_id}
              />
            </TabsContent>

            <TabsContent value="variables" className="h-full m-0 p-4 overflow-auto">
              <TemplateVariablesTab
                structure={editedTemplate.structure!}
                variableDefinitions={editedTemplate.variable_definitions!}
                onChange={handleVariablesChange}
                onStructureChange={handleStructureChange}
              />
            </TabsContent>

            <TabsContent value="preview" className="h-full m-0 p-4 overflow-auto">
              <TemplatePreviewTab
                template={editedTemplate}
              />
            </TabsContent>

            <TabsContent value="attachments" className="h-full m-0 p-4 overflow-auto">
              <TemplateAttachmentsTab
                template={editedTemplate}
                onChange={handleStructureChange}
              />
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </TooltipProvider>
  );
};

export default TemplateEditor;
