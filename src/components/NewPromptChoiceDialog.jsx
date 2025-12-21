import React, { useState } from 'react';
import { FileText, LayoutTemplate, Search, ArrowRight, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useTemplates } from '@/hooks/useTemplates';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/components/ui/sonner';

const NewPromptChoiceDialog = ({ 
  isOpen, 
  onClose, 
  parentId = null,
  onCreatePlain,
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

  const handleCreatePlain = () => {
    onCreatePlain();
    handleClose();
  };

  const handleSelectTemplate = (template) => {
    setSelectedTemplate(template);
    const variables = extractTemplateVariables(template.structure);
    
    if (variables.length > 0) {
      const initialValues = {};
      variables.forEach(v => { initialValues[v] = ''; });
      setVariableValues(initialValues);
      setStep('variables');
    } else {
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
      const templateRowId = template?.row_id || selectedTemplate?.row_id;

      const getMaxPosition = async (parentRowId) => {
        let query = supabase
          .from(import.meta.env.VITE_PROMPTS_TBL)
          .select('position')
          .eq('is_deleted', false)
          .order('position', { ascending: false })
          .limit(1);
        
        if (parentRowId === null) {
          query = query.is('parent_row_id', null);
        } else {
          query = query.eq('parent_row_id', parentRowId);
        }
        
        const { data } = await query;
        return data?.[0]?.position || 0;
      };

      const createAssistant = async (promptRowId, promptName) => {
        try {
          const { data: assistant, error: createError } = await supabase
            .from(import.meta.env.VITE_ASSISTANTS_TBL)
            .insert([{
              prompt_row_id: promptRowId,
              name: promptName,
              status: 'not_instantiated',
              use_global_tool_defaults: true,
            }])
            .select()
            .maybeSingle();

          if (createError) {
            console.error('Failed to create assistant record:', createError);
            return;
          }

          supabase.functions.invoke('assistant-manager', {
            body: {
              action: 'instantiate',
              assistant_row_id: assistant.row_id,
            },
          }).catch(err => console.error('Assistant instantiation error:', err));
        } catch (error) {
          console.error('Error creating assistant:', error);
        }
      };

      const createPromptFromStructure = async (promptStructure, parentRowId, positionOffset = 0) => {
        const maxPosition = await getMaxPosition(parentRowId);
        const newPosition = maxPosition + 1000000 + positionOffset;
        const isTopLevel = parentRowId === null;

        const insertData = {
          parent_row_id: parentRowId,
          prompt_name: replaceVariables(promptStructure.prompt_name, vars),
          input_admin_prompt: replaceVariables(promptStructure.input_admin_prompt, vars),
          input_user_prompt: replaceVariables(promptStructure.input_user_prompt, vars),
          note: replaceVariables(promptStructure.note, vars),
          owner_id: user?.id,
          template_row_id: templateRowId,
          position: newPosition,
          is_deleted: false,
        };

        // Copy all model and settings fields from template
        const settingsFields = [
          'model', 'model_on',
          'temperature', 'temperature_on',
          'max_tokens', 'max_tokens_on',
          'top_p', 'top_p_on',
          'frequency_penalty', 'frequency_penalty_on',
          'presence_penalty', 'presence_penalty_on',
          'stop', 'stop_on',
          'response_format', 'response_format_on',
          'n', 'n_on',
          'logit_bias', 'logit_bias_on',
          'o_user', 'o_user_on',
          'stream', 'stream_on',
        ];
        
        settingsFields.forEach(field => {
          if (promptStructure[field] !== undefined && promptStructure[field] !== null) {
            insertData[field] = promptStructure[field];
          }
        });

        // Assistant settings
        if (promptStructure.is_assistant !== undefined) {
          insertData.is_assistant = promptStructure.is_assistant;
        } else if (isTopLevel) {
          insertData.is_assistant = true;
        }

        if (promptStructure.thread_mode) {
          insertData.thread_mode = promptStructure.thread_mode;
        }
        if (promptStructure.child_thread_strategy) {
          insertData.child_thread_strategy = promptStructure.child_thread_strategy;
        }
        if (promptStructure.default_child_thread_strategy) {
          insertData.default_child_thread_strategy = promptStructure.default_child_thread_strategy;
        }

        // Tools
        if (promptStructure.web_search_on !== undefined) {
          insertData.web_search_on = promptStructure.web_search_on;
        }
        if (promptStructure.confluence_enabled !== undefined) {
          insertData.confluence_enabled = promptStructure.confluence_enabled;
        }

        const { data, error } = await supabase
          .from(import.meta.env.VITE_PROMPTS_TBL)
          .insert(insertData)
          .select()
          .single();

        if (error) throw error;

        if (isTopLevel && (insertData.is_assistant || insertData.is_assistant === undefined)) {
          createAssistant(data.row_id, insertData.prompt_name);
        }

        if (promptStructure.children?.length > 0) {
          for (let i = 0; i < promptStructure.children.length; i++) {
            await createPromptFromStructure(promptStructure.children[i], data.row_id, i * 1000);
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
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {step === 'select' ? 'Create New Prompt' : (
              <>
                <LayoutTemplate className="h-5 w-5" />
                Fill Template Variables
              </>
            )}
          </DialogTitle>
          {step === 'variables' && (
            <DialogDescription>
              Fill in the values for template variables in "{selectedTemplate?.template_name}"
            </DialogDescription>
          )}
        </DialogHeader>

        {step === 'select' && (
          <>
            {/* Start from Scratch - Primary Option */}
            <button
              onClick={handleCreatePlain}
              className="group relative flex items-center gap-3 p-3 rounded-lg border-2 border-border bg-card hover:border-primary hover:bg-primary/5 transition-all text-left w-full"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted group-hover:bg-primary/10 transition-colors">
                <FileText className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
              <div className="flex-1">
                <h3 className="font-medium text-foreground text-sm">Start from Scratch</h3>
                <p className="text-xs text-muted-foreground">Create a blank prompt</p>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
            </button>

            <div className="flex items-center gap-2 py-1">
              <Separator className="flex-1" />
              <span className="text-xs text-muted-foreground px-2">or use a template</span>
              <Separator className="flex-1" />
            </div>

            {/* Search Templates */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search templates..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Template List */}
            <ScrollArea className="h-[240px] pr-2">
              {isLoading ? (
                <div className="flex items-center justify-center py-8 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin mr-2" />
                  Loading templates...
                </div>
              ) : filteredTemplates.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  {searchQuery ? 'No templates match your search' : 'No templates available'}
                </div>
              ) : (
                <div className="space-y-1.5">
                  {filteredTemplates.map(template => {
                    const variables = extractTemplateVariables(template.structure);
                    const childCount = template.structure?.children?.length || 0;
                    
                    return (
                      <button
                        key={template.row_id}
                        className="flex items-center justify-between w-full p-2.5 rounded-lg border border-border hover:border-primary/50 hover:bg-muted/50 transition-colors text-left"
                        onClick={() => handleSelectTemplate(template)}
                      >
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <LayoutTemplate className="h-4 w-4 text-primary flex-shrink-0" />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-medium text-sm truncate">{template.template_name}</span>
                              {template.category && (
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0">{template.category}</Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5">
                              {childCount > 0 && <span>{childCount} child{childCount !== 1 ? 'ren' : ''}</span>}
                              {variables.length > 0 && <span>• {variables.length} var{variables.length !== 1 ? 's' : ''}</span>}
                            </div>
                          </div>
                        </div>
                        <ArrowRight className="h-4 w-4 text-muted-foreground ml-2 flex-shrink-0" />
                      </button>
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
                {isCreating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Creating...
                  </>
                ) : 'Create Prompt'}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default NewPromptChoiceDialog;
