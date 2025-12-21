import React, { useState, useCallback, useMemo } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, Settings, Variable, LayoutTemplate, Bot } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import PromptFieldsTab from './tabs/PromptFieldsTab';
import SettingsTab from './tabs/SettingsTab';
import VariablesTab from './tabs/VariablesTab';
import TemplatesTab from './tabs/TemplatesTab';
import AssistantTab from './tabs/AssistantTab';

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

  // Build tabs dynamically based on whether this is a top-level assistant
  const tabs = useMemo(() => {
    const baseTabs = [
      { id: 'prompt', label: 'Prompt', icon: FileText, description: 'Edit prompts and responses' },
      { id: 'settings', label: 'Settings', icon: Settings, description: 'AI model settings' },
      { id: 'variables', label: 'Variables', icon: Variable, description: 'Manage variables' },
      { id: 'templates', label: 'Templates', icon: LayoutTemplate, description: 'Save as or apply template' },
    ];
    
    // Add Assistant tab for top-level prompts that are assistants
    if (isTopLevel && selectedItemData?.is_assistant) {
      baseTabs.push({ id: 'assistant', label: 'Assistant', icon: Bot, description: 'OpenAI Assistant configuration' });
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
        return '!text-primary !bg-transparent hover:!bg-muted/50';
      }
      return '!text-muted-foreground hover:!text-foreground hover:!bg-muted/50';
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
        {selectedItemData?.is_assistant && (
          <div className="flex items-center gap-1 text-xs text-primary">
            <Bot className="h-3.5 w-3.5" />
            <span>Assistant Mode</span>
          </div>
        )}
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

          {/* Assistant tab - only rendered for top-level assistants */}
          {isTopLevel && selectedItemData?.is_assistant && (
            <TabsContent value="assistant" className="h-full m-0 p-0">
              <AssistantTab
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
