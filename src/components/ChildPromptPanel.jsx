import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { FileText, Settings, Variable, LayoutTemplate, Sparkles, Loader2, ListTree, Upload } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { toast } from '@/components/ui/sonner';
import { notify } from '@/contexts/ToastHistoryContext';
import { useThreads } from '../hooks/useThreads';
import { useConversationRun } from '../hooks/useConversationRun';
import { useProjectData } from '../hooks/useProjectData';
import { useSupabase } from '../hooks/useSupabase';
import { useCascadeExecutor } from '../hooks/useCascadeExecutor';
import { useCascadeRun } from '@/contexts/CascadeRunContext';
import { useCostTracking } from '../hooks/useCostTracking';
import { buildSystemVariablesForRun } from '@/utils/resolveSystemVariables';
import { supabase as supabaseClient } from '@/integrations/supabase/client';
import PromptField from './PromptField';
import ThreadSelector from './ThreadSelector';
import ThreadHistory from './ThreadHistory';
import ConfluencePagesSection from './ConfluencePagesSection';
import FilesPagesSection from './FilesPagesSection';
import SettingsTab from './tabs/SettingsTab';
import VariablesTab from './tabs/VariablesTab';
import TemplatesTab from './tabs/TemplatesTab';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, ChevronUp, Info } from 'lucide-react';

