import React from 'react';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
import StudioSidebar from '@/components/StudioSidebar';
import StudioThreadList from '@/components/StudioThreadList';
import StudioChat from '@/components/StudioChat';
import InstantiateAssistantCard from '@/components/InstantiateAssistantCard';
import { useStudioChat } from '@/hooks/useStudioChat';

const Studio = () => {
  const {
    assistantPrompts,
    selectedAssistant,
    selectedAssistantId,
    threads,
    activeThread,
    messages,
    isLoading,
    isLoadingThreads,
    isLoadingMessages,
    isSending,
    selectAssistant,
    switchThread,
    createThread,
    deleteThread,
    sendMessage,
    refetchAssistants,
  } = useStudioChat();

  const isInstantiated = selectedAssistant?.assistant?.status === 'active';

  const renderChatArea = () => {
    if (!selectedAssistant) {
      return (
        <StudioChat
          messages={[]}
          onSendMessage={() => {}}
          isLoadingMessages={false}
          isSending={false}
          disabled={true}
        />
      );
    }

    if (!isInstantiated) {
      return (
        <InstantiateAssistantCard
          assistant={selectedAssistant}
          onInstantiated={refetchAssistants}
        />
      );
    }

    return (
      <StudioChat
        messages={messages}
        onSendMessage={sendMessage}
        isLoadingMessages={isLoadingMessages}
        isSending={isSending}
        disabled={false}
        placeholder={`Message ${selectedAssistant?.assistant?.name || 'Assistant'}...`}
      />
    );
  };

  return (
    <div className="h-full flex flex-col">
      <div className="border-b border-border px-4 py-3">
        <h1 className="text-lg font-semibold">Studio</h1>
        <p className="text-sm text-muted-foreground">
          Chat with your OpenAI assistants with context from child prompts
        </p>
      </div>

      <div className="flex-1 min-h-0">
        <ResizablePanelGroup direction="horizontal" className="h-full">
          {/* Assistant Sidebar */}
          <ResizablePanel defaultSize={18} minSize={15} maxSize={25}>
            <StudioSidebar
              assistantPrompts={assistantPrompts}
              selectedAssistantId={selectedAssistantId}
              onSelectAssistant={selectAssistant}
              isLoading={isLoading}
            />
          </ResizablePanel>

          <ResizableHandle withHandle />

          {/* Thread List */}
          <ResizablePanel defaultSize={18} minSize={12} maxSize={25}>
            <StudioThreadList
              threads={threads}
              activeThreadId={activeThread?.row_id}
              onSwitchThread={switchThread}
              onCreateThread={createThread}
              onDeleteThread={deleteThread}
              isLoading={isLoadingThreads}
              disabled={!selectedAssistant || !isInstantiated}
            />
          </ResizablePanel>

          <ResizableHandle withHandle />

          {/* Chat Area */}
          <ResizablePanel defaultSize={64}>
            {renderChatArea()}
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </div>
  );
};

export default Studio;
