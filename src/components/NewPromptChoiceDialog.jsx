import React, { useState, useEffect, useMemo } from 'react';
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
import {
  SYSTEM_VARIABLES,
  SYSTEM_VARIABLE_TYPES,
  isSystemVariable,
  isStaticSystemVariable,
  resolveStaticVariables,
  categorizeVariables,
  getSystemVariable,
} from '@/config/systemVariables';

const NewPromptChoiceDialog = ({
  isOpen, 
  onClose, 
  parentId = null,
  onCreatePlain,
  onPromptCreated 
}) => {
  const { templates, isLoading, extractTemplateVariables, fetchTemplates } = useTemplates();
  
  // Refetch templates when dialog opens to ensure fresh data
  useEffect(() => {
    if (isOpen) {
      fetchTemplates();
    }
  }, [isOpen, fetchTemplates]);
  const { user, profile } = useAuth();
  const [step, setStep] = useState('select'); // 'select' | 'variables'
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [variableValues, setVariableValues] = useState({});
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [promptNameOverride, setPromptNameOverride] = useState(''); // User can override final prompt name
  const isTopLevel = parentId === null;

  const filteredTemplates = templates.filter(t => 
    t.template_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.category?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreatePlain = () => {
    trackEvent('prompt_created_plain', { is_top_level: isTopLevel, parent_id: parentId });
    onCreatePlain();
    handleClose();
  };

  const handleSelectTemplate = (template) => {
    setSelectedTemplate(template);
    const variables = extractTemplateVariables(template.structure);
    
    // Initialize with default values from variable_definitions and system variables
    const initialValues = {};
    const variableDefs = template.variable_definitions || [];
    
    // Add static system variables
    const staticVars = resolveStaticVariables({
      user: profile || { email: user?.email },
    });
    Object.assign(initialValues, staticVars);
    
    // For top-level prompts, always include q.policy.name
    if (isTopLevel) {
      initialValues['q.policy.name'] = '';
    }
    
    // Initialize user-defined and input system variables
    variables.forEach(v => {
      if (isStaticSystemVariable(v)) {
        // Already handled above
        return;
      }
      
      const sysVar = getSystemVariable(v);
      if (sysVar) {
        // System input variable - start empty
        initialValues[v] = '';
      } else {
        // User-defined variable - check for default
        const def = variableDefs.find(d => d.name === v);
        initialValues[v] = def?.default || '';
      }
    });
    
    setVariableValues(initialValues);
    setPromptNameOverride(''); // Reset override when selecting new template
    
    // Always show variables step for top-level (need policy name) or if there are variables
    if (isTopLevel || variables.length > 0) {
      setStep('variables');
    } else {
      handleCreateFromTemplate(template, initialValues);
    }
  };

  // Generate the computed prompt name based on q.policy.name
  const computedPromptName = useMemo(() => {
    const policyName = variableValues['q.policy.name']?.trim() || '';
    if (!policyName) return '';
    
    if (isTopLevel) {
      return `${policyName} (Master) (DRAFT)`;
    }
    return policyName;
  }, [variableValues['q.policy.name'], isTopLevel]);

  // Use override if set, otherwise use computed
  const finalPromptName = promptNameOverride || computedPromptName;

  const handleVariableChange = (name, value) => {
    setVariableValues(prev => ({ ...prev, [name]: value }));
  };

  const replaceVariables = (text, values) => {
    if (!text || typeof text !== 'string') return text;
    let result = text;
    Object.entries(values).forEach(([name, value]) => {
      // Escape special regex characters in variable name (for names with dots like q.policy.name)
      const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      result = result.replace(new RegExp(`\\{\\{${escapedName}\\}\\}`, 'g'), value);
    });
    return result;
  };

  const handleCreateFromTemplate = async (template, values) => {
    setIsCreating(true);
    try {
      const structure = template?.structure || selectedTemplate?.structure;
      const vars = values || variableValues;
      const templateRowId = template?.row_id || selectedTemplate?.row_id;

      // Fetch all needed settings at once
      const { data: settingsData } = await supabase
        .from(import.meta.env.VITE_SETTINGS_TBL)
        .select('setting_key, setting_value')
        .in('setting_key', ['default_model', 'def_assistant_instructions']);

      const settingsMap = {};
      settingsData?.forEach(row => {
        settingsMap[row.setting_key] = row.setting_value;
      });

      const defaultModelId = settingsMap.default_model;
      const defAssistantInstructions = settingsMap.def_assistant_instructions || '';

      let modelDefaults = {};
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
            if (defaultsData[`${field}_on`]) {
              modelDefaults[field] = defaultsData[field];
              modelDefaults[`${field}_on`] = true;
            }
          });
          
          modelDefaults.model = defaultModelId;
          modelDefaults.model_on = true;
        }
      }

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

      const createConversation = async (promptRowId, promptName, instructions = '') => {
        try {
          const insertData = {
            prompt_row_id: promptRowId,
            name: promptName,
            status: 'active', // Responses API is always ready
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

          console.log('Created conversation record:', conversation.row_id);
        } catch (error) {
          console.error('Error creating conversation:', error);
        }
      };

      // Track created prompts for context variables
      let topLevelPromptName = '';
      
      const createPromptFromStructure = async (promptStructure, parentRowId, positionOffset = 0, parentPromptName = '', overridePromptName = null) => {
        const maxPosition = await getMaxPosition(parentRowId);
        const newPosition = maxPosition + 1000000 + positionOffset;
        const isTopLevelPrompt = parentRowId === null;

        // Build the prompt name
        let promptName;
        
        if (isTopLevelPrompt && overridePromptName) {
          // Use the user-provided prompt name for top-level
          promptName = overridePromptName;
        } else {
          promptName = replaceVariables(promptStructure.prompt_name, vars);
          
          // For child prompts, prefix with q.policy.name if set
          if (!isTopLevelPrompt && vars['q.policy.name'] && vars['q.policy.name'].trim()) {
            // Child prompts can still use the policy name in their template if needed
          }
        }
        
        // Store for context variables
        if (isTopLevelPrompt) {
          topLevelPromptName = promptName;
        }
        
        // Update context variables for this prompt
        const contextVars = {
          ...vars,
          'q.toplevel.prompt.name': topLevelPromptName,
          'q.parent.prompt.name': parentPromptName,
        };

// Build system_variables object with q.* INPUT variables for runtime resolution
        const systemVariables = {};
        Object.entries(contextVars).forEach(([key, value]) => {
          // Only store q.* variables that have values (these are user-input variables like q.policy.*)
          if (key.startsWith('q.') && value !== undefined && value !== null && value !== '') {
            systemVariables[key] = String(value);
          }
        });

        // Start with model defaults, then overlay template-specific settings
        const insertData = {
          parent_row_id: parentRowId,
          prompt_name: promptName,
          input_admin_prompt: replaceVariables(promptStructure.input_admin_prompt, contextVars),
          input_user_prompt: replaceVariables(promptStructure.input_user_prompt, contextVars),
          note: replaceVariables(promptStructure.note, contextVars),
          owner_id: user?.id,
          template_row_id: templateRowId,
          position: newPosition,
          is_deleted: false,
          system_variables: Object.keys(systemVariables).length > 0 ? systemVariables : null,
          ...modelDefaults, // Apply system model defaults first
        };

        // Override with template-specific model/settings fields if present
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
          .maybeSingle();

        if (error) {
          console.error('Prompt insert error:', error);
          throw new Error(`Insert failed: ${error.message} (code: ${error.code})`);
        }
        
        if (!data) {
          throw new Error('Insert succeeded but no data returned');
        }

        if (isTopLevelPrompt && (insertData.is_assistant || insertData.is_assistant === undefined)) {
          // Use template instructions, fallback to default assistant instructions
          const templateInstructions = replaceVariables(promptStructure.assistant_instructions, contextVars);
          const conversationInstructions = templateInstructions || defAssistantInstructions || '';
          createConversation(data.row_id, insertData.prompt_name, conversationInstructions);
        }

        if (promptStructure.children?.length > 0) {
          for (let i = 0; i < promptStructure.children.length; i++) {
            await createPromptFromStructure(promptStructure.children[i], data.row_id, i * 1000, promptName, null);
          }
        }

        return data;
      };

      // Use finalPromptName for top-level prompts
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
    onClose();
  };

  const templateVariables = selectedTemplate ? extractTemplateVariables(selectedTemplate.structure) : [];
  
  // Categorize variables
  const { systemStatic, systemInput, userDefined } = useMemo(() => 
    categorizeVariables(templateVariables), 
    [templateVariables]
  );

  // Get variable info for display
  const getVariableInfo = (varName) => {
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
    
    // User-defined variable
    const def = selectedTemplate?.variable_definitions?.find(d => d.name === varName);
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

  // Check if all required variables have values
  const hasValidationErrors = useMemo(() => {
    // For top-level prompts, require policy name
    if (isTopLevel && (!variableValues['q.policy.name'] || !variableValues['q.policy.name'].trim())) {
      return true;
    }
    
    // Check system input variables (excluding q.policy.name for top-level since we handle it separately)
    const systemInputErrors = systemInput.some(varName => {
      if (isTopLevel && varName === 'q.policy.name') return false; // Handled above
      const info = getVariableInfo(varName);
      const value = variableValues[varName] || '';
      return info.required && value.trim() === '';
    });
    
    // Check user-defined variables
    const userDefinedErrors = userDefined.some(varName => {
      const info = getVariableInfo(varName);
      const value = variableValues[varName] || '';
      return info.required && value.trim() === '';
    });
    
    return systemInputErrors || userDefinedErrors;
  }, [systemInput, userDefined, variableValues, selectedTemplate, isTopLevel]);

  // Render a variable input field
  const renderVariableInput = (varName) => {
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
                {/* Prompt Name Section - Only for top-level prompts */}
                {isTopLevel && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-primary" />
                      <h3 className="text-sm font-medium">Prompt Name</h3>
                    </div>
                    <div className="space-y-4 pl-6">
                      {/* Policy Name input */}
                      <div className="space-y-2">
                        <Label htmlFor="policy-name" className="flex items-center gap-2">
                          <Badge variant="default" className="font-mono text-xs">Policy Name</Badge>
                          <span className="text-destructive text-xs">*</span>
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          Enter the policy name. This will be used for {"{{q.policy.name}}"} and to generate the prompt name.
                        </p>
                        <Input
                          id="policy-name"
                          value={variableValues['q.policy.name'] || ''}
                          onChange={(e) => {
                            handleVariableChange('q.policy.name', e.target.value);
                            // Reset override when policy name changes so computed name updates
                            setPromptNameOverride('');
                          }}
                          placeholder="Enter policy name (e.g., Travel Insurance)"
                          className={!variableValues['q.policy.name']?.trim() ? 'border-destructive' : ''}
                        />
                        {!variableValues['q.policy.name']?.trim() && (
                          <p className="text-destructive text-xs">Policy name is required</p>
                        )}
                      </div>
                      
                      {/* Final Prompt Name (editable) */}
                      {variableValues['q.policy.name']?.trim() && (
                        <div className="space-y-2">
                          <Label htmlFor="final-prompt-name" className="flex items-center gap-2">
                            <Badge variant="secondary" className="font-mono text-xs">Final Prompt Name</Badge>
                          </Label>
                          <p className="text-xs text-muted-foreground">
                            Auto-generated with "(Master) (DRAFT)" suffix. You can edit this if needed.
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

                {/* System Input Variables - filter out q.policy.name for top-level since we handle it above */}
                {(() => {
                  const filteredSystemInput = isTopLevel 
                    ? systemInput.filter(v => v !== 'q.policy.name')
                    : systemInput;
                  
                  return filteredSystemInput.length > 0 && (
                    <div className="space-y-4">
                      <div className="flex items-center gap-2">
                        <Settings2 className="h-4 w-4 text-primary" />
                        <h3 className="text-sm font-medium">System Variables</h3>
                      </div>
                      <div className="space-y-4 pl-6">
                        {filteredSystemInput.map(renderVariableInput)}
                      </div>
                    </div>
                  );
                })()}
                
                {/* User-Defined Variables */}
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
                
                {/* Static System Variables (read-only info) */}
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
                          {systemStatic.map(varName => {
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
