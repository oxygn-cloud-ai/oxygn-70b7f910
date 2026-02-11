import { useState, useEffect, useMemo } from 'react';
import { FileText, LayoutTemplate, Search, ArrowRight, Loader2, Settings2, Lock, ArrowLeft, Plus, X } from 'lucide-react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useTemplates } from '@/hooks/useTemplates';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/components/ui/sonner';
import { trackEvent } from '@/lib/posthog';
import { generatePositionAtEnd } from '@/utils/lexPosition';
import {
  SYSTEM_VARIABLE_TYPES,
  isStaticSystemVariable,
  resolveStaticVariables,
  categorizeVariables,
  getSystemVariable,
} from '@/config/systemVariables';
import { CONTEXT_VARIABLE_KEYS } from '@/config/contextVariables';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TemplateStructure = any;

interface VariableInfo {
  label: string;
  description: string;
  type: string;
  options?: string[];
  placeholder?: string;
  required: boolean;
  isSystem: boolean;
  hasDefault?: boolean;
}

interface NewPromptChoiceDialogProps {
  isOpen: boolean;
  onClose: () => void;
  parentId?: string | null;
  onCreatePlain: () => void;
  onPromptCreated?: (rowId: string) => void;
}

const NewPromptChoiceDialog: React.FC<NewPromptChoiceDialogProps> = ({
  isOpen, 
  onClose, 
  parentId = null,
  onCreatePlain,
  onPromptCreated 
}) => {
  const { templates, isLoading, extractTemplateVariables, fetchTemplates } = useTemplates();
  
  useEffect(() => {
    if (isOpen) {
      fetchTemplates();
    }
  }, [isOpen, fetchTemplates]);
  const { user, userProfile } = useAuth();
  const [step, setStep] = useState<'select' | 'variables'>('select');
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateStructure | null>(null);
  const [variableValues, setVariableValues] = useState<Record<string, string>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [promptNameOverride, setPromptNameOverride] = useState('');
  const [policyBaseName, setPolicyBaseName] = useState('');
  const isTopLevel = parentId === null;

  const filteredTemplates = templates.filter((t: TemplateStructure) => 
    t.template_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.category?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreatePlain = () => {
    trackEvent('prompt_created_plain', { is_top_level: isTopLevel, parent_id: parentId });
    onCreatePlain();
    handleClose();
  };

  const handleSelectTemplate = (template: TemplateStructure) => {
    setSelectedTemplate(template);
    const variables = extractTemplateVariables(template.structure) as string[];
    
    const initialValues: Record<string, string> = {};
    const variableDefs = template.variable_definitions || [];
    
    const staticVars = resolveStaticVariables({
      user: userProfile || { email: user?.email },
    });
    Object.assign(initialValues, staticVars);
    
    setPolicyBaseName('');
    
    variables.forEach((v: string) => {
      if (isStaticSystemVariable(v)) {
        return;
      }
      
      const sysVar = getSystemVariable(v);
      if (sysVar?.type === SYSTEM_VARIABLE_TYPES.RUNTIME) {
        return;
      }
      
      if (sysVar) {
        initialValues[v] = '';
      } else {
        const def = variableDefs.find((d: TemplateStructure) => d.name === v);
        initialValues[v] = def?.default || '';
      }
    });
    
    setVariableValues(initialValues);
    setPromptNameOverride('');
    
    if (isTopLevel || variables.length > 0) {
      setStep('variables');
    } else {
      handleCreateFromTemplate(template, initialValues);
    }
  };

  const computedPromptName = useMemo(() => {
    const baseName = policyBaseName.trim();
    if (!baseName) return '';
    
    if (isTopLevel) {
      return `${baseName} (Master) (DRAFT)`;
    }
    return baseName;
  }, [policyBaseName, isTopLevel]);

  const finalPromptName = promptNameOverride || computedPromptName;

  const handleVariableChange = (name: string, value: string) => {
    setVariableValues(prev => ({ ...prev, [name]: value }));
  };

  const replaceVariables = (text: string | null | undefined, values: Record<string, string>): string => {
    if (!text || typeof text !== 'string') return text ?? '';
    let result = text;
    Object.entries(values).forEach(([name, value]) => {
      const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      result = result.replace(new RegExp(`\\{\\{${escapedName}\\}\\}`, 'g'), value as string);
    });
    return result;
  };

  const handleCreateFromTemplate = async (template: TemplateStructure | null, values: Record<string, string> | null) => {
    setIsCreating(true);
    try {
      const structure = template?.structure || selectedTemplate?.structure;
      const vars = values || variableValues;
      const templateRowId = template?.row_id || selectedTemplate?.row_id;

      const { data: settingsData } = await supabase
        .from(import.meta.env.VITE_SETTINGS_TBL)
        .select('setting_key, setting_value');

      const settingsMap: Record<string, string> = {};
      if (settingsData) {
        (settingsData as TemplateStructure[]).forEach((row: TemplateStructure) => {
          settingsMap[row.setting_key as string] = row.setting_value as string;
        });
      }

      const defaultModelId = settingsMap.default_model;
      const defAssistantInstructions = settingsMap.def_assistant_instructions || '';

      const modelDefaults: Record<string, string | boolean> = {};
      if (defaultModelId) {
        const { data: defaultsData } = await supabase
          .from(import.meta.env.VITE_MODEL_DEFAULTS_TBL)
          .select('*')
          .eq('model_id', defaultModelId)
          .maybeSingle();

        if (defaultsData) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const typedDefaults = defaultsData as any;
          const defaultSettingFields = ['temperature', 'max_tokens', 'top_p', 'frequency_penalty', 
            'presence_penalty', 'stop', 'n', 'stream', 'response_format', 'logit_bias', 'o_user'];
          
          defaultSettingFields.forEach(field => {
            if (typedDefaults[`${field}_on`]) {
              modelDefaults[field] = typedDefaults[field] as string;
              modelDefaults[`${field}_on`] = true;
            }
          });
          
          modelDefaults.model = defaultModelId;
          modelDefaults.model_on = true;
        }
      }

      const getLastPositionKey = async (parentRowId: string | null): Promise<string | null> => {
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
        const rows = data as TemplateStructure[] | null;
        return rows?.[0]?.position_lex || null;
      };

      const createConversation = async (promptRowId: string, promptName: string, instructions = '') => {
        try {
          const insertData: Record<string, unknown> = {
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
            return;
          }

          console.log('Created conversation record:', (conversation as TemplateStructure)?.row_id);
        } catch (error) {
          console.error('Error creating conversation:', error);
        }
      };

      let topLevelPromptName = '';
      const positionKeyCache = new Map<string | null, string | null>();
      
      const createPromptFromStructure = async (
        promptStructure: TemplateStructure, 
        parentRowId: string | null, 
        _childIndex = 0, 
        parentPromptName = '', 
        overridePromptName: string | null = null
      ): Promise<TemplateStructure> => {
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
        
        if (isTopLevelPrompt) {
          topLevelPromptName = promptName;
        }
        
        const contextVars: Record<string, string> = {
          ...vars,
          'q.toplevel.prompt.name': topLevelPromptName,
          'q.parent.prompt.name': parentPromptName,
        };

        const systemVariables: Record<string, string> = {};
        Object.entries(contextVars).forEach(([key, value]) => {
          if (key.startsWith('q.') && 
              value !== undefined && value !== null && value !== '' &&
              !CONTEXT_VARIABLE_KEYS.includes(key)) {
            systemVariables[key] = String(value);
          }
        });

        const insertData: Record<string, unknown> = {
          parent_row_id: parentRowId,
          prompt_name: promptName,
          input_admin_prompt: replaceVariables(promptStructure.input_admin_prompt, contextVars),
          input_user_prompt: replaceVariables(promptStructure.input_user_prompt, contextVars),
          note: replaceVariables(promptStructure.note, contextVars),
          owner_id: user?.id,
          template_row_id: templateRowId,
          position_lex: newPositionLex,
          is_deleted: false,
          system_variables: Object.keys(systemVariables).length > 0 ? systemVariables : null,
          ...modelDefaults,
        };

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
          if (Object.prototype.hasOwnProperty.call(promptStructure, field) && promptStructure[field] !== null) {
            insertData[field] = promptStructure[field];
          }
        });

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
          .maybeSingle();

        if (error) {
          console.error('Prompt insert error:', error);
          throw new Error(`Insert failed: ${error.message} (code: ${error.code})`);
        }
        
        if (!data) {
          throw new Error('Insert succeeded but no data returned');
        }

        const typedData = data as TemplateStructure;

        if (isTopLevelPrompt && (insertData.is_assistant || insertData.is_assistant === undefined)) {
          const templateInstructions = replaceVariables(promptStructure.assistant_instructions, contextVars);
          const conversationInstructions = templateInstructions || defAssistantInstructions || '';
          createConversation(typedData.row_id, insertData.prompt_name as string, conversationInstructions);
        }

        if (promptStructure.children?.length > 0) {
          positionKeyCache.delete(typedData.row_id);
          for (let i = 0; i < promptStructure.children.length; i++) {
            await createPromptFromStructure(promptStructure.children[i], typedData.row_id, i, promptName, null);
          }
        }

        return typedData;
      };

      const createdPrompt = await createPromptFromStructure(structure, parentId, 0, '', finalPromptName);
      
      toast.success('Prompt created from template');
      trackEvent('prompt_created_from_template', { template_id: templateRowId, is_top_level: isTopLevel });
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

  const templateVariables = (selectedTemplate ? extractTemplateVariables(selectedTemplate.structure) : []) as string[];
  
  const { systemStatic, systemInput, systemRuntime, userDefined } = useMemo(() => 
    categorizeVariables(templateVariables), 
    [templateVariables]
  );

  const getVariableInfo = (varName: string): VariableInfo => {
    const sysVar = getSystemVariable(varName);
    if (sysVar) {
      return {
        label: sysVar.label,
        description: sysVar.description,
        type: sysVar.type,
        options: sysVar.options,
        placeholder: sysVar.placeholder,
        required: sysVar.required,
        isSystem: true,
      };
    }
    
    const def = selectedTemplate?.variable_definitions?.find((d: TemplateStructure) => d.name === varName);
    return {
      label: varName,
      description: def?.description || '',
      type: 'input',
      placeholder: `Enter value for ${varName}`,
      required: !def?.default || def.default.trim() === '',
      isSystem: false,
      hasDefault: def?.default && def.default.trim() !== '',
    };
  };

  const hasValidationErrors = useMemo(() => {
    if (isTopLevel && !policyBaseName.trim()) {
      return true;
    }
    
    const systemInputErrors = systemInput.some((varName: string) => {
      const info = getVariableInfo(varName);
      const value = variableValues[varName] || '';
      return info.required && value.trim() === '';
    });
    
    const userDefinedErrors = userDefined.some((varName: string) => {
      const info = getVariableInfo(varName);
      const value = variableValues[varName] || '';
      return info.required && value.trim() === '';
    });
    
    return systemInputErrors || userDefinedErrors;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [systemInput, userDefined, variableValues, selectedTemplate, isTopLevel, policyBaseName]);

  const renderVariableInput = (varName: string) => {
    const info = getVariableInfo(varName);
    const value = variableValues[varName] || '';
    const showError = info.required && value.trim() === '';
    
    return (
      <div key={varName} className="space-y-2">
        <Label htmlFor={varName} className="flex items-center gap-2">
          <Badge 
            variant={info.isSystem ? "default" : "outline"} 
            className="font-mono text-xs"
          >
            {`{{${varName}}}`}
          </Badge>
          {info.required && <span className="text-destructive text-xs">*</span>}
          {info.hasDefault && <span className="text-muted-foreground text-xs">(has default)</span>}
        </Label>
        {info.description && (
          <p className="text-xs text-muted-foreground">{info.description}</p>
        )}
        
        {info.type === SYSTEM_VARIABLE_TYPES.SELECT && info.options ? (
          <Select
            value={value}
            onValueChange={(v) => handleVariableChange(varName, v)}
          >
            <SelectTrigger className={showError ? 'border-destructive' : ''}>
              <SelectValue placeholder={info.placeholder || 'Select an option'} />
            </SelectTrigger>
            <SelectContent>
              {info.options.map(opt => (
                <SelectItem key={opt} value={opt}>{opt}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <Input
            id={varName}
            value={value}
            onChange={(e) => handleVariableChange(varName, e.target.value)}
            placeholder={info.placeholder}
            className={showError ? 'border-destructive' : ''}
          />
        )}
        
        {showError && (
          <p className="text-destructive text-xs">This field is required</p>
        )}
      </div>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-[550px]">
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
              Fill in the values for template variables in &quot;{selectedTemplate?.template_name}&quot;
            </DialogDescription>
          )}
        </DialogHeader>

        {step === 'select' && (
          <>
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
              <div className="flex-1 h-px bg-border" />
              <span className="text-xs text-muted-foreground px-2">or use a template</span>
              <div className="flex-1 h-px bg-border" />
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
                  {filteredTemplates.map((template: TemplateStructure) => {
                    const variables = extractTemplateVariables(template.structure) as string[];
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
            <ScrollArea className="max-h-[400px] pr-4">
              <div className="space-y-6">
                {isTopLevel && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-primary" />
                      <h3 className="text-sm font-medium">Prompt Name</h3>
                    </div>
                    <div className="space-y-4 pl-6">
                      <div className="space-y-2">
                        <Label htmlFor="policy-base-name" className="flex items-center gap-2">
                          <Badge variant="default" className="font-mono text-xs">Policy Name</Badge>
                          <span className="text-destructive text-xs">*</span>
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          Enter the policy name. This will be used to generate the prompt name.
                        </p>
                        <Input
                          id="policy-base-name"
                          value={policyBaseName}
                          onChange={(e) => {
                            setPolicyBaseName(e.target.value);
                            setPromptNameOverride('');
                          }}
                          placeholder="Enter policy name (e.g., Travel Insurance)"
                          className={!policyBaseName.trim() ? 'border-destructive' : ''}
                        />
                        {!policyBaseName.trim() && (
                          <p className="text-destructive text-xs">Policy name is required</p>
                        )}
                      </div>
                      
                      {policyBaseName.trim() && (
                        <div className="space-y-2">
                          <Label htmlFor="final-prompt-name" className="flex items-center gap-2">
                            <Badge variant="secondary" className="font-mono text-xs">Final Prompt Name</Badge>
                          </Label>
                          <p className="text-xs text-muted-foreground">
                            Auto-generated with &quot;(Master) (DRAFT)&quot; suffix. You can edit this if needed.
                          </p>
                          <Input
                            id="final-prompt-name"
                            value={promptNameOverride || computedPromptName}
                            onChange={(e) => setPromptNameOverride(e.target.value)}
                            placeholder="Generated prompt name"
                          />
                        </div>
                      )}
                    </div>
                    <Separator />
                  </div>
                )}

                {systemInput.length > 0 && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <Settings2 className="h-4 w-4 text-primary" />
                      <h3 className="text-sm font-medium">System Variables</h3>
                    </div>
                    <div className="space-y-4 pl-6">
                      {systemInput.map(renderVariableInput)}
                    </div>
                  </div>
                )}
                
                {userDefined.length > 0 && (
                  <div className="space-y-4">
                    {(systemInput.length > 0 || isTopLevel) && <Separator />}
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <h3 className="text-sm font-medium">Template Variables</h3>
                    </div>
                    <div className="space-y-4 pl-6">
                      {userDefined.map(renderVariableInput)}
                    </div>
                  </div>
                )}
                
                {systemStatic.length > 0 && (
                  <div className="space-y-3">
                    <Separator />
                    <div className="flex items-center gap-2">
                      <Lock className="h-4 w-4 text-muted-foreground" />
                      <h3 className="text-sm font-medium text-muted-foreground">Auto-Populated Values</h3>
                    </div>
                    <div className="pl-6 space-y-2">
                      <TooltipProvider>
                        <div className="flex flex-wrap gap-2">
                          {systemStatic.map((varName: string) => {
                            const sysVar = getSystemVariable(varName);
                            const value = variableValues[varName] || '';
                            return (
                              <Tooltip key={varName}>
                                <TooltipTrigger asChild>
                                  <Badge variant="secondary" className="font-mono text-xs cursor-help">
                                    {varName}: {value.length > 20 ? value.substring(0, 20) + '...' : value}
                                  </Badge>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p className="font-medium">{sysVar?.label || varName}</p>
                                  <p className="text-xs text-muted-foreground">{sysVar?.description}</p>
                                </TooltipContent>
                              </Tooltip>
                            );
                          })}
                        </div>
                      </TooltipProvider>
                    </div>
                  </div>
                )}
                
                {systemRuntime.length > 0 && (
                  <div className="space-y-3">
                    <Separator />
                    <div className="flex items-center gap-2">
                      <Settings2 className="h-4 w-4 text-muted-foreground" />
                      <h3 className="text-sm font-medium text-muted-foreground">Runtime Variables</h3>
                    </div>
                    <div className="pl-6 space-y-2">
                      <p className="text-xs text-muted-foreground mb-2">
                        These variables are resolved during cascade execution and cannot be set manually.
                      </p>
                      <TooltipProvider>
                        <div className="flex flex-wrap gap-2">
                          {systemRuntime.map((varName: string) => {
                            const sysVar = getSystemVariable(varName);
                            return (
                              <Tooltip key={varName}>
                                <TooltipTrigger asChild>
                                  <Badge variant="outline" className="font-mono text-xs cursor-help text-muted-foreground">
                                    {varName}
                                  </Badge>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p className="font-medium">{sysVar?.label || varName}</p>
                                  <p className="text-xs text-muted-foreground">{sysVar?.description}</p>
                                </TooltipContent>
                              </Tooltip>
                            );
                          })}
                        </div>
                      </TooltipProvider>
                    </div>
                  </div>
                )}
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
                disabled={isCreating || hasValidationErrors}
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

export default NewPromptChoiceDialog;
