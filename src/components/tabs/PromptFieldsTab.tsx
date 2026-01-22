import React, { useState, useCallback, useMemo } from 'react';
import { useSupabase } from '../../hooks/useSupabase';
import { useTimer } from '../../hooks/useTimer';
import { useProjectData } from '../../hooks/useProjectData';
import { useConversationRun } from '../../hooks/useConversationRun';
import { useCascadeRun } from '@/contexts/CascadeRunContext';
import { useExecutionTracing } from '@/hooks/useExecutionTracing';
import PromptField from '../PromptField';
import { Info } from 'lucide-react';
import { Card, CardContent } from "@/components/ui/card";
import { TOOLTIPS } from '@/config/labels';
import { toast } from '@/components/ui/sonner';
import { trackEvent, trackException } from '@/lib/posthog';

interface PromptFieldConfig {
  name: string;
  label: string;
  tooltip?: string;
  placeholder?: string;
}

interface PromptFieldsTabProps {
  selectedItemData: Record<string, unknown> | null;
  projectRowId: string | null;
  onUpdateField?: (field: string, value: unknown) => void;
  isLinksPage?: boolean;
  isReadOnly?: boolean;
  onCascade?: (fieldName: string) => void;
  parentData?: Record<string, unknown> | null;
  cascadeField?: string;
  isTopLevel?: boolean;
  parentAssistantRowId?: string | null;
}

const PromptFieldsTab: React.FC<PromptFieldsTabProps> = ({ 
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
  const { startSingleRun, endSingleRun } = useCascadeRun();
  const { startTrace, createSpan, completeSpan, failSpan, completeTrace } = useExecutionTracing();
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
    startSingleRun(projectRowId);
    
    let traceId: string | null = null;
    let spanId: string | null = null;
    const startTime = Date.now();
    
    try {
      // Start execution trace for single prompt run
      const traceResult = await startTrace({
        entry_prompt_row_id: projectRowId,
        execution_type: 'single',
      });
      
      if (traceResult.success && traceResult.trace_id) {
        traceId = traceResult.trace_id;
        
        // Create span for this generation
        const spanResult = await createSpan({
          trace_id: traceId,
          prompt_row_id: projectRowId,
          span_type: 'generation',
        });
        
        if (spanResult.success && spanResult.span_id) {
          spanId = spanResult.span_id;
        }
      }
      
      const result = await runPrompt(projectRowId, '', {}, {
        onSuccess: (data: { response?: string }) => {
          if (data?.response) {
            handleChange('user_prompt_result', data.response);
            handleChange('output_response', data.response);
            handleSave('user_prompt_result');
            handleSave('output_response');
          }
        }
      });
      
      if (result?.response) {
        handleChange('user_prompt_result', result.response);
        handleChange('output_response', result.response);
        
        if (spanId) {
          await completeSpan({
            span_id: spanId,
            status: 'success',
            openai_response_id: result.response_id,
            output: result.response,
            latency_ms: Date.now() - startTime,
            usage_tokens: result.usage ? {
              input: result.usage.input_tokens || result.usage.prompt_tokens || 0,
              output: result.usage.output_tokens || result.usage.completion_tokens || 0,
              total: (result.usage.input_tokens || result.usage.prompt_tokens || 0) + (result.usage.output_tokens || result.usage.completion_tokens || 0),
            } : undefined,
          });
        }
        
        if (traceId) {
          await completeTrace({
            trace_id: traceId,
            status: 'completed',
          });
        }
      } else {
        if (spanId) {
          await failSpan({
            span_id: spanId,
            error_evidence: {
              error_type: 'no_response',
              error_message: 'No response received from API',
              retry_recommended: true,
            },
          });
        }
        if (traceId) {
          await completeTrace({
            trace_id: traceId,
            status: 'failed',
            error_summary: 'No response received',
          });
        }
      }
    } catch (error) {
      console.error('Error generating response:', error);
      
      if (spanId) {
        await failSpan({
          span_id: spanId,
          error_evidence: {
            error_type: 'execution_error',
            error_message: error instanceof Error ? error.message : 'Unknown error',
            retry_recommended: true,
          },
        });
      }
      if (traceId) {
        await completeTrace({
          trace_id: traceId,
          status: 'failed',
          error_summary: error instanceof Error ? error.message : 'Execution failed',
        });
      }
    } finally {
      setIsGenerating(false);
      endSingleRun();
    }
  }, [isTopLevel, selectedItemData?.is_assistant, parentAssistantRowId, projectRowId, runPrompt, handleChange, handleSave, startSingleRun, endSingleRun, startTrace, createSpan, completeSpan, failSpan, completeTrace]);

  const handleCascadeField = useCallback((fieldName: string) => {
    if (onCascade) {
      onCascade(fieldName);
    }
  }, [onCascade]);

  const fields: PromptFieldConfig[] = useMemo(() => [
    { name: 'input_admin_prompt', label: TOOLTIPS.promptFields.inputAdminPrompt.label, tooltip: TOOLTIPS.promptFields.inputAdminPrompt.tooltip },
    { name: 'input_user_prompt', label: TOOLTIPS.promptFields.inputUserPrompt.label, tooltip: TOOLTIPS.promptFields.inputUserPrompt.tooltip },
    { name: 'admin_prompt_result', label: TOOLTIPS.promptFields.adminResult.label },
    { name: 'user_prompt_result', label: TOOLTIPS.promptFields.userResult.label, tooltip: TOOLTIPS.promptFields.userResult.tooltip },
    { name: 'note', label: TOOLTIPS.promptFields.note.label }
  ], []);

  const handleEnableAssistant = useCallback(async () => {
    if (!supabase || !projectRowId) return;
    
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
      trackEvent('conversation_mode_enabled', { prompt_id: projectRowId });
    } catch (error) {
      console.error('Error enabling conversation mode:', error);
      toast.error('Failed to enable conversation mode');
      trackException(error instanceof Error ? error : new Error('Unknown error'), { context: 'PromptFieldsTab.handleEnableAssistant' });
    }
  }, [supabase, projectRowId, onUpdateField]);

  return (
    <div className="flex flex-col gap-4 p-4">
      
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
              value={String(localData[field.name] || '')}
              onChange={(value: string) => handleChange(field.name, value)}
              onReset={() => handleReset(field.name)}
              onSave={() => handleSave(field.name)}
              initialValue={String(selectedItemData?.[field.name] || '')}
              onGenerate={isLinksPage ? undefined : handleGenerate}
              isGenerating={isGenerating}
              formattedTime={formattedTime}
              isLinksPage={isLinksPage}
              isReadOnly={isReadOnly}
              onCascade={() => handleCascadeField(field.name)}
              parentData={parentData}
              cascadeField={cascadeField}
              hasUnsavedChanges={hasUnsavedChanges(field.name)}
              promptId={projectRowId || undefined}
              placeholder={field.name === 'input_admin_prompt' ? 'Enter system/context instructions...' : undefined}
              familyRootPromptRowId={String(selectedItemData?.root_prompt_row_id || selectedItemData?.row_id || '')}
            />
          ))}
      </div>
    </div>
  );
};

export default PromptFieldsTab;
