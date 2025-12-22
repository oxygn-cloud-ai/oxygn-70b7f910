import React, { useState, useCallback, useMemo } from 'react';
import { useSupabase } from '../../hooks/useSupabase';
import { useTimer } from '../../hooks/useTimer';
import { useProjectData } from '../../hooks/useProjectData';
import { useConversationRun } from '../../hooks/useConversationRun';
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
  const { runPrompt, isRunning } = useConversationRun();
  const [isGenerating, setIsGenerating] = useState(false);
  const formattedTime = useTimer(isGenerating || isRunning);

  const {
    localData,
    handleChange,
    handleSave,
    handleReset,
    hasUnsavedChanges
  } = useProjectData(selectedItemData, projectRowId);

  const handleGenerate = useCallback(async () => {
    // For top-level assistants, they ARE the conversation - use their own assistant ID
    // For child prompts, they need parentAssistantRowId
    const effectiveAssistantRowId = isTopLevel && selectedItemData?.is_assistant 
      ? null // Will be fetched by runPrompt if needed
      : parentAssistantRowId;
    
    // Top-level non-assistants need conversation mode enabled first
    if (isTopLevel && !selectedItemData?.is_assistant) {
      toast.error('Cannot generate: Enable conversation mode on this prompt first.');
      return;
    }
    
    // Child prompts need a parent assistant
    if (!isTopLevel && !parentAssistantRowId) {
      toast.error('Cannot generate: Enable conversation mode on the parent prompt first.');
      return;
    }

    if (!projectRowId) {
      toast.error('No prompt selected');
      return;
    }

    setIsGenerating(true);
    try {
      // Edge function automatically uses:
      // - input_admin_prompt from DB as system context
      // - input_user_prompt from DB as user message
      // - Saves result to user_prompt_result
      const result = await runPrompt(projectRowId, '', {}, {
        onSuccess: (data) => {
          if (data?.response) {
            handleChange('user_prompt_result', data.response);
          }
        }
      });
      
      // Also update local state from result
      if (result?.response) {
        handleChange('user_prompt_result', result.response);
      }
    } catch (error) {
      console.error('Error generating response:', error);
      // Error toast already shown by runPrompt
    } finally {
      setIsGenerating(false);
    }
  }, [isTopLevel, selectedItemData?.is_assistant, parentAssistantRowId, projectRowId, runPrompt, handleChange]);

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
              placeholder={field.name === 'input_admin_prompt' ? 'Enter system/context instructions...' : undefined}
            />
          ))}
      </div>
    </div>
  );
};

export default PromptFieldsTab;
