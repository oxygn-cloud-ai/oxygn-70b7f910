import React, { useState, useCallback, useMemo } from 'react';
import { useThreads } from '../hooks/useThreads';
import { useAssistantRun } from '../hooks/useAssistantRun';
import { useProjectData } from '../hooks/useProjectData';
import { useSupabase } from '../hooks/useSupabase';
import PromptField from './PromptField';
import ThreadSelector from './ThreadSelector';
import ThreadHistory from './ThreadHistory';
import { Button } from "@/components/ui/button";
import { Play, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const ChildPromptPanel = ({
  selectedItemData,
  projectRowId,
  parentAssistantRowId,
  onUpdateField,
}) => {
  const supabase = useSupabase();
  const [isRunning, setIsRunning] = useState(false);

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
  } = useThreads(parentAssistantRowId, projectRowId);

  const { runAssistant } = useAssistantRun();

  const threadMode = localData.thread_mode || 'new';

  const handleThreadModeChange = useCallback(async (mode) => {
    handleChange('thread_mode', mode);
    // Save immediately
    if (supabase && projectRowId) {
      try {
        await supabase
          .from('cyg_prompts')
          .update({ thread_mode: mode })
          .eq('row_id', projectRowId);
      } catch (error) {
        console.error('Error updating thread mode:', error);
      }
    }
  }, [handleChange, supabase, projectRowId]);

  const handleRun = useCallback(async () => {
    if (!parentAssistantRowId) {
      toast.error('Parent assistant not found');
      return;
    }

    setIsRunning(true);
    try {
      const result = await runAssistant({
        assistantRowId: parentAssistantRowId,
        childPromptRowId: projectRowId,
        userMessage: localData.input_user_prompt || '',
        threadMode: threadMode,
        existingThreadRowId: threadMode === 'reuse' ? activeThread?.row_id : null,
      });

      if (result.response) {
        handleChange('user_prompt_result', result.response);
        // Auto-save the response
        if (supabase && projectRowId) {
          await supabase
            .from('cyg_prompts')
            .update({ user_prompt_result: result.response })
            .eq('row_id', projectRowId);
        }
        toast.success('Assistant response received');
      }
    } catch (error) {
      console.error('Error running assistant:', error);
      toast.error(`Error: ${error.message}`);
    } finally {
      setIsRunning(false);
    }
  }, [parentAssistantRowId, projectRowId, localData, threadMode, activeThread, runAssistant, handleChange, supabase]);

  const fields = useMemo(() => [
    { name: 'input_user_prompt', label: 'User Message' },
    { name: 'user_prompt_result', label: 'Response' },
    { name: 'note', label: 'Notes' },
  ], []);

  if (!selectedItemData) {
    return <div>Loading prompt data...</div>;
  }

  return (
    <div className="flex flex-col gap-4 h-[calc(100vh-8rem)] overflow-auto p-4">
      {/* Thread Selector */}
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

      {/* Thread History Button */}
      {threadMode === 'reuse' && activeThread && (
        <div className="flex justify-end">
          <ThreadHistory
            messages={messages}
            isLoading={isLoadingMessages}
            onFetchMessages={fetchMessages}
            threadRowId={activeThread.row_id}
          />
        </div>
      )}

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

      {/* Run Button */}
      <div className="flex justify-center pt-4">
        <Button
          onClick={handleRun}
          disabled={isRunning || !localData.input_user_prompt}
          className="gap-2 px-8"
          size="lg"
        >
          {isRunning ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Running...
            </>
          ) : (
            <>
              <Play className="h-4 w-4" />
              Run
            </>
          )}
        </Button>
      </div>
    </div>
  );
};

export default ChildPromptPanel;
