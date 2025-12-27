import React, { useEffect } from 'react';
import { PanelGroup, Panel, PanelResizeHandle } from 'react-resizable-panels';
import { Loader2 } from 'lucide-react';
import { useWorkbenchThreads } from '@/hooks/useWorkbenchThreads';
import { useWorkbenchMessages } from '@/hooks/useWorkbenchMessages';
import { useWorkbenchFiles } from '@/hooks/useWorkbenchFiles';
import { useWorkbenchConfluence } from '@/hooks/useWorkbenchConfluence';
import WorkbenchSidebar from '@/components/workbench/WorkbenchSidebar';
import WorkbenchChatPanel from '@/components/workbench/WorkbenchChatPanel';
import WorkbenchResourcesPanel from '@/components/workbench/WorkbenchResourcesPanel';

const Workbench = () => {
  const {
    threads,
    activeThread,
    setActiveThread,
    isLoading: isLoadingThreads,
    createThread,
    updateThread,
    deleteThread
  } = useWorkbenchThreads();

  const {
    messages,
    isLoading: isLoadingMessages,
    isStreaming,
    streamingMessage,
    toolActivity,
    isExecutingTools,
    fetchMessages,
    sendMessage,
    clearMessages
  } = useWorkbenchMessages();

  const {
    files,
    isLoading: isLoadingFiles,
    isUploading,
    isSyncing: isSyncingFiles,
    fetchFiles,
    uploadFile,
    deleteFile,
    syncFileToOpenAI
  } = useWorkbenchFiles();

  const {
    pages,
    searchResults,
    spaces,
    isLoading: isLoadingConfluence,
    isSearching,
    isSyncing: isSyncingConfluence,
    fetchPages,
    searchPages,
    listSpaces,
    attachPage,
    detachPage,
    syncPage,
    clearSearch
  } = useWorkbenchConfluence();

  // Fetch messages, files, and pages when active thread changes
  useEffect(() => {
    if (activeThread?.row_id) {
      fetchMessages(activeThread.row_id);
      fetchFiles(activeThread.row_id);
      fetchPages(activeThread.row_id);
    }
  }, [activeThread?.row_id, fetchMessages, fetchFiles, fetchPages]);

  const handleSendMessage = async (content) => {
    if (!activeThread?.row_id) return;
    await sendMessage(activeThread.row_id, content);
  };

  const handleClearMessages = async () => {
    if (!activeThread?.row_id) return;
    await clearMessages(activeThread.row_id);
  };

  const handleUploadFile = async (file) => {
    if (!activeThread?.row_id) return;
    await uploadFile(activeThread.row_id, file);
  };

  const handleAttachPage = async (pageData) => {
    if (!activeThread?.row_id) return;
    await attachPage(activeThread.row_id, pageData);
  };

  if (isLoadingThreads) {
    return (
      <div className="h-full flex items-center justify-center bg-surface-container-lowest">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col bg-surface-container-lowest">
      <PanelGroup direction="horizontal" className="flex-1" autoSaveId="workbench-layout">
        {/* Threads Sidebar */}
        <Panel id="threads-panel" order={1} defaultSize={18} minSize={12} maxSize={25}>
          <WorkbenchSidebar
            threads={threads}
            activeThread={activeThread}
            onSelectThread={setActiveThread}
            onCreateThread={createThread}
            onUpdateThread={updateThread}
            onDeleteThread={deleteThread}
          />
        </Panel>

        <PanelResizeHandle className="w-1.5 bg-outline-variant hover:bg-primary/30 active:bg-primary/50 transition-colors duration-medium-1 cursor-col-resize group">
          <div className="w-full h-full flex items-center justify-center">
            <div className="w-0.5 h-8 bg-on-surface-variant/30 group-hover:bg-primary/50 rounded-full transition-colors duration-medium-1" />
          </div>
        </PanelResizeHandle>

        {/* Main Chat Panel */}
        <Panel id="chat-panel" order={2} defaultSize={55} minSize={35}>
          <WorkbenchChatPanel
            activeThread={activeThread}
            messages={messages}
            isLoading={isLoadingMessages}
            isStreaming={isStreaming}
            streamingMessage={streamingMessage}
            toolActivity={toolActivity}
            isExecutingTools={isExecutingTools}
            onSendMessage={handleSendMessage}
            onClearMessages={handleClearMessages}
            filesCount={files.length}
            pagesCount={pages.length}
          />
        </Panel>

        <PanelResizeHandle className="w-1.5 bg-outline-variant hover:bg-primary/30 active:bg-primary/50 transition-colors duration-medium-1 cursor-col-resize group">
          <div className="w-full h-full flex items-center justify-center">
            <div className="w-0.5 h-8 bg-on-surface-variant/30 group-hover:bg-primary/50 rounded-full transition-colors duration-medium-1" />
          </div>
        </PanelResizeHandle>

        {/* Resources Panel */}
        <Panel id="resources-panel" order={3} defaultSize={27} minSize={18} maxSize={40}>
          <WorkbenchResourcesPanel
            activeThread={activeThread}
            files={files}
            pages={pages}
            searchResults={searchResults}
            spaces={spaces}
            isLoadingFiles={isLoadingFiles}
            isLoadingConfluence={isLoadingConfluence}
            isUploading={isUploading}
            isSearching={isSearching}
            isSyncingFiles={isSyncingFiles}
            isSyncingConfluence={isSyncingConfluence}
            onUploadFile={handleUploadFile}
            onDeleteFile={deleteFile}
            onSyncFile={syncFileToOpenAI}
            onSearchPages={searchPages}
            onListSpaces={listSpaces}
            onAttachPage={handleAttachPage}
            onDetachPage={detachPage}
            onSyncPage={syncPage}
            onClearSearch={clearSearch}
          />
        </Panel>
      </PanelGroup>
    </div>
  );
};

export default Workbench;
