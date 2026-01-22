import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Save, Loader2 } from 'lucide-react';
import { toast } from '@/components/ui/sonner';

// Available fields that can be exported
const AVAILABLE_FIELDS = [
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

const VariableMappingEditor = ({ template, onUpdate }) => {
  const [editedTemplate, setEditedTemplate] = useState(template);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    setEditedTemplate(template);
    setHasChanges(false);
  }, [template.row_id]);

  const handleFieldChange = (field, value) => {
    setEditedTemplate(prev => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  const toggleField = (fieldKey) => {
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
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <Input
              value={editedTemplate.template_name || ''}
              onChange={(e) => handleFieldChange('template_name', e.target.value)}
              placeholder="Mapping template name"
              className="text-lg font-semibold h-9 border-0 px-0 focus-visible:ring-0"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Configure which fields to include in Confluence exports
            </p>
          </div>
          <Button 
            onClick={handleSave} 
            disabled={!hasChanges || isSaving}
            size="sm"
          >
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
            Save
          </Button>
        </div>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-6">
          {/* Field Selection */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Included Fields</Label>
            <p className="text-xs text-muted-foreground">
              Select which prompt fields to include when exporting to Confluence
            </p>
            
            <div className="grid grid-cols-2 gap-2">
              {AVAILABLE_FIELDS.map(field => (
                <div
                  key={field.key}
                  className="flex items-center space-x-2 p-2 rounded border border-border hover:bg-muted/50 transition-colors"
                >
                  <Checkbox
                    id={field.key}
                    checked={selectedFields.includes(field.key)}
                    onCheckedChange={() => toggleField(field.key)}
                  />
                  <label
                    htmlFor={field.key}
                    className="text-sm cursor-pointer flex-1"
                  >
                    {field.label}
                  </label>
                </div>
              ))}
            </div>
          </div>

          {/* Summary */}
          <div className="p-4 bg-muted/50 rounded-lg">
            <h4 className="text-sm font-medium mb-2">Template Summary</h4>
            <div className="text-xs text-muted-foreground space-y-1">
              <p>Selected fields: {selectedFields.length}</p>
              <p>Variables: {Object.keys(editedTemplate.selected_variables || {}).length}</p>
              <p>Export type: {editedTemplate.export_type || 'confluence'}</p>
            </div>
          </div>

          {/* Instructions */}
          <div className="p-4 border border-border rounded-lg">
            <h4 className="text-sm font-medium mb-2">How to use</h4>
            <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
              <li>Select the fields you want to include in exports</li>
              <li>Save the template</li>
              <li>When exporting, choose this template to apply these settings</li>
            </ol>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
};

export default VariableMappingEditor;
