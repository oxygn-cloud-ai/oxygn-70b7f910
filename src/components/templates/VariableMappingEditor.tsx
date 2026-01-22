import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Save, Loader2 } from 'lucide-react';
import { toast } from '@/components/ui/sonner';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface AvailableField {
  key: string;
  label: string;
}

interface MappingTemplate {
  row_id: string;
  template_name?: string;
  selected_fields?: string[];
  selected_variables?: Record<string, unknown>;
  confluence_config?: Record<string, unknown>;
  export_type?: string;
}

interface VariableMappingEditorProps {
  template: MappingTemplate;
  onUpdate: (rowId: string, updates: Partial<MappingTemplate>) => Promise<void>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const AVAILABLE_FIELDS: AvailableField[] = [
  { key: 'prompt_name', label: 'Prompt Name' },
  { key: 'input_admin_prompt', label: 'Admin Prompt' },
  { key: 'input_user_prompt', label: 'User Prompt' },
  { key: 'admin_prompt_result', label: 'Admin Result' },
  { key: 'user_prompt_result', label: 'User Result' },
  { key: 'output_response', label: 'Output Response' },
  { key: 'note', label: 'Note' },
  { key: 'model', label: 'Model' },
  { key: 'temperature', label: 'Temperature' },
  { key: 'max_tokens', label: 'Max Tokens' },
];

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

const VariableMappingEditor: React.FC<VariableMappingEditorProps> = ({ template, onUpdate }) => {
  const [editedTemplate, setEditedTemplate] = useState<MappingTemplate>(template);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [hasChanges, setHasChanges] = useState<boolean>(false);

  useEffect(() => {
    setEditedTemplate(template);
    setHasChanges(false);
  }, [template.row_id]);

  const handleFieldChange = (field: keyof MappingTemplate, value: unknown) => {
    setEditedTemplate(prev => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  const toggleField = (fieldKey: string) => {
    const currentFields = editedTemplate.selected_fields || [];
    const newFields = currentFields.includes(fieldKey)
      ? currentFields.filter(f => f !== fieldKey)
      : [...currentFields, fieldKey];
    handleFieldChange('selected_fields', newFields);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onUpdate(template.row_id, {
        template_name: editedTemplate.template_name,
        selected_fields: editedTemplate.selected_fields,
        selected_variables: editedTemplate.selected_variables,
        confluence_config: editedTemplate.confluence_config
      });
      setHasChanges(false);
      toast.success('Mapping template saved');
    } catch (error) {
      console.error('Save error:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const selectedFields = editedTemplate.selected_fields || [];

  return (
    <TooltipProvider>
      <div className="h-full flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-outline-variant">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <Input
                value={editedTemplate.template_name || ''}
                onChange={(e) => handleFieldChange('template_name', e.target.value)}
                placeholder="Mapping template name"
                className="text-title-sm font-medium h-9 border-0 px-0 focus-visible:ring-0 bg-transparent"
              />
              <p className="text-[10px] text-on-surface-variant mt-1">
                Configure which fields to include in Confluence exports
              </p>
            </div>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={handleSave}
                  disabled={!hasChanges || isSaving}
                  className={`w-8 h-8 flex items-center justify-center rounded-m3-full transition-colors ${
                    hasChanges 
                      ? 'text-primary hover:bg-surface-container' 
                      : 'text-on-surface-variant opacity-50 cursor-not-allowed'
                  }`}
                >
                  {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                </button>
              </TooltipTrigger>
              <TooltipContent>Save</TooltipContent>
            </Tooltip>
          </div>
        </div>

        {/* Content */}
        <ScrollArea className="flex-1">
          <div className="p-4 space-y-6">
            {/* Field Selection */}
            <div className="space-y-3">
              <Label className="text-label-sm text-on-surface-variant">Included Fields</Label>
              <p className="text-[10px] text-on-surface-variant">
                Select which prompt fields to include when exporting to Confluence
              </p>
              
              <div className="grid grid-cols-2 gap-2">
                {AVAILABLE_FIELDS.map(field => (
                  <div
                    key={field.key}
                    className="flex items-center space-x-2 p-2 rounded-m3-sm border border-outline-variant hover:bg-surface-container-low transition-colors"
                  >
                    <Checkbox
                      id={field.key}
                      checked={selectedFields.includes(field.key)}
                      onCheckedChange={() => toggleField(field.key)}
                    />
                    <label
                      htmlFor={field.key}
                      className="text-body-sm text-on-surface cursor-pointer flex-1"
                    >
                      {field.label}
                    </label>
                  </div>
                ))}
              </div>
            </div>

            {/* Summary */}
            <div className="p-3 bg-surface-container-low rounded-m3-md">
              <h4 className="text-label-sm text-on-surface-variant mb-2">Template Summary</h4>
              <div className="text-[10px] text-on-surface-variant space-y-1">
                <p>Selected fields: {selectedFields.length}</p>
                <p>Variables: {Object.keys(editedTemplate.selected_variables || {}).length}</p>
                <p>Export type: {editedTemplate.export_type || 'confluence'}</p>
              </div>
            </div>

            {/* Instructions */}
            <div className="p-3 border border-outline-variant rounded-m3-md">
              <h4 className="text-label-sm text-on-surface-variant mb-2">How to use</h4>
              <ol className="text-[10px] text-on-surface-variant space-y-1 list-decimal list-inside">
                <li>Select the fields you want to include in exports</li>
                <li>Save the template</li>
                <li>When exporting, choose this template to apply these settings</li>
              </ol>
            </div>
          </div>
        </ScrollArea>
      </div>
    </TooltipProvider>
  );
};

export default VariableMappingEditor;
