import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Paperclip, FileText, BookOpen } from 'lucide-react';
import WorkbenchFilesTab from './WorkbenchFilesTab';
import WorkbenchConfluenceTab from './WorkbenchConfluenceTab';
import WorkbenchLibraryTab from './WorkbenchLibraryTab';

const WorkbenchResourcesPanel = ({
  activeThread,
  files,
  pages,
  searchResults,
  spaces,
  isLoadingFiles,
  isLoadingConfluence,
  isUploading,
  isSearching,
  isSyncingFiles,
  isSyncingConfluence,
  onUploadFile,
  onDeleteFile,
  onSyncFile,
  onSearchPages,
  onListSpaces,
  onAttachPage,
  onDetachPage,
  onSyncPage,
  onClearSearch
}) => {
  const [activeTab, setActiveTab] = useState('files');

  return (
    <div className="h-full flex flex-col bg-card/50 border-l border-border">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
        {/* Tabs Header */}
        <div className="px-2 pt-2 border-b border-border">
          <TabsList className="w-full grid grid-cols-3 h-8">
            <TabsTrigger value="files" className="text-xs gap-1">
              <Paperclip className="h-3 w-3" />
              Files
              {files.length > 0 && (
                <span className="ml-1 text-compact text-muted-foreground">({files.length})</span>
              )}
            </TabsTrigger>
            <TabsTrigger value="confluence" className="text-xs gap-1">
              <FileText className="h-3 w-3" />
              Pages
              {pages.length > 0 && (
                <span className="ml-1 text-compact text-muted-foreground">({pages.length})</span>
              )}
            </TabsTrigger>
            <TabsTrigger value="library" className="text-xs gap-1">
              <BookOpen className="h-3 w-3" />
              Library
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Tab Contents */}
        <TabsContent value="files" className="flex-1 m-0 overflow-hidden">
          <WorkbenchFilesTab
            files={files}
            isLoading={isLoadingFiles}
            isUploading={isUploading}
            isSyncing={isSyncingFiles}
            onUploadFile={onUploadFile}
            onDeleteFile={onDeleteFile}
            onSyncFile={onSyncFile}
            disabled={!activeThread}
          />
        </TabsContent>

        <TabsContent value="confluence" className="flex-1 m-0 overflow-hidden">
          <WorkbenchConfluenceTab
            pages={pages}
            searchResults={searchResults}
            spaces={spaces}
            isLoading={isLoadingConfluence}
            isSearching={isSearching}
            isSyncing={isSyncingConfluence}
            onSearch={onSearchPages}
            onListSpaces={onListSpaces}
            onAttachPage={onAttachPage}
            onDetachPage={onDetachPage}
            onSyncPage={onSyncPage}
            onClearSearch={onClearSearch}
            disabled={!activeThread}
          />
        </TabsContent>

        <TabsContent value="library" className="flex-1 m-0 overflow-hidden">
          <WorkbenchLibraryTab />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default WorkbenchResourcesPanel;