const ChildPromptPanel = ({
  selectedItemData,
  projectRowId,
  parentAssistantRowId,
  onUpdateField,
  onExportPrompt,
}) => {
  const supabase = useSupabase();
  const { recordCost } = useCostTracking();
  const [activeTab, setActiveTab] = useState('prompt');
  const [isRunning, setIsRunning] = useState(false);
  const [confluenceOpen, setConfluenceOpen] = useState(false);
  const [filesOpen, setFilesOpen] = useState(false);
  const [hasChildPrompts, setHasChildPrompts] = useState(false);
  const runStartTimeRef = useRef(null);

  const { executeCascade, hasChildren } = useCascadeExecutor();
  const { isRunning: isCascadeRunning, startSingleRun, endSingleRun } = useCascadeRun();

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

  // Check if this prompt has children
  useEffect(() => {
    const checkForChildren = async () => {
      if (selectedItemData?.row_id) {
        const hasKids = await hasChildren(selectedItemData.row_id);
        setHasChildPrompts(hasKids);
      }
    };
    checkForChildren();
  }, [selectedItemData?.row_id, hasChildren]);

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
    startSingleRun(projectRowId);
    runStartTimeRef.current = Date.now();
    
    try {
      // Get current user for variable resolution
      let currentUser = null;
      try {
        const { data: { user } } = await supabaseClient.auth.getUser();
        if (user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('display_name, email')
            .eq('id', user.id)
            .maybeSingle();
          
          currentUser = {
            id: user.id,
            email: user.email,
            display_name: profile?.display_name || user.email?.split('@')[0] || 'Unknown',
          };
        }
      } catch (err) {
        console.warn('Could not fetch user for variable resolution:', err);
      }

      // Fetch parent prompt data for variable resolution
      let parentData = null;
      if (selectedItemData?.parent_row_id) {
        try {
          const { data } = await supabase
            .from(import.meta.env.VITE_PROMPTS_TBL)
            .select('*')
            .eq('row_id', selectedItemData.parent_row_id)
            .single();
          parentData = data;
        } catch (err) {
          console.warn('Could not fetch parent prompt:', err);
        }
      }

      // Build system variables for this run
      const systemVars = buildSystemVariablesForRun({
        promptData: selectedItemData,
        parentData: parentData,
        user: currentUser,
        storedVariables: selectedItemData?.system_variables || localData?.system_variables || {},
      });

      console.log('[ChildPromptPanel] Running with system variables:', Object.keys(systemVars));

      // Log variables to notifications
      notify.info(`Variables for: ${selectedItemData?.prompt_name || 'Prompt'}`, {
        description: `${Object.keys(systemVars).length} variables resolved`,
        source: 'ChildPromptPanel.handleRun',
        details: JSON.stringify({
          promptRowId: projectRowId,
          promptName: selectedItemData?.prompt_name,
          variableCount: Object.keys(systemVars).length,
          variables: systemVars,
        }, null, 2),
      });

      const result = await runConversation({
        conversationRowId: parentAssistantRowId,
        childPromptRowId: projectRowId,
        userMessage: localData.input_user_prompt || '',
        threadMode: threadMode,
        childThreadStrategy: childThreadStrategy,
        existingThreadRowId: threadMode === 'reuse' && childThreadStrategy === 'isolated' ? activeThread?.row_id : null,
        template_variables: systemVars,
        onSuccess: async (data) => {
          const latencyMs = runStartTimeRef.current ? Date.now() - runStartTimeRef.current : null;

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
        refetchThreads();
      }
    } catch (error) {
      console.error('Error running assistant:', error);
      toast.error(`Error: ${error.message}`);
    } finally {
      setIsRunning(false);
      endSingleRun();
      runStartTimeRef.current = null;
    }
  }, [parentAssistantRowId, projectRowId, localData, threadMode, childThreadStrategy, activeThread, runConversation, handleChange, supabase, refetchThreads, recordCost, selectedItemData, startSingleRun, endSingleRun]);

  const handleCascadeRun = useCallback(async () => {
    console.log('[ChildPromptPanel] handleCascadeRun called', {
      parentAssistantRowId,
      row_id: selectedItemData?.row_id,
      prompt_name: selectedItemData?.prompt_name,
      hasChildPrompts,
    });
    
    if (!parentAssistantRowId || !selectedItemData?.row_id) {
      console.error('[ChildPromptPanel] Parent assistant not found', { parentAssistantRowId, row_id: selectedItemData?.row_id });
      toast.error('Parent assistant not found');
      return;
    }
    
    try {
      await executeCascade(selectedItemData.row_id, parentAssistantRowId);
    } catch (err) {
      console.error('[ChildPromptPanel] Cascade execution error:', err);
    }
  }, [parentAssistantRowId, selectedItemData?.row_id, selectedItemData?.prompt_name, executeCascade, hasChildPrompts]);

  const fields = useMemo(() => [
    { name: 'input_admin_prompt', label: 'System Prompt' },
    { name: 'input_user_prompt', label: 'User Message' },
    { name: 'user_prompt_result', label: 'Response' },
    { name: 'note', label: 'Notes' },
  ], []);

  const tabs = useMemo(() => [
    { id: 'prompt', label: 'Prompt', icon: FileText, description: 'Edit prompts and responses' },
    { id: 'settings', label: 'Settings', icon: Settings, description: 'AI model settings' },
    { id: 'variables', label: 'Variables', icon: Variable, description: 'Manage variables' },
    { id: 'templates', label: 'Templates', icon: LayoutTemplate, description: 'Save as or apply template' },
  ], []);

  const QuickAccessIcon = ({ tab }) => {
    const isActive = activeTab === tab.id;
    
    const getIconClasses = () => {
      if (isActive) {
        return 'text-primary bg-primary/10 hover:bg-primary/20';
      }
      return 'text-muted-foreground hover:text-foreground hover:bg-sidebar-accent';
    };
    
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className={`h-7 w-7 p-0 transition-colors ${getIconClasses()}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <tab.icon className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">
            {tab.description}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  };

  if (!selectedItemData) {
    return <div>Loading prompt data...</div>;
  }

  return (
    <div className="flex flex-col h-full">
      {/* Quick access icons bar - same as top-level */}
      <div className="flex items-center px-4 py-2 border-b border-border bg-muted/30">
        <div className="flex items-center gap-1">
          {tabs.map(tab => (
            <QuickAccessIcon key={tab.id} tab={tab} />
          ))}
          
          {/* Cascade Run icon - aligned with tab icons */}
          {hasChildPrompts && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 transition-colors text-muted-foreground hover:text-foreground hover:bg-sidebar-accent disabled:opacity-50"
                    onClick={handleCascadeRun}
                    disabled={isRunning || isCascadeRunning}
                  >
                    {isCascadeRunning ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <ListTree className="h-4 w-4" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <p className="text-xs">Run cascade</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}

          {/* Regular Run Icon */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 transition-colors text-muted-foreground hover:text-primary active:text-primary hover:bg-sidebar-accent disabled:opacity-50"
                  onClick={handleRun}
                  disabled={isRunning || isCascadeRunning || !localData.input_user_prompt}
                >
                  {isRunning ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p className="text-xs">{isRunning ? 'Running...' : 'Run this prompt'}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {/* Export icon */}
          {onExportPrompt && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 transition-colors text-muted-foreground hover:text-primary active:text-primary hover:bg-sidebar-accent"
                    onClick={() => onExportPrompt(selectedItemData?.row_id)}
                  >
                    <Upload className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <p className="text-xs">Export this prompt</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      </div>

      {/* Tabs content */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-auto">
          <TabsContent value="prompt" className="h-full m-0 p-0">
            <div className="flex flex-col gap-4 p-4">
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
          </TabsContent>

          <TabsContent value="settings" className="h-full m-0 p-4">
            <SettingsTab
              selectedItemData={selectedItemData}
              projectRowId={projectRowId}
            />
          </TabsContent>

          <TabsContent value="variables" className="h-full m-0 p-4">
            <VariablesTab
              selectedItemData={selectedItemData}
              projectRowId={projectRowId}
            />
          </TabsContent>

          <TabsContent value="templates" className="h-full m-0 p-4">
            <TemplatesTab
              selectedItemData={selectedItemData}
              projectRowId={projectRowId}
              isTopLevel={false}
              promptRowId={selectedItemData?.row_id}
            />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
};

export default ChildPromptPanel;