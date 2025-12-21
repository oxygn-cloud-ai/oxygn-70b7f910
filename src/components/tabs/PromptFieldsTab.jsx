import React, { useState, useCallback, useMemo } from 'react';
import { useOpenAIModels } from '../../hooks/useOpenAIModels';
import { useSettings } from '../../hooks/useSettings';
import { useSupabase } from '../../hooks/useSupabase';
import { useOpenAICall } from '../../hooks/useOpenAICall';
import { useTimer } from '../../hooks/useTimer';
import { useProjectData } from '../../hooks/useProjectData';
import { useCostTracking } from '../../hooks/useCostTracking';
import PromptField from '../PromptField';
import { Bot, Info } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { TOOLTIPS } from '@/config/labels';
import { toast } from '@/components/ui/sonner';

const PromptFieldsTab = ({ 
  selectedItemData, 
  projectRowId, 
  onUpdateField, 
  isLinksPage = false, 
  isReadOnly = false, 
  onCascade, 
  parentData, 
  cascadeField,
  isTopLevel = false,
  parentAssistantRowId = null,
}) => {
  const supabase = useSupabase();
  const { settings } = useSettings(supabase);
  const { callOpenAI } = useOpenAICall();
  const { recordCost } = useCostTracking();
  const [isGenerating, setIsGenerating] = useState(false);
  const formattedTime = useTimer(isGenerating);

  const {
    localData,
    handleChange,
    handleSave,
    handleReset,
    hasUnsavedChanges
  } = useProjectData(selectedItemData, projectRowId);

  const handleGenerate = useCallback(async () => {
    if (!settings) {
      toast.error('Settings are not configured. Please check your settings.');
      return;
    }

    setIsGenerating(true);
    const startTime = Date.now();
    
    try {
      const result = await callOpenAI(
        localData.input_admin_prompt,
        localData.input_user_prompt,
        localData,
        {
          onSuccess: async (content, response) => {
            if (supabase && projectRowId) {
              // Save result
              const { error } = await supabase
                .from(import.meta.env.VITE_PROMPTS_TBL)
                .update({ user_prompt_result: content })
                .eq('row_id', projectRowId);
              
              if (error) {
                console.error('Failed to save result:', error);
              }

              // Record cost (response contains usage data)
              if (response?.usage) {
                await recordCost({
                  promptRowId: projectRowId,
                  model: response.model || localData.model || 'gpt-4o-mini',
                  usage: response.usage,
                  responseId: response.id,
                  finishReason: response.choices?.[0]?.finish_reason,
                  latencyMs: response._metadata?.latency_ms || (Date.now() - startTime),
                  promptName: localData.prompt_name,
                });
              }
            }
          },
        }
      );
      
      if (result) {
        handleChange('user_prompt_result', result);
      }
    } catch (error) {
      console.error('Error calling OpenAI:', error);
      toast.error(`Error generating response: ${error.message}`);
    } finally {
      setIsGenerating(false);
    }
  }, [settings, localData, callOpenAI, handleChange, supabase, projectRowId, recordCost]);

  const handleCascade = useCallback((fieldName) => {
    if (onCascade) {
      onCascade(fieldName);
    }
  }, [onCascade]);

  const fields = useMemo(() => [
    { name: 'input_admin_prompt', label: TOOLTIPS.promptFields.inputAdminPrompt.label, tooltip: TOOLTIPS.promptFields.inputAdminPrompt.tooltip },
    { name: 'input_user_prompt', label: TOOLTIPS.promptFields.inputUserPrompt.label, tooltip: TOOLTIPS.promptFields.inputUserPrompt.tooltip },
    { name: 'admin_prompt_result', label: TOOLTIPS.promptFields.adminResult.label },
    { name: 'user_prompt_result', label: TOOLTIPS.promptFields.userResult.label, tooltip: TOOLTIPS.promptFields.userResult.tooltip },
    { name: 'note', label: TOOLTIPS.promptFields.note.label }
  ], []);

  const handleEnableAssistant = useCallback(async () => {
    try {
      const { error } = await supabase
        .from(import.meta.env.VITE_PROMPTS_TBL)
        .update({ is_assistant: true })
        .eq('row_id', projectRowId);
      
      if (error) throw error;
      
      if (onUpdateField) {
        onUpdateField('is_assistant', true);
      }
      toast.success('Conversation mode enabled');
    } catch (error) {
      console.error('Error enabling conversation mode:', error);
      toast.error('Failed to enable conversation mode');
    }
  }, [supabase, projectRowId, onUpdateField]);

  return (
    <div className="flex flex-col gap-4 h-full overflow-auto p-4">
      {/* Conversation Mode Toggle - only show for top-level prompts */}
      {isTopLevel && !isLinksPage && !selectedItemData?.is_assistant && (
        <Card className="border-dashed border-primary/30 bg-primary/5">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <div className="p-1.5 rounded bg-primary/10">
                <Bot className="h-4 w-4 text-primary" />
              </div>
              Conversation Mode
            </CardTitle>
            <CardDescription className="text-xs">
              Convert this prompt into a conversation with persistent context and threads.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    size="icon"
                    onClick={handleEnableAssistant}
                    className="h-8 w-8 bg-primary hover:bg-primary/90 text-primary-foreground"
                  >
                    <Bot className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{TOOLTIPS.prompts.enableAssistant}</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </CardContent>
        </Card>
      )}
      
      {/* Message Flow Info Card */}
      <Card className="border-muted bg-muted/30">
        <CardContent className="py-3 px-4">
          <div className="flex items-start gap-2">
            <Info className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
            <div className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Message Flow:</span>{' '}
              System Instructions (from parent conversation) → Context Prompt → User Message → AI Response
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Prompt Fields */}
      <div className="space-y-4">
        {fields
          .filter(field => {
            if (field.name === 'admin_prompt_result') {
              return !!(localData.admin_prompt_result || selectedItemData?.admin_prompt_result);
            }
            return true;
          })
          .map(field => (
            <PromptField
              key={field.name}
              label={field.label}
              tooltip={field.tooltip}
              value={localData[field.name] || ''}
              onChange={(value) => handleChange(field.name, value)}
              onReset={() => handleReset(field.name)}
              onSave={() => handleSave(field.name)}
              initialValue={selectedItemData[field.name] || ''}
              onGenerate={isLinksPage ? null : handleGenerate}
              isGenerating={isGenerating}
              formattedTime={formattedTime}
              isLinksPage={isLinksPage}
              isReadOnly={isReadOnly}
              onCascade={() => handleCascade(field.name)}
              parentData={parentData}
              cascadeField={cascadeField}
              hasUnsavedChanges={hasUnsavedChanges(field.name)}
              promptId={projectRowId}
              placeholder={settings?.[field.name === 'input_admin_prompt' ? 'def_admin_prompt' : null]}
            />
          ))}
      </div>
    </div>
  );
};

export default PromptFieldsTab;
