import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useThreads } from '../hooks/useThreads';
import { useConversationRun } from '../hooks/useConversationRun';
import { useProjectData } from '../hooks/useProjectData';
import { useSupabase } from '../hooks/useSupabase';
import { useCascadeExecutor } from '../hooks/useCascadeExecutor';
import { useCascadeRun } from '@/contexts/CascadeRunContext';
import { useCostTracking } from '../hooks/useCostTracking';
import PromptField from './PromptField';
import ThreadSelector from './ThreadSelector';
import ThreadHistory from './ThreadHistory';
import ConfluencePagesSection from './ConfluencePagesSection';
import FilesPagesSection from './FilesPagesSection';
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Play, Loader2, Info, ChevronDown, ChevronUp, ListTree } from 'lucide-react';
import { toast } from '@/components/ui/sonner';

const ChildPromptPanel = ({
  selectedItemData,
  projectRowId,
  parentAssistantRowId,
  onUpdateField,
}) => {
  const supabase = useSupabase();
  const { recordCost } = useCostTracking();
  const [isRunning, setIsRunning] = useState(false);
  const [confluenceOpen, setConfluenceOpen] = useState(false);
  const [filesOpen, setFilesOpen] = useState(false);
  const [hasChildPrompts, setHasChildPrompts] = useState(false);
  const runStartTimeRef = useRef(null);

  const { executeCascade, hasChildren } = useCascadeExecutor();
  const { isRunning: isCascadeRunning } = useCascadeRun();

  const {
    localData,
    handleChange,
    handleSave,
    handleReset,
    hasUnsavedChanges,
  } = useProjectData(selectedItemData, projectRowId);

  const {
    threads,
    activeThread,
    setActiveThread,
    messages,
    isLoading: isLoadingThreads,
    isLoadingMessages,
    createThread,
    deleteThread,
    fetchMessages,
    refetch: refetchThreads,
  } = useThreads(parentAssistantRowId, projectRowId);

  const { runConversation } = useConversationRun();

  // Check if this prompt's parent has children (siblings + self = hierarchy)
  useEffect(() => {
    const checkForChildren = async () => {
      if (selectedItemData?.parent_row_id) {
        const hasKids = await hasChildren(selectedItemData.parent_row_id);
        setHasChildPrompts(hasKids);
      }
    };
    checkForChildren();
  }, [selectedItemData?.parent_row_id, hasChildren]);

  const threadMode = localData.thread_mode || 'new';
  const childThreadStrategy = localData.child_thread_strategy || 'isolated';

  const handleThreadModeChange = useCallback(async (mode) => {
    handleChange('thread_mode', mode);
    if (supabase && projectRowId) {
      try {
        await supabase
          .from(import.meta.env.VITE_PROMPTS_TBL)
          .update({ thread_mode: mode })
          .eq('row_id', projectRowId);
      } catch (error) {
        console.error('Error updating thread mode:', error);
      }
    }
  }, [handleChange, supabase, projectRowId]);

  const handleThreadStrategyChange = useCallback(async (strategy) => {
    handleChange('child_thread_strategy', strategy);
    if (supabase && projectRowId) {
      try {
        await supabase
          .from(import.meta.env.VITE_PROMPTS_TBL)
          .update({ child_thread_strategy: strategy })
          .eq('row_id', projectRowId);
      } catch (error) {
        console.error('Error updating thread strategy:', error);
      }
    }
  }, [handleChange, supabase, projectRowId]);

  const handleRun = useCallback(async () => {
    if (!parentAssistantRowId) {
      toast.error('Parent conversation not found');
      return;
    }

    setIsRunning(true);
    runStartTimeRef.current = Date.now();
    
    try {
      const result = await runConversation({
        conversationRowId: parentAssistantRowId,
        childPromptRowId: projectRowId,
        userMessage: localData.input_user_prompt || '',
        threadMode: threadMode,
        childThreadStrategy: childThreadStrategy,
        existingThreadRowId: threadMode === 'reuse' && childThreadStrategy === 'isolated' ? activeThread?.row_id : null,
        // This callback runs even if user navigates away
        onSuccess: async (data) => {
          // Calculate latency
          const latencyMs = runStartTimeRef.current ? Date.now() - runStartTimeRef.current : null;

          // Record cost if we have usage data
          if (data.usage && data.model) {
            try {
              await recordCost({
                promptRowId: projectRowId,
                model: data.model,
                usage: data.usage,
                responseId: data.response_id,
                finishReason: 'stop',
                latencyMs,
                promptName: data.child_prompt_name || selectedItemData?.prompt_name,
              });
            } catch (costError) {
              console.error('Error recording cost:', costError);
            }
          }

          if (data.response && supabase && projectRowId) {
            await supabase
              .from(import.meta.env.VITE_PROMPTS_TBL)
              .update({ user_prompt_result: data.response })
              .eq('row_id', projectRowId);
          }
        },
      });

      if (result?.response) {
        handleChange('user_prompt_result', result.response);
        toast.success('Assistant response received');
        // Refetch threads to pick up any newly created threads
        refetchThreads();
      }
    } catch (error) {
      console.error('Error running assistant:', error);
      toast.error(`Error: ${error.message}`);
    } finally {
      setIsRunning(false);
      runStartTimeRef.current = null;
    }
  }, [parentAssistantRowId, projectRowId, localData, threadMode, childThreadStrategy, activeThread, runConversation, handleChange, supabase, refetchThreads, recordCost, selectedItemData]);

  const handleCascadeRun = useCallback(async () => {
    if (!parentAssistantRowId || !selectedItemData?.parent_row_id) {
      toast.error('Parent assistant not found');
      return;
    }
    // Execute cascade from the parent (top-level assistant)
    await executeCascade(selectedItemData.parent_row_id, parentAssistantRowId);
  }, [parentAssistantRowId, selectedItemData?.parent_row_id, executeCascade]);

  const fields = useMemo(() => [
    { name: 'input_admin_prompt', label: 'System Prompt' },
    { name: 'input_user_prompt', label: 'User Message' },
    { name: 'user_prompt_result', label: 'Response' },
    { name: 'note', label: 'Notes' },
  ], []);

  if (!selectedItemData) {
    return <div>Loading prompt data...</div>;
  }

  return (
    <div className="flex flex-col gap-4 h-[calc(100vh-8rem)] overflow-auto p-4">
      {/* Header with Run Icons */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border/50 bg-muted/30 rounded-lg">
        <span className="text-sm font-medium text-foreground">Child Prompt</span>
        <div className="flex items-center gap-1">
          {/* Cascade Run Icon - only show if parent has children */}
          {hasChildPrompts && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={handleCascadeRun}
                    disabled={isRunning || isCascadeRunning}
                    className="h-7 w-7 p-0 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isCascadeRunning ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <ListTree className="h-4 w-4" />
                    )}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs">
                  Run all child prompts in sequence
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}

          {/* Regular Run Icon */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={handleRun}
                  disabled={isRunning || isCascadeRunning || !localData.input_user_prompt}
                  className="h-7 w-7 p-0 inline-flex items-center justify-center rounded-md text-primary hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isRunning ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Play className="h-4 w-4" />
                  )}
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">
                {isRunning ? 'Running...' : 'Run this prompt'}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      {/* Thread Strategy Selector */}
      <div className="flex items-center gap-4 p-3 bg-muted/50 rounded-lg">
        <div className="flex-1">
          <div className="flex items-center gap-1 mb-1">
            <Label className="text-xs font-medium">Thread Strategy</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="h-4 w-4 text-muted-foreground hover:text-foreground">
                  <Info className="h-3 w-3" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-72 bg-popover" side="top">
                <div className="space-y-2">
                  <h4 className="font-medium text-sm">Thread Strategy</h4>
                  <p className="text-xs text-muted-foreground">
                    <strong>Parent Thread:</strong> Messages go to the parent assistant's Studio thread, maintaining shared conversation context.
                  </p>
                  <p className="text-xs text-muted-foreground">
                    <strong>Isolated:</strong> This child prompt has its own separate threads.
                  </p>
                </div>
              </PopoverContent>
            </Popover>
          </div>
          <Select value={childThreadStrategy} onValueChange={handleThreadStrategyChange}>
            <SelectTrigger className="h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-popover z-50">
              <SelectItem value="parent">Use Parent Thread</SelectItem>
              <SelectItem value="isolated">Isolated Threads</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Thread Selector - Only show for isolated strategy */}
      {childThreadStrategy === 'isolated' && (
        <ThreadSelector
          threads={threads}
          activeThread={activeThread}
          onSelectThread={setActiveThread}
          onCreateThread={createThread}
          onDeleteThread={deleteThread}
          threadMode={threadMode}
          onThreadModeChange={handleThreadModeChange}
          isLoading={isLoadingThreads}
        />
      )}

      {/* Thread History Button - Only for isolated reuse mode */}
      {childThreadStrategy === 'isolated' && threadMode === 'reuse' && activeThread && (
        <div className="flex justify-end">
          <ThreadHistory
            messages={messages}
            isLoading={isLoadingMessages}
            onFetchMessages={fetchMessages}
            threadRowId={activeThread.row_id}
          />
        </div>
      )}

      {/* Parent Thread Info */}
      {childThreadStrategy === 'parent' && (
        <div className="text-xs text-muted-foreground p-2 bg-muted/30 rounded">
          Messages will be sent to the parent assistant's Studio thread. View the full conversation in the chat panel.
        </div>
      )}

      {/* Files - Collapsible */}
      <Collapsible open={filesOpen} onOpenChange={setFilesOpen}>
        <CollapsibleTrigger asChild>
          <div className="flex items-center justify-between p-2 bg-muted/50 rounded-lg cursor-pointer hover:bg-muted/70 transition-colors">
            <span className="text-xs font-medium">Files</span>
            {filesOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-2">
          <FilesPagesSection 
            assistantRowId={parentAssistantRowId}
          />
        </CollapsibleContent>
      </Collapsible>

      {/* Confluence Pages - Collapsible */}
      <Collapsible open={confluenceOpen} onOpenChange={setConfluenceOpen}>
        <CollapsibleTrigger asChild>
          <div className="flex items-center justify-between p-2 bg-muted/50 rounded-lg cursor-pointer hover:bg-muted/70 transition-colors">
            <span className="text-xs font-medium">Confluence Context</span>
            {confluenceOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-2">
          <ConfluencePagesSection 
            promptRowId={projectRowId}
            isActive={true}
          />
        </CollapsibleContent>
      </Collapsible>

      {/* Prompt Fields */}
      <div className="space-y-6">
        {fields.map((field) => (
          <PromptField
            key={field.name}
            label={field.label}
            value={localData[field.name] || ''}
            onChange={(value) => handleChange(field.name, value)}
            onReset={() => handleReset(field.name)}
            onSave={() => handleSave(field.name)}
            initialValue={selectedItemData[field.name] || ''}
            hasUnsavedChanges={hasUnsavedChanges(field.name)}
            promptId={projectRowId}
            isReadOnly={field.name === 'user_prompt_result'}
          />
        ))}
      </div>
    </div>
  );
};

export default ChildPromptPanel;
