/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { LayoutTemplate, Search, ArrowRight, ArrowLeft, Plus, Loader2, X } from 'lucide-react';
import { useTemplates } from '@/hooks/useTemplates';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/components/ui/sonner';
import { generatePositionAtEnd } from '@/utils/lexPosition';
import { CONTEXT_VARIABLE_KEYS } from '@/config/contextVariables';

interface TemplatePickerDialogProps {
  isOpen: boolean;
  onClose: () => void;
  parentId?: string | null;
  onPromptCreated?: (rowId: string) => void;
}

const TemplatePickerDialog = ({ 
  isOpen, 
  onClose, 
  parentId = null,
  onPromptCreated 
}: TemplatePickerDialogProps) => {
  const { templates, isLoading, extractTemplateVariables, fetchTemplates } = useTemplates();
  
  useEffect(() => {
    if (isOpen) {
      fetchTemplates();
    }
  }, [isOpen, fetchTemplates]);
  const { user } = useAuth();
  const [step, setStep] = useState('select');
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
  const [variableValues, setVariableValues] = useState<Record<string, string>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [promptNameOverride, setPromptNameOverride] = useState('');
  const [policyBaseName, setPolicyBaseName] = useState('');
  const isTopLevel = parentId === null;

  const filteredTemplates = (templates as any[]).filter((t: any) => 
    t.template_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.category?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const computedPromptName = useMemo(() => {
    const baseName = policyBaseName.trim();
    if (!baseName) return '';
    if (isTopLevel) {
      return `${baseName} (Master) (DRAFT)`;
    }
    return baseName;
  }, [policyBaseName, isTopLevel]);

  const finalPromptName = promptNameOverride || computedPromptName;

  const handleSelectTemplate = (template: any) => {
    setSelectedTemplate(template);
    const variables = extractTemplateVariables(template.structure);
    
    const crossFamilyWarnings = detectCrossFamilyRefs(template.structure);
    if (crossFamilyWarnings.length > 0) {
      console.warn('Template contains hardcoded q.ref UUIDs:', crossFamilyWarnings);
      toast.warning('This template contains hardcoded references that may not work correctly.');
    }
    
    const initialValues: Record<string, string> = {};
    (variables as string[]).forEach((v: string) => { initialValues[v] = ''; });
    
    setPolicyBaseName('');
    setPromptNameOverride('');
    setVariableValues(initialValues);
    
    if (isTopLevel || variables.length > 0) {
      setStep('variables');
    } else {
      handleCreateFromTemplate(template, initialValues);
    }
  };

  const handleVariableChange = (name: string, value: string) => {
    setVariableValues(prev => ({ ...prev, [name]: value }));
  };

  const replaceVariables = (text: any, values: Record<string, string>) => {
    if (!text || typeof text !== 'string') return text;
    let result = text;
    Object.entries(values).forEach(([name, value]) => {
      const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      result = result.replace(new RegExp(`\\{\\{${escapedName}\\}\\}`, 'g'), value as string);
    });
    result = result.replace(/\{\{q\.ref\[TEMPLATE_REF\]\.[a-z_]+\}\}/gi, '');
    return result;
  };

  const detectCrossFamilyRefs = (structure: any) => {
    const qRefPattern = /\{\{q\.ref\[[a-f0-9-]{36}\]\.[a-z_]+\}\}/gi;
    const warnings: Array<{ path: string; refs: string[] }> = [];
    
    const scanObject = (obj: any, path = '') => {
      if (!obj) return;
      if (typeof obj === 'string') {
        const matches = obj.match(qRefPattern);
        if (matches) {
          warnings.push({ path, refs: matches });
        }
      } else if (Array.isArray(obj)) {
        obj.forEach((item: any, i: number) => scanObject(item, `${path}[${i}]`));
      } else if (typeof obj === 'object') {
        Object.entries(obj).forEach(([key, value]) => scanObject(value, path ? `${path}.${key}` : key));
      }
    };
    
    scanObject(structure);
    return warnings;
  };

  const handleCreateFromTemplate = async (template: any, values: Record<string, string>) => {
    setIsCreating(true);
    try {
      const structure = template?.structure || selectedTemplate?.structure;
      const vars = values || variableValues;
      const templateRowId = template?.row_id || selectedTemplate?.row_id;

      const { data: settingsData } = await supabase
        .from(import.meta.env.VITE_SETTINGS_TBL)
        .select('setting_key, setting_value')
        .in('setting_key', ['default_model', 'def_assistant_instructions']);

      const settingsMap: Record<string, any> = {};
      (settingsData as any[])?.forEach((row: any) => {
        settingsMap[row.setting_key] = row.setting_value;
      });

      const defaultModelId = settingsMap.default_model;
      const defAssistantInstructions = settingsMap.def_assistant_instructions || '';

      const modelDefaults: Record<string, any> = {};
      if (defaultModelId) {
        const { data: defaultsData } = await supabase
          .from(import.meta.env.VITE_MODEL_DEFAULTS_TBL)
          .select('*')
          .eq('model_id', defaultModelId)
          .maybeSingle();

        if (defaultsData) {
          const defaultSettingFields = ['temperature', 'max_tokens', 'top_p', 'frequency_penalty', 
            'presence_penalty', 'stop', 'n', 'stream', 'response_format', 'logit_bias', 'o_user'];
          
          defaultSettingFields.forEach(field => {
            if ((defaultsData as any)[`${field}_on`]) {
              modelDefaults[field] = (defaultsData as any)[field];
              modelDefaults[`${field}_on`] = true;
            }
          });
          
          modelDefaults.model = defaultModelId;
          modelDefaults.model_on = true;
        }
      }

      const getLastPositionKey = async (parentRowId: string | null) => {
        let query = supabase
          .from(import.meta.env.VITE_PROMPTS_TBL)
          .select('position_lex')
          .eq('is_deleted', false)
          .not('position_lex', 'is', null)
          .order('position_lex', { ascending: false })
          .limit(1);
        
        if (parentRowId === null) {
          query = query.is('parent_row_id', null);
        } else {
          query = query.eq('parent_row_id', parentRowId);
        }
        
        const { data } = await query;
        return (data as any)?.[0]?.position_lex || null;
      };
      
      const positionKeyCache = new Map<string | null, string | null>();

      const createConversation = async (promptRowId: string, promptName: string, instructions = '') => {
        try {
          const insertData: Record<string, any> = {
            prompt_row_id: promptRowId,
            name: promptName,
            status: 'active',
            api_version: 'responses',
            use_global_tool_defaults: true,
          };
          
          if (instructions) {
            insertData.instructions = instructions;
          }
          
          const { data: conversation, error: createError } = await supabase
            .from(import.meta.env.VITE_ASSISTANTS_TBL)
            .insert([insertData])
            .select()
            .maybeSingle();

          if (createError) {
            console.error('Failed to create conversation record:', createError);
            return null;
          }

          console.log('Created conversation record:', (conversation as any)?.row_id);
          return (conversation as any)?.row_id;
        } catch (error) {
          console.error('Error creating conversation:', error);
          return null;
        }
      };

      const createPromptFromStructure = async (promptStructure: any, parentRowId: string | null, _childIndex = 0, overridePromptName: string | null = null): Promise<any> => {
        let currentLastKey = positionKeyCache.get(parentRowId);
        if (currentLastKey === undefined) {
          currentLastKey = await getLastPositionKey(parentRowId);
        }
        const newPositionLex = generatePositionAtEnd(currentLastKey);
        positionKeyCache.set(parentRowId, newPositionLex);
        
        const isTopLevelPrompt = parentRowId === null;

        let promptName: string;
        if (isTopLevelPrompt && overridePromptName) {
          promptName = overridePromptName;
        } else {
          promptName = replaceVariables(promptStructure.prompt_name, vars);
        }

        const systemVariables: Record<string, string> = {};
        Object.entries(vars).forEach(([key, value]) => {
          if (key.startsWith('q.') && 
              value !== undefined && value !== null && value !== '' &&
              !CONTEXT_VARIABLE_KEYS.includes(key)) {
            systemVariables[key] = String(value);
          }
        });

        const insertData: Record<string, any> = {
          parent_row_id: parentRowId,
          prompt_name: promptName,
          input_admin_prompt: replaceVariables(promptStructure.input_admin_prompt, vars),
          input_user_prompt: replaceVariables(promptStructure.input_user_prompt, vars),
          note: replaceVariables(promptStructure.note, vars),
          owner_id: user?.id,
          template_row_id: templateRowId,
          position_lex: newPositionLex,
          is_deleted: false,
          system_variables: Object.keys(systemVariables).length > 0 ? systemVariables : null,
          ...modelDefaults,
        };

        const modelFields = [
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
        
        modelFields.forEach(field => {
          if (promptStructure[field] !== undefined && promptStructure[field] !== null) {
            insertData[field] = promptStructure[field];
          }
        });

        if (promptStructure.is_assistant !== undefined) {
          insertData.is_assistant = promptStructure.is_assistant;
        } else if (isTopLevelPrompt) {
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
        if (promptStructure.web_search_on !== undefined) {
          insertData.web_search_on = promptStructure.web_search_on;
        }
        if (promptStructure.confluence_enabled !== undefined) {
          insertData.confluence_enabled = promptStructure.confluence_enabled;
        }
        
        if (promptStructure.node_type) {
          insertData.node_type = promptStructure.node_type;
        }
        if (promptStructure.post_action) {
          insertData.post_action = promptStructure.post_action;
          insertData.node_type = 'action';
        }
        if (promptStructure.post_action_config) {
          insertData.post_action_config = promptStructure.post_action_config;
        }
        if (promptStructure.json_schema_template_id) {
          insertData.json_schema_template_id = promptStructure.json_schema_template_id;
        }

        const { data, error } = await supabase
          .from(import.meta.env.VITE_PROMPTS_TBL)
          .insert(insertData)
          .select()
          .maybeSingle();

        if (error) {
          console.error('Prompt insert error:', error);
          throw new Error(`Insert failed: ${error.message} (code: ${error.code})`);
        }
        
        if (!data) {
          throw new Error('Insert succeeded but no data returned');
        }

        if (isTopLevelPrompt && (insertData.is_assistant || insertData.is_assistant === undefined)) {
          const templateInstructions = replaceVariables(promptStructure.assistant_instructions, vars);
          const conversationInstructions = templateInstructions || defAssistantInstructions || '';
          const conversationRowId = await createConversation((data as any).row_id, insertData.prompt_name, conversationInstructions);
          
          const templateAttachments = structure.attachments?.confluencePages || [];
          if (conversationRowId && templateAttachments.length > 0) {
            for (const page of templateAttachments) {
              try {
                await supabase.functions.invoke('confluence-manager', {
                  body: { 
                    action: 'attach-page', 
                    pageId: page.page_id,
                    assistantRowId: conversationRowId,
                  }
                });
              } catch (e) {
                console.warn('Failed to attach template page:', page.page_title, e);
              }
            }
          }
        }

        if (promptStructure.children?.length > 0) {
          positionKeyCache.delete((data as any).row_id);
          for (let i = 0; i < promptStructure.children.length; i++) {
            await createPromptFromStructure(promptStructure.children[i], (data as any).row_id, i, null);
          }
        }

        return data;
      };

      const createdPrompt = await createPromptFromStructure(structure, parentId, 0, finalPromptName);
      
      toast.success('Prompt created from template');
      onPromptCreated?.(createdPrompt.row_id);
      handleClose();
    } catch (error) {
      console.error('Error creating from template:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast.error(`Failed to create prompt: ${errorMessage}`);
    } finally {
      setIsCreating(false);
    }
  };

  const handleClose = () => {
    setStep('select');
    setSelectedTemplate(null);
    setVariableValues({});
    setSearchQuery('');
    setPolicyBaseName('');
    setPromptNameOverride('');
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
                  {filteredTemplates.map((template: any) => {
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
              <Button
                variant="ghost"
                size="icon"
                onClick={handleClose}
                title="Cancel"
                aria-label="Cancel"
              >
                <X className="h-4 w-4" />
              </Button>
            </DialogFooter>
          </>
        )}

        {step === 'variables' && (
          <>
            <ScrollArea className="max-h-[300px] pr-4">
              <div className="space-y-4">
                {isTopLevel && (
                  <div className="space-y-3 pb-3 border-b border-border">
                    <div className="space-y-2">
                      <Label htmlFor="policy-base-name" className="flex items-center gap-2">
                        <Badge variant="default" className="font-mono text-xs">Policy Name</Badge>
                        <span className="text-destructive text-xs">*</span>
                      </Label>
                      <Input
                        id="policy-base-name"
                        value={policyBaseName}
                        onChange={(e) => {
                          setPolicyBaseName(e.target.value);
                          setPromptNameOverride('');
                        }}
                        placeholder="Enter policy name"
                      />
                    </div>
                    {policyBaseName.trim() && (
                      <div className="space-y-2">
                        <Label htmlFor="final-prompt-name">
                          <Badge variant="secondary" className="font-mono text-xs">Final Prompt Name</Badge>
                        </Label>
                        <Input
                          id="final-prompt-name"
                          value={promptNameOverride || computedPromptName}
                          onChange={(e) => setPromptNameOverride(e.target.value)}
                        />
                      </div>
                    )}
                  </div>
                )}
                
                {(templateVariables as string[]).map((varName: string) => (
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
              <Button variant="ghost" size="icon" onClick={() => setStep('select')} title="Back">
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <Button 
                variant="ghost"
                size="icon"
                onClick={() => handleCreateFromTemplate(selectedTemplate, variableValues)}
                disabled={isCreating || (isTopLevel && !policyBaseName.trim())}
                title="Create"
              >
                {isCreating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default TemplatePickerDialog;
