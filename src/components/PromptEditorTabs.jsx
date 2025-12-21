import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, Settings, Variable, LayoutTemplate, Bot, Play } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { toast } from '@/components/ui/sonner';
import { useCascadeExecutor } from '@/hooks/useCascadeExecutor';
import { useCascadeRun } from '@/contexts/CascadeRunContext';
import { supabase } from '@/integrations/supabase/client';
import PromptFieldsTab from './tabs/PromptFieldsTab';
import SettingsTab from './tabs/SettingsTab';
import VariablesTab from './tabs/VariablesTab';
import TemplatesTab from './tabs/TemplatesTab';
import ConversationTab from './tabs/ConversationTab';

const PromptEditorTabs = ({
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
  const [activeTab, setActiveTab] = useState('prompt');
  const [assistantRowId, setAssistantRowId] = useState(null);
  const { executeCascade } = useCascadeExecutor();
  const { isRunning: isCascadeRunning } = useCascadeRun();

  // Fetch assistant row_id for top-level prompts
  useEffect(() => {
    const fetchAssistantRowId = async () => {
      if (!isTopLevel || !selectedItemData?.is_assistant || !selectedItemData?.row_id) {
        setAssistantRowId(null);
        return;
      }

      try {
        const { data, error } = await supabase
          .from(import.meta.env.VITE_ASSISTANTS_TBL)
          .select('row_id')
          .eq('prompt_row_id', selectedItemData.row_id)
          .maybeSingle();

        if (error) throw error;
        setAssistantRowId(data?.row_id || null);
      } catch (error) {
        console.error('Error fetching assistant:', error);
        setAssistantRowId(null);
      }
    };

    fetchAssistantRowId();
  }, [isTopLevel, selectedItemData?.is_assistant, selectedItemData?.row_id]);

  // Handle cascade run from top-level
  const handleCascadeRun = useCallback(async () => {
    if (!selectedItemData?.row_id) {
      toast.error('No prompt selected');
      return;
    }
    
    // Use fetched assistantRowId for top-level, or parentAssistantRowId for children
    const targetAssistantRowId = assistantRowId || parentAssistantRowId;
    
    if (!targetAssistantRowId) {
      toast.error('Conversation not found. Enable Conversation Mode first.');
      return;
    }
    
    await executeCascade(selectedItemData.row_id, targetAssistantRowId);
  }, [selectedItemData?.row_id, assistantRowId, parentAssistantRowId, executeCascade]);

  // Build tabs dynamically based on whether this is a top-level assistant
  const tabs = useMemo(() => {
    const baseTabs = [
      { id: 'prompt', label: 'Prompt', icon: FileText, description: 'Edit prompts and responses' },
      { id: 'settings', label: 'Settings', icon: Settings, description: 'AI model settings' },
      { id: 'variables', label: 'Variables', icon: Variable, description: 'Manage variables' },
      { id: 'templates', label: 'Templates', icon: LayoutTemplate, description: 'Save as or apply template' },
    ];
    
    // Add Conversation tab for top-level prompts that are conversations
    if (isTopLevel && selectedItemData?.is_assistant) {
      baseTabs.push({ id: 'conversation', label: 'Conversation', icon: Bot, description: 'Conversation configuration' });
    }
    
    return baseTabs;
  }, [isTopLevel, selectedItemData?.is_assistant]);

  const QuickAccessIcon = ({ tab, needsAttention = false }) => {
    const isActive = activeTab === tab.id;
    
    const getIconClasses = () => {
      if (needsAttention) {
        return 'animate-attention-flash rounded-md';
      }
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
          <TooltipContent side="bottom">
            <p className="text-xs">{tab.description}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  };

  if (!selectedItemData) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">Loading prompt data...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Quick access icons bar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-muted/30">
        <div className="flex items-center gap-1">
          {tabs.map(tab => (
            <QuickAccessIcon key={tab.id} tab={tab} />
          ))}
        </div>
        <div className="flex items-center gap-2">
          {/* Cascade Run button - only for top-level assistants */}
          {isTopLevel && selectedItemData?.is_assistant && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="default"
                    size="sm"
                    className="h-7 gap-1.5 px-2.5"
                    onClick={handleCascadeRun}
                    disabled={isCascadeRunning}
                  >
                    <Play className="h-3.5 w-3.5" />
                    <span className="text-xs">Cascade</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <p className="text-xs">Run all child prompts level by level</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          {selectedItemData?.is_assistant && (
            <div className="flex items-center gap-1 text-xs text-primary">
              <Bot className="h-3.5 w-3.5" />
              <span>Conversation Mode</span>
            </div>
          )}
        </div>
      </div>

      {/* Tabs content */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-auto">
          <TabsContent value="prompt" className="h-full m-0 p-0">
            <PromptFieldsTab
              selectedItemData={selectedItemData}
              projectRowId={projectRowId}
              onUpdateField={onUpdateField}
              isLinksPage={isLinksPage}
              isReadOnly={isReadOnly}
              onCascade={onCascade}
              parentData={parentData}
              cascadeField={cascadeField}
              isTopLevel={isTopLevel}
              parentAssistantRowId={parentAssistantRowId}
            />
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
              isTopLevel={isTopLevel}
              promptRowId={selectedItemData?.row_id}
            />
          </TabsContent>

          {/* Conversation tab - only rendered for top-level conversations */}
          {isTopLevel && selectedItemData?.is_assistant && (
            <TabsContent value="conversation" className="h-full m-0 p-0">
              <ConversationTab
                promptRowId={projectRowId}
                selectedItemData={selectedItemData}
              />
            </TabsContent>
          )}
        </div>
      </Tabs>
    </div>
  );
};

export default PromptEditorTabs;
