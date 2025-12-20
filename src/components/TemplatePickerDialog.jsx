import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { LayoutTemplate, FileText, Search, ArrowRight } from 'lucide-react';
import { useTemplates } from '@/hooks/useTemplates';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/components/ui/sonner';

const TemplatePickerDialog = ({ 
  isOpen, 
  onClose, 
  parentId = null,
  onPromptCreated 
}) => {
  const { templates, isLoading, extractTemplateVariables } = useTemplates();
  const { user } = useAuth();
  const [step, setStep] = useState('select'); // 'select' | 'variables'
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [variableValues, setVariableValues] = useState({});
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const filteredTemplates = templates.filter(t => 
    t.template_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.category?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSelectTemplate = (template) => {
    setSelectedTemplate(template);
    const variables = extractTemplateVariables(template.structure);
    
    if (variables.length > 0) {
      // Initialize variable values
      const initialValues = {};
      variables.forEach(v => { initialValues[v] = ''; });
      setVariableValues(initialValues);
      setStep('variables');
    } else {
      // No variables, create directly
      handleCreateFromTemplate(template, {});
    }
  };

  const handleVariableChange = (name, value) => {
    setVariableValues(prev => ({ ...prev, [name]: value }));
  };

  const replaceVariables = (text, values) => {
    if (!text || typeof text !== 'string') return text;
    let result = text;
    Object.entries(values).forEach(([name, value]) => {
      result = result.replace(new RegExp(`\\{\\{${name}\\}\\}`, 'g'), value);
    });
    return result;
  };

  const handleCreateFromTemplate = async (template, values) => {
    setIsCreating(true);
    try {
      const structure = template?.structure || selectedTemplate?.structure;
      const vars = values || variableValues;

      // Recursive function to create prompts from structure
      const createPromptFromStructure = async (promptStructure, parentRowId) => {
        const { data, error } = await supabase
          .from(import.meta.env.VITE_PROMPTS_TBL)
          .insert({
            parent_row_id: parentRowId,
            prompt_name: replaceVariables(promptStructure.prompt_name, vars),
            input_admin_prompt: replaceVariables(promptStructure.input_admin_prompt, vars),
            input_user_prompt: replaceVariables(promptStructure.input_user_prompt, vars),
            model: promptStructure.model,
            temperature: promptStructure.temperature,
            max_tokens: promptStructure.max_tokens,
            top_p: promptStructure.top_p,
            frequency_penalty: promptStructure.frequency_penalty,
            presence_penalty: promptStructure.presence_penalty,
            is_assistant: promptStructure.is_assistant || false,
            owner_id: user?.id,
            template_row_id: template?.row_id || selectedTemplate?.row_id,
          })
          .select()
          .single();

        if (error) throw error;

        // Create children recursively
        if (promptStructure.children?.length > 0) {
          for (const child of promptStructure.children) {
            await createPromptFromStructure(child, data.row_id);
          }
        }

        return data;
      };

      const createdPrompt = await createPromptFromStructure(structure, parentId);
      
      toast.success('Prompt created from template');
      onPromptCreated?.(createdPrompt.row_id);
      handleClose();
    } catch (error) {
      console.error('Error creating from template:', error);
      toast.error('Failed to create prompt from template');
    } finally {
      setIsCreating(false);
    }
  };

  const handleClose = () => {
    setStep('select');
    setSelectedTemplate(null);
    setVariableValues({});
    setSearchQuery('');
    onClose();
  };

  const templateVariables = selectedTemplate ? extractTemplateVariables(selectedTemplate.structure) : [];

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LayoutTemplate className="h-5 w-5" />
            {step === 'select' ? 'Create from Template' : 'Fill Template Variables'}
          </DialogTitle>
          <DialogDescription>
            {step === 'select' 
              ? 'Choose a template to create a new prompt with predefined structure'
              : `Fill in the values for template variables in "${selectedTemplate?.template_name}"`
            }
          </DialogDescription>
        </DialogHeader>

        {step === 'select' && (
          <>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search templates..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            <ScrollArea className="h-[300px] pr-4">
              {isLoading ? (
                <div className="text-center py-8 text-muted-foreground">Loading templates...</div>
              ) : filteredTemplates.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  {searchQuery ? 'No templates match your search' : 'No templates available'}
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredTemplates.map(template => {
                    const variables = extractTemplateVariables(template.structure);
                    
                    return (
                      <div
                        key={template.row_id}
                        className="flex items-center justify-between p-3 rounded-lg border border-border hover:border-primary/50 hover:bg-muted/50 transition-colors cursor-pointer"
                        onClick={() => handleSelectTemplate(template)}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <LayoutTemplate className="h-4 w-4 text-primary flex-shrink-0" />
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
                              <span className="text-xs text-muted-foreground">{variables.length} variable{variables.length !== 1 ? 's' : ''}</span>
                            </div>
                          )}
                        </div>
                        <ArrowRight className="h-4 w-4 text-muted-foreground ml-2" />
                      </div>
                    );
                  })}
                </div>
              )}
            </ScrollArea>

            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>Cancel</Button>
            </DialogFooter>
          </>
        )}

        {step === 'variables' && (
          <>
            <ScrollArea className="max-h-[300px] pr-4">
              <div className="space-y-4">
                {templateVariables.map(varName => (
                  <div key={varName} className="space-y-2">
                    <Label htmlFor={varName} className="flex items-center gap-2">
                      <Badge variant="outline" className="font-mono text-xs">{`{{${varName}}}`}</Badge>
                    </Label>
                    <Input
                      id={varName}
                      value={variableValues[varName] || ''}
                      onChange={(e) => handleVariableChange(varName, e.target.value)}
                      placeholder={`Enter value for ${varName}`}
                    />
                  </div>
                ))}
              </div>
            </ScrollArea>

            <DialogFooter>
              <Button variant="outline" onClick={() => setStep('select')}>Back</Button>
              <Button 
                onClick={() => handleCreateFromTemplate(selectedTemplate, variableValues)}
                disabled={isCreating}
              >
                {isCreating ? 'Creating...' : 'Create Prompt'}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default TemplatePickerDialog;
