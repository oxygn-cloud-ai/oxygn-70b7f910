import { useState, useEffect } from "react";
import {
  MessageSquare, Plus, Clock, Star, Search, Send, Paperclip, 
  Mic, MoreVertical, PanelRightClose, PanelRightOpen, 
  Trash2, Edit3, FileText, Link2, BookOpen, Loader2,
  RefreshCw, X, ChevronDown, CheckCircle2, Wrench, Play, List,
  Pause, XCircle, AlertTriangle, SkipForward, RotateCcw,
  Upload, ExternalLink, ChevronRight, FolderOpen
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { 
  SkeletonThreadList, 
  SkeletonChat, 
  SkeletonListItem 
} from "@/components/shared/Skeletons";
import { 
  EmptyThreads, 
  EmptySearchResults, 
  WelcomeChat,
  EmptyLinkedPages 
} from "@/components/shared/EmptyStates";

// No mock data - all data comes from props/hooks

// Cascade Progress Bar Component
const CascadeProgressBar = ({ 
  isRunning = true, 
  isPaused = false, 
  currentLevel = 2, 
  totalLevels = 3,
  completedPrompts = 5,
  totalPrompts = 12,
  skippedPrompts = 1,
  currentPromptName = "Generate FAQ Responses",
  elapsedTime = "2:34",
  onPause,
  onResume,
  onCancel
}) => {
  const progress = totalPrompts > 0 ? (completedPrompts / totalPrompts) * 100 : 0;

  return (
    <div className="px-4 py-3 bg-primary/5 border-b border-primary/20">
      <div className="flex items-center gap-3">
        {/* Status Icon */}
        <div className="flex items-center gap-2">
          {isPaused ? (
            <Pause className="h-4 w-4 text-amber-500" />
          ) : (
            <Loader2 className="h-4 w-4 text-primary animate-spin" />
          )}
          <span className="text-body-sm text-on-surface font-medium">
            {isPaused ? "Paused" : "Running Cascade"}
          </span>
        </div>

        {/* Progress Bar */}
        <div className="flex-1 max-w-xs">
          <Progress value={progress} className="h-2" />
        </div>

        {/* Stats */}
        <div className="flex items-center gap-4 text-[11px] text-on-surface-variant">
          <span>{completedPrompts}/{totalPrompts} prompts</span>
          {skippedPrompts > 0 && (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="flex items-center gap-1 text-amber-600">
                  <SkipForward className="h-3 w-3" />
                  {skippedPrompts} skipped
                </span>
              </TooltipTrigger>
              <TooltipContent className="text-[10px]">Skipped due to exclusion settings</TooltipContent>
            </Tooltip>
          )}
          <span>Level {currentLevel}/{totalLevels}</span>
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {elapsedTime}
          </span>
        </div>

        {/* Current Prompt */}
        <div className="flex items-center gap-2 text-[11px]">
          <ChevronRight className="h-3 w-3 text-on-surface-variant" />
          <span className="text-on-surface truncate max-w-32">{currentPromptName}</span>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <button 
                onClick={isPaused ? onResume : onPause}
                className="w-7 h-7 flex items-center justify-center rounded-m3-full text-on-surface-variant hover:bg-on-surface/[0.08]"
              >
                {isPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
              </button>
            </TooltipTrigger>
            <TooltipContent className="text-[10px]">{isPaused ? "Resume" : "Pause"}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <button 
                onClick={onCancel}
                className="w-7 h-7 flex items-center justify-center rounded-m3-full text-destructive hover:bg-on-surface/[0.08]"
              >
                <XCircle className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent className="text-[10px]">Cancel</TooltipContent>
          </Tooltip>
        </div>
      </div>
    </div>
  );
};

// Cascade Error Dialog Component
const CascadeErrorDialog = ({ 
  isOpen = true,
  promptName = "Generate Product Description",
  errorMessage = "Rate limit exceeded. Please wait before retrying.",
  errorType = "rate_limit",
  onStop,
  onSkip,
  onRetry
}) => {
  if (!isOpen) return null;

  const errorIcons = {
    rate_limit: Clock,
    timeout: Clock,
    no_message: AlertTriangle,
    api_error: XCircle,
  };
  const ErrorIcon = errorIcons[errorType] || AlertTriangle;

  const suggestions = {
    rate_limit: "Wait a moment before retrying, or skip this prompt to continue the cascade.",
    timeout: "The request took too long. Try again or skip to continue.",
    no_message: "This prompt has no content to send. Add content or skip.",
    api_error: "An API error occurred. Check your settings and try again.",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-96 bg-surface-container-high rounded-m3-lg border border-outline-variant shadow-xl">
        {/* Header */}
        <div className="p-4 border-b border-outline-variant">
          <div className="flex items-center gap-2 text-destructive">
            <ErrorIcon className="h-5 w-5" />
            <span className="text-title-sm font-medium">Cascade Error</span>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-on-surface-variant" />
            <span className="text-body-sm text-on-surface font-medium">{promptName}</span>
          </div>

          <div className="p-3 bg-destructive/10 rounded-m3-md border border-destructive/20">
            <p className="text-body-sm text-destructive">{errorMessage}</p>
          </div>

          <p className="text-[11px] text-on-surface-variant">{suggestions[errorType]}</p>
        </div>

        {/* Actions */}
        <div className="p-4 border-t border-outline-variant flex items-center justify-end gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <button 
                onClick={onStop}
                className="w-8 h-8 flex items-center justify-center rounded-m3-full text-destructive hover:bg-on-surface/[0.08]"
              >
                <XCircle className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent className="text-[10px]">Stop Cascade</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <button 
                onClick={onSkip}
                className="w-8 h-8 flex items-center justify-center rounded-m3-full text-on-surface-variant hover:bg-on-surface/[0.08]"
              >
                <SkipForward className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent className="text-[10px]">Skip & Continue</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <button 
                onClick={onRetry}
                className="w-8 h-8 flex items-center justify-center rounded-m3-full text-on-surface-variant hover:bg-surface-container"
              >
                <RotateCcw className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent className="text-[10px]">Retry</TooltipContent>
          </Tooltip>
        </div>
      </div>
    </div>
  );
};

// Thread List Component with micro-interactions
const ThreadList = ({ threads, activeThread, onSelectThread, filter = "all", isLoading = false, searchQuery = "" }) => {
  const filteredThreads = filter === "starred" 
    ? threads.filter(t => t.starred) 
    : threads;

  if (isLoading) {
    return <SkeletonThreadList count={4} />;
  }

  if (searchQuery && filteredThreads.length === 0) {
    return <EmptySearchResults query={searchQuery} />;
  }

  if (filteredThreads.length === 0) {
    return <EmptyThreads />;
  }

  return (
    <div className="space-y-1">
      {filteredThreads.map((thread, index) => (
        <button
          key={thread.id}
          onClick={() => onSelectThread(thread)}
          className={`w-full p-2.5 rounded-m3-md text-left transition-all duration-200 animate-fade-in group ${
            activeThread?.id === thread.id 
              ? "bg-secondary-container" 
              : "hover:bg-on-surface/[0.08] hover:translate-x-0.5"
          }`}
          style={{ animationDelay: `${index * 50}ms` }}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-body-sm text-on-surface font-medium truncate">{thread.title}</span>
                {thread.starred && (
                  <Star className="h-3 w-3 text-amber-500 flex-shrink-0 fill-amber-500 transition-transform group-hover:scale-110" />
                )}
              </div>
              <div className="flex items-center gap-2 mt-0.5 text-[10px] text-on-surface-variant">
                <span>{thread.messageCount} messages</span>
                <span>•</span>
                <span>{thread.lastMessage}</span>
              </div>
            </div>
          </div>
        </button>
      ))}
    </div>
  );
};

// Chat Message Component with animations
const ChatMessage = ({ message, index = 0 }) => {
  const isUser = message.role === "user";
  
  return (
    <div 
      className={`flex ${isUser ? "justify-end" : "justify-start"} animate-fade-in`}
      style={{ animationDelay: `${index * 100}ms` }}
    >
      <div 
        className={`max-w-[80%] px-3 py-2 rounded-2xl text-body-sm transition-all duration-200 hover:shadow-sm ${
          isUser
            ? "bg-primary text-primary-foreground rounded-br-sm"
            : "bg-surface-container-high text-on-surface rounded-bl-sm"
        }`}
      >
        <p className="whitespace-pre-wrap">{message.content}</p>
      </div>
    </div>
  );
};

// Tool Activity Indicator Component
const ToolActivityIndicator = ({ tools, isExecuting }) => {
  if (!tools || tools.length === 0) return null;

  return (
    <div className="px-3 py-2 mx-3 my-1 bg-surface-container rounded-m3-lg border border-outline-variant">
      <div className="flex items-center gap-2 text-[10px] text-on-surface-variant mb-2">
        <Wrench className="h-3 w-3" />
        <span className="font-medium">AI is using tools</span>
      </div>
      <div className="space-y-1">
        {tools.map((tool, index) => {
          const Icon = tool.icon;
          const isComplete = tool.status === "complete";
          const isRunning = tool.status === "running";

          return (
            <div 
              key={`${tool.name}-${index}`}
              className={`flex items-center gap-2 text-[11px] py-1 px-2 rounded-m3-sm ${
                isComplete ? "bg-surface/50" : "bg-surface"
              }`}
            >
              {isRunning ? (
                <Loader2 className={`h-3 w-3 animate-spin ${tool.color}`} />
              ) : isComplete ? (
                <CheckCircle2 className="h-3 w-3 text-green-500" />
              ) : (
                <Icon className={`h-3 w-3 ${tool.color}`} />
              )}
              <span className={isComplete ? "text-on-surface-variant" : "text-on-surface"}>
                {tool.label}
              </span>
            </div>
          );
        })}
      </div>
      {isExecuting && (
        <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-outline-variant text-[10px] text-on-surface-variant">
          <Loader2 className="h-2.5 w-2.5 animate-spin" />
          Processing tool results...
        </div>
      )}
    </div>
  );
};

// Enhanced Resources Panel Component
const ResourcesPanel = ({ 
  isOpen, 
  onClose, 
  files = [], 
  isLoadingFiles = false,
  isUploading = false, 
  onUploadFile, 
  onDeleteFile,
  activeThreadId,
  confluenceHook,
  libraryHook
}) => {
  const [activeTab, setActiveTab] = useState("files");
  const [confluenceSearch, setConfluenceSearch] = useState("");
  const [librarySearch, setLibrarySearch] = useState("");
  const fileInputRef = React.useRef(null);

  // Destructure confluence hook
  const {
    pages = [],
    searchResults = [],
    spaces = [],
    isLoading: isLoadingPages = false,
    isSearching = false,
    isSyncing = false,
    searchPages,
    listSpaces,
    attachPage,
    detachPage,
    syncPage,
    clearSearch,
  } = confluenceHook || {};

  // Destructure library hook
  const {
    items: libraryItems = [],
    categories = [],
    isLoading: isLoadingLibrary = false,
    searchItems,
  } = libraryHook || {};

  // Load spaces on mount
  useEffect(() => {
    if (listSpaces) {
      listSpaces();
    }
  }, [listSpaces]);

  const handleFileSelect = async (e) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile && onUploadFile && activeThreadId) {
      await onUploadFile(activeThreadId, selectedFile);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSearch = (query) => {
    setConfluenceSearch(query);
    if (searchPages) {
      searchPages(query);
    }
  };

  const handleAttachPage = async (page) => {
    if (attachPage && activeThreadId) {
      await attachPage(activeThreadId, page);
      clearSearch?.();
      setConfluenceSearch('');
    }
  };

  const filteredLibrary = librarySearch 
    ? (searchItems ? searchItems(librarySearch) : libraryItems)
    : libraryItems;

  if (!isOpen) return null;

  return (
    <div className="w-72 h-full flex flex-col bg-surface-container-low border-l border-outline-variant">
      {/* Header */}
      <div className="h-14 flex items-center justify-between px-3 border-b border-outline-variant" style={{ height: "56px" }}>
        <span className="text-title-sm text-on-surface font-medium">Resources</span>
        <Tooltip>
          <TooltipTrigger asChild>
            <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-m3-full text-on-surface-variant hover:bg-on-surface/[0.08]">
              <X className="h-4 w-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent className="text-[10px]">Close</TooltipContent>
        </Tooltip>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <TabsList className="w-full h-9 grid grid-cols-3 bg-surface-container m-2 rounded-m3-sm">
          <TabsTrigger value="files" className="text-[10px] gap-1 data-[state=active]:bg-secondary-container">
            <Paperclip className="h-3.5 w-3.5" />
            <span className="text-[9px]">{files.length}</span>
          </TabsTrigger>
          <TabsTrigger value="pages" className="text-[10px] gap-1 data-[state=active]:bg-secondary-container">
            <FileText className="h-3.5 w-3.5" />
            <span className="text-[9px]">{pages.length}</span>
          </TabsTrigger>
          <TabsTrigger value="library" className="text-[10px] gap-1 data-[state=active]:bg-secondary-container">
            <BookOpen className="h-3.5 w-3.5" />
          </TabsTrigger>
        </TabsList>

        {/* Files Tab - Real Data */}
        <TabsContent value="files" className="flex-1 m-0 overflow-auto p-2">
          <div className="space-y-2">
            {/* Upload Progress */}
            {isUploading && (
              <div className="p-2 bg-primary/5 rounded-m3-sm border border-primary/20">
                <div className="flex items-center gap-2 mb-1.5">
                  <Loader2 className="h-3 w-3 text-primary animate-spin" />
                  <span className="text-[11px] text-on-surface">Uploading file...</span>
                </div>
                <Progress value={50} className="h-1.5" />
              </div>
            )}

            {/* Loading state */}
            {isLoadingFiles && (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-4 w-4 text-primary animate-spin" />
              </div>
            )}

            {/* File List */}
            {!isLoadingFiles && files.map(file => (
              <div key={file.row_id} className="flex items-center gap-2 p-2 rounded-m3-sm hover:bg-on-surface/[0.08] group">
                <div className="w-8 h-8 flex items-center justify-center bg-surface-container rounded-m3-sm">
                  <FileText className="h-4 w-4 text-on-surface-variant" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-body-sm text-on-surface truncate">{file.original_filename}</p>
                  <div className="flex items-center gap-2">
                    <p className="text-[10px] text-on-surface-variant">
                      {file.file_size ? `${Math.round(file.file_size / 1024)} KB` : 'Unknown size'}
                    </p>
                    <span className={`text-[9px] px-1 py-0.5 rounded ${
                      file.upload_status === 'synced' ? 'bg-green-500/10 text-green-600' :
                      file.upload_status === 'uploaded' ? 'bg-blue-500/10 text-blue-600' :
                      'bg-amber-500/10 text-amber-600'
                    }`}>
                      {file.upload_status || 'Pending'}
                    </span>
                  </div>
                </div>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button 
                      onClick={() => onDeleteFile?.(file.row_id)}
                      className="w-6 h-6 flex items-center justify-center rounded-m3-full text-destructive opacity-0 group-hover:opacity-100 hover:bg-on-surface/[0.08]"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent className="text-[10px]">Remove</TooltipContent>
                </Tooltip>
              </div>
            ))}

            {/* Empty state */}
            {!isLoadingFiles && files.length === 0 && (
              <div className="text-center py-4 text-on-surface-variant">
                <Paperclip className="h-6 w-6 mx-auto opacity-30 mb-1" />
                <p className="text-[11px]">No files attached</p>
              </div>
            )}

            {/* Upload Button */}
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={handleFileSelect}
            />
            <button 
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="w-full h-16 flex flex-col items-center justify-center gap-1 border-2 border-dashed border-outline-variant rounded-m3-md hover:border-primary hover:bg-primary/5 transition-colors disabled:opacity-50"
            >
              <Upload className="h-4 w-4 text-on-surface-variant" />
              <span className="text-[10px] text-on-surface-variant">Drop files or click to upload</span>
            </button>
          </div>
        </TabsContent>

        {/* Confluence Tab - Real Data */}
        <TabsContent value="pages" className="flex-1 m-0 overflow-auto p-2">
          <div className="space-y-2">
            {/* Search */}
            <div className="flex items-center gap-2 h-8 px-2 bg-surface-container rounded-m3-sm border border-outline-variant">
              {isSearching ? (
                <Loader2 className="h-3.5 w-3.5 text-primary animate-spin" />
              ) : (
                <Search className="h-3.5 w-3.5 text-on-surface-variant" />
              )}
              <input
                type="text"
                value={confluenceSearch}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder="Search Confluence..."
                className="flex-1 bg-transparent text-body-sm text-on-surface placeholder:text-on-surface-variant focus:outline-none"
              />
              {confluenceSearch && (
                <button 
                  onClick={() => { setConfluenceSearch(''); clearSearch?.(); }}
                  className="w-5 h-5 flex items-center justify-center rounded-m3-full text-on-surface-variant hover:bg-on-surface/[0.08]"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>

            {/* Search Results */}
            {searchResults.length > 0 && (
              <div className="space-y-1 border-b border-outline-variant pb-2">
                <span className="text-[10px] text-on-surface-variant uppercase">Search Results</span>
                {searchResults.map(page => (
                  <div 
                    key={page.page_id} 
                    onClick={() => handleAttachPage(page)}
                    className="flex items-center gap-2 p-2 rounded-m3-sm hover:bg-on-surface/[0.08] cursor-pointer"
                  >
                    <FileText className="h-3.5 w-3.5 text-on-surface-variant" />
                    <div className="flex-1 min-w-0">
                      <p className="text-body-sm text-on-surface truncate">{page.page_title || page.title}</p>
                      <p className="text-[10px] text-on-surface-variant">{page.space_key}</p>
                    </div>
                    <Plus className="h-3.5 w-3.5 text-primary" />
                  </div>
                ))}
              </div>
            )}

            {/* Linked Pages */}
            <div className="space-y-1">
              <span className="text-[10px] text-on-surface-variant uppercase">Linked Pages</span>
              
              {isLoadingPages ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-4 w-4 text-primary animate-spin" />
                </div>
              ) : pages.length === 0 ? (
                <div className="text-center py-4 text-on-surface-variant">
                  <Link2 className="h-6 w-6 mx-auto opacity-30 mb-1" />
                  <p className="text-[11px]">No pages linked</p>
                  <p className="text-[10px] opacity-70">Search above to link pages</p>
                </div>
              ) : (
                pages.map(page => (
                  <div key={page.row_id} className="flex items-center gap-2 p-2 rounded-m3-sm hover:bg-on-surface/[0.08] group">
                    <Link2 className="h-3.5 w-3.5 text-on-surface-variant" />
                    <div className="flex-1 min-w-0">
                      <p className="text-body-sm text-on-surface truncate">{page.page_title}</p>
                      <div className="flex items-center gap-2">
                        <p className="text-[10px] text-on-surface-variant">{page.space_key}</p>
                        {page.sync_status === "synced" ? (
                          <span className="text-[9px] px-1 py-0.5 rounded bg-green-500/10 text-green-600 flex items-center gap-0.5">
                            <CheckCircle2 className="h-2.5 w-2.5" />
                            Synced
                          </span>
                        ) : page.sync_status === "failed" ? (
                          <span className="text-[9px] px-1 py-0.5 rounded bg-red-500/10 text-red-600">Failed</span>
                        ) : (
                          <span className="text-[9px] px-1 py-0.5 rounded bg-amber-500/10 text-amber-600">
                            {isSyncing ? 'Syncing...' : 'Pending'}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button 
                            onClick={() => syncPage?.(page.row_id)}
                            disabled={isSyncing}
                            className="w-6 h-6 flex items-center justify-center rounded-m3-full text-on-surface-variant hover:bg-on-surface/[0.08] disabled:opacity-50"
                          >
                            <RefreshCw className={`h-3 w-3 ${isSyncing ? 'animate-spin' : ''}`} />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent className="text-[10px]">Sync</TooltipContent>
                      </Tooltip>
                      {page.page_url && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <a 
                              href={page.page_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="w-6 h-6 flex items-center justify-center rounded-m3-full text-on-surface-variant hover:bg-on-surface/[0.08]"
                            >
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          </TooltipTrigger>
                          <TooltipContent className="text-[10px]">Open in Confluence</TooltipContent>
                        </Tooltip>
                      )}
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button 
                            onClick={() => detachPage?.(page.row_id)}
                            className="w-6 h-6 flex items-center justify-center rounded-m3-full text-destructive hover:bg-on-surface/[0.08]"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent className="text-[10px]">Detach</TooltipContent>
                      </Tooltip>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </TabsContent>

        {/* Library Tab - Real Data */}
        <TabsContent value="library" className="flex-1 m-0 overflow-auto p-2">
          <div className="space-y-2">
            {/* Search */}
            <div className="flex items-center gap-2 h-8 px-2 bg-surface-container rounded-m3-sm border border-outline-variant">
              <Search className="h-3.5 w-3.5 text-on-surface-variant" />
              <input
                type="text"
                value={librarySearch}
                onChange={(e) => setLibrarySearch(e.target.value)}
                placeholder="Search library..."
                className="flex-1 bg-transparent text-body-sm text-on-surface placeholder:text-on-surface-variant focus:outline-none"
              />
            </div>

            {/* Library Prompts */}
            <div className="space-y-1">
              {isLoadingLibrary ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-4 w-4 text-primary animate-spin" />
                </div>
              ) : filteredLibrary.length === 0 ? (
                <div className="text-center py-4 text-on-surface-variant">
                  <BookOpen className="h-6 w-6 mx-auto opacity-30 mb-1" />
                  <p className="text-[11px]">{librarySearch ? 'No matches found' : 'Library empty'}</p>
                </div>
              ) : (
                filteredLibrary.map(prompt => (
                  <div key={prompt.row_id} className="p-2 rounded-m3-sm hover:bg-on-surface/[0.08] cursor-pointer group">
                    <div className="flex items-center justify-between">
                      <span className="text-body-sm text-on-surface font-medium">{prompt.name}</span>
                      {prompt.category && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-surface-container text-on-surface-variant">{prompt.category}</span>
                      )}
                    </div>
                    {prompt.description && (
                      <p className="text-[10px] text-on-surface-variant mt-0.5">{prompt.description}</p>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

// Main Workbench Content Component - Now connected to real hooks
const WorkbenchContent = ({ 
  activeSubItem = "new-conversation", 
  showCascadeProgress = false, 
  showCascadeError = false,
  workbenchThreads,
  workbenchMessages,
  workbenchFiles,
  workbenchConfluence,
  promptLibrary,
}) => {
  // Destructure from props with fallbacks
  const {
    threads = [],
    activeThread,
    setActiveThread,
    isLoading: isLoadingThreads = false,
    createThread,
    deleteThread,
    updateThread,
  } = workbenchThreads || {};
  
  const {
    messages = [],
    isLoading: isLoadingMessages = false,
    isStreaming = false,
    streamingMessage = '',
    toolActivity = [],
    isExecutingTools = false,
    fetchMessages,
    sendMessage,
    clearMessages,
  } = workbenchMessages || {};
  
  const {
    files = [],
    isLoading: isLoadingFiles = false,
    isUploading = false,
    uploadFile,
    deleteFile: deleteWorkbenchFile,
    fetchFiles,
  } = workbenchFiles || {};
  
  const [searchQuery, setSearchQuery] = useState("");
  const [resourcesOpen, setResourcesOpen] = useState(true);
  const [cascadePaused, setCascadePaused] = useState(false);
  const [inputValue, setInputValue] = useState("");

  // Fetch messages when active thread changes
  useEffect(() => {
    if (activeThread?.row_id && fetchMessages) {
      fetchMessages(activeThread.row_id);
    }
  }, [activeThread?.row_id, fetchMessages]);
  
  // Fetch files when active thread changes
  useEffect(() => {
    if (activeThread?.row_id && fetchFiles) {
      fetchFiles(activeThread.row_id);
    }
  }, [activeThread?.row_id, fetchFiles]);
  
  // Fetch confluence pages when active thread changes
  useEffect(() => {
    if (activeThread?.row_id && workbenchConfluence?.fetchPages) {
      workbenchConfluence.fetchPages(activeThread.row_id);
    }
  }, [activeThread?.row_id, workbenchConfluence]);

  const getFilteredThreads = () => {
    // Use real threads if available
    const realThreads = threads.map(t => ({
      id: t.row_id,
      title: t.title || 'Untitled',
      lastMessage: t.updated_at ? new Date(t.updated_at).toLocaleDateString() : 'No date',
      messageCount: 0, // Would need to be fetched separately
      starred: false, // Not in current schema
    }));
    
    // Use real threads only - empty state shown if none
    const displayThreads = realThreads;
    
    switch (activeSubItem) {
      case "starred":
        return displayThreads.filter(t => t.starred);
      case "recent":
        return displayThreads.slice(0, 3);
      default:
        return displayThreads;
    }
  };

  const getTitle = () => {
    switch (activeSubItem) {
      case "new-conversation": return "New Conversation";
      case "recent": return "Recent Conversations";
      case "starred": return "Starred Conversations";
      case "all-threads": return "All Threads";
      case "continue-last": return "Continue Last Session";
      default: return "Workbench";
    }
  };

  // Show new conversation view
  if (activeSubItem === "new-conversation" && !activeThread) {
    return (
      <div className="flex-1 flex flex-col bg-surface min-h-0">
        {/* Cascade Progress Bar */}
        {showCascadeProgress && (
          <CascadeProgressBar 
            isPaused={cascadePaused}
            onPause={() => setCascadePaused(true)}
            onResume={() => setCascadePaused(false)}
            onCancel={() => {}}
          />
        )}

        {/* Header */}
        <div className="h-14 flex items-center justify-between px-4 border-b border-outline-variant" style={{ height: "56px" }}>
          <h2 className="text-title-sm text-on-surface font-medium">New Conversation</h2>
        </div>

        {/* Welcome State */}
        <div className="flex-1 flex flex-col">
          <div className="flex-1 flex items-center justify-center">
            <WelcomeChat />
          </div>
          
          {/* Input */}
          <div className="p-4 border-t border-outline-variant">
            <div className="flex items-center gap-2 max-w-2xl mx-auto">
              <div className="flex-1 h-11 px-4 bg-surface-container rounded-2xl border border-outline-variant flex items-center gap-2 transition-all focus-within:border-primary focus-within:ring-1 focus-within:ring-primary">
                <input 
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={async (e) => {
                    if (e.key === 'Enter' && !e.shiftKey && inputValue.trim() && createThread && sendMessage) {
                      e.preventDefault();
                      // Create new thread and send first message
                      const newThread = await createThread('New Conversation');
                      if (newThread) {
                        await sendMessage(newThread.row_id, inputValue);
                        setInputValue("");
                      }
                    }
                  }}
                  placeholder="Type your message..."
                  className="flex-1 bg-transparent text-body-sm text-on-surface placeholder:text-on-surface-variant focus:outline-none"
                />
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button className="w-7 h-7 flex items-center justify-center rounded-m3-full text-on-surface-variant hover:bg-on-surface/[0.08] transition-colors">
                      <Paperclip className="h-4 w-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent className="text-[10px]">Attach</TooltipContent>
                </Tooltip>
              </div>
              <button 
                onClick={async () => {
                  if (inputValue.trim() && createThread && sendMessage) {
                    const newThread = await createThread('New Conversation');
                    if (newThread) {
                      await sendMessage(newThread.row_id, inputValue);
                      setInputValue("");
                    }
                  }
                }}
                disabled={!inputValue.trim()}
                className="w-11 h-11 flex items-center justify-center rounded-full bg-primary text-primary-foreground transition-all hover:scale-105 hover:shadow-md active:scale-95 disabled:opacity-50 disabled:hover:scale-100"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Cascade Error Dialog */}
        {showCascadeError && (
          <CascadeErrorDialog 
            onStop={() => {}}
            onSkip={() => {}}
            onRetry={() => {}}
          />
        )}
      </div>
    );
  }

  // Show thread list and chat view
  return (
    <div className="flex-1 flex flex-col bg-surface min-h-0">
      {/* Cascade Progress Bar */}
      {showCascadeProgress && (
        <CascadeProgressBar 
          isPaused={cascadePaused}
          onPause={() => setCascadePaused(true)}
          onResume={() => setCascadePaused(false)}
          onCancel={() => {}}
        />
      )}

      <div className="flex-1 flex overflow-hidden">
        {/* Thread Sidebar */}
        <div className="w-56 h-full flex flex-col bg-surface-container-low border-r border-outline-variant">
          {/* Sidebar Header */}
          <div className="h-14 flex items-center justify-between px-3 border-b border-outline-variant" style={{ height: "56px" }}>
            <span className="text-title-sm text-on-surface font-medium">{getTitle()}</span>
            <Tooltip>
              <TooltipTrigger asChild>
                <button 
                  onClick={() => createThread?.('New Thread')}
                  className="w-7 h-7 flex items-center justify-center rounded-m3-full text-on-surface-variant hover:bg-on-surface/[0.08]"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent className="text-[10px]">New Thread</TooltipContent>
            </Tooltip>
          </div>

          {/* Search */}
          <div className="p-2">
            <div className="flex items-center gap-2 h-8 px-2 bg-surface-container rounded-m3-sm border border-outline-variant">
              <Search className="h-3.5 w-3.5 text-on-surface-variant" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search threads..."
                className="flex-1 bg-transparent text-body-sm text-on-surface placeholder:text-on-surface-variant focus:outline-none"
              />
            </div>
          </div>

          {/* Thread List */}
          <div className="flex-1 overflow-auto p-2">
            <ThreadList 
              threads={getFilteredThreads()} 
              activeThread={activeThread}
              onSelectThread={setActiveThread}
            />
          </div>
        </div>

        {/* Chat Area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {activeThread ? (
            <>
              {/* Chat Header */}
              <div className="h-14 flex items-center justify-between px-3 border-b border-outline-variant" style={{ height: "56px" }}>
                <div className="flex items-center gap-2">
                  <h3 className="text-title-sm text-on-surface font-medium">{activeThread.title}</h3>
                  <span className="text-[10px] text-on-surface-variant">{activeThread.messageCount} messages</span>
                </div>
                <div className="flex items-center gap-0.5">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button className="w-7 h-7 flex items-center justify-center rounded-m3-full text-on-surface-variant hover:bg-on-surface/[0.08]">
                        <Star className={`h-4 w-4 ${activeThread.starred ? "text-amber-500 fill-amber-500" : ""}`} />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent className="text-[10px]">Star</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button 
                        onClick={() => deleteThread?.(activeThread.row_id || activeThread.id)}
                        className="w-7 h-7 flex items-center justify-center rounded-m3-full text-on-surface-variant hover:bg-on-surface/[0.08]"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent className="text-[10px]">Delete</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button 
                        onClick={() => setResourcesOpen(!resourcesOpen)}
                        className="w-7 h-7 flex items-center justify-center rounded-m3-full text-on-surface-variant hover:bg-on-surface/[0.08]"
                      >
                        {resourcesOpen ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent className="text-[10px]">{resourcesOpen ? "Hide Resources" : "Show Resources"}</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button className="w-7 h-7 flex items-center justify-center rounded-m3-full text-on-surface-variant hover:bg-on-surface/[0.08]">
                        <MoreVertical className="h-4 w-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent className="text-[10px]">More</TooltipContent>
                  </Tooltip>
                </div>
              </div>

              {/* Messages - Use real messages if available */}
              <div className="flex-1 overflow-auto p-3 space-y-3">
                {isLoadingMessages ? (
                  <SkeletonChat />
                ) : (
                  <>
                    {/* Real messages only */}
                    {messages.map((msg, index) => (
                      <ChatMessage key={msg.row_id || msg.id} message={msg} index={index} />
                    ))}
                    {/* Streaming message */}
                    {isStreaming && streamingMessage && (
                      <ChatMessage message={{ role: 'assistant', content: streamingMessage }} />
                    )}
                    {/* Tool activity */}
                    {(toolActivity.length > 0 || isExecutingTools) && (
                      <ToolActivityIndicator tools={toolActivity} isExecuting={isExecutingTools} />
                    )}
                  </>
                )}
              </div>

              {/* Input */}
              <div className="p-3 border-t border-outline-variant">
                <div className="flex items-end gap-2">
                  <div className="flex-1 min-h-10 px-3 py-2 bg-surface-container-high rounded-2xl border border-outline-variant flex items-center">
                    <input 
                      type="text"
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey && inputValue.trim() && !isStreaming) {
                          e.preventDefault();
                          const threadId = activeThread?.row_id || activeThread?.id;
                          if (threadId && sendMessage) {
                            sendMessage(threadId, inputValue);
                            setInputValue("");
                          }
                        }
                      }}
                      placeholder="Type a message..."
                      disabled={isStreaming}
                      className="flex-1 bg-transparent text-body-sm text-on-surface placeholder:text-on-surface-variant focus:outline-none disabled:opacity-50 resize-y"
                    />
                  </div>
                  <div className="flex gap-0.5">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button className="w-9 h-9 flex items-center justify-center rounded-full text-on-surface-variant hover:bg-on-surface/[0.08]">
                          <Paperclip className="h-4 w-4" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent className="text-[10px]">Attach</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button 
                          onClick={() => {
                            if (inputValue.trim() && !isStreaming) {
                              const threadId = activeThread?.row_id || activeThread?.id;
                              if (threadId && sendMessage) {
                                sendMessage(threadId, inputValue);
                                setInputValue("");
                              }
                            }
                          }}
                          disabled={!inputValue.trim() || isStreaming}
                          className="w-9 h-9 flex items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container disabled:opacity-50"
                        >
                          {isStreaming ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Send className="h-4 w-4" />
                          )}
                        </button>
                      </TooltipTrigger>
                      <TooltipContent className="text-[10px]">Send</TooltipContent>
                    </Tooltip>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <MessageSquare className="h-10 w-10 mx-auto text-on-surface-variant/30 mb-2" />
                <p className="text-body-sm text-on-surface-variant">Select a conversation</p>
                <p className="text-[10px] text-on-surface-variant/70 mt-0.5">or start a new one</p>
              </div>
            </div>
          )}
        </div>

        {/* Resources Panel */}
        {activeThread && (
          <ResourcesPanel 
            isOpen={resourcesOpen} 
            onClose={() => setResourcesOpen(false)}
            files={files}
            isLoadingFiles={isLoadingFiles}
            isUploading={isUploading}
            onUploadFile={uploadFile}
            onDeleteFile={deleteWorkbenchFile}
            activeThreadId={activeThread?.row_id}
            confluenceHook={workbenchConfluence}
            libraryHook={promptLibrary}
          />
        )}
      </div>

      {/* Cascade Error Dialog */}
      {showCascadeError && (
        <CascadeErrorDialog 
          onStop={() => {}}
          onSkip={() => {}}
          onRetry={() => {}}
        />
      )}
    </div>
  );
};

export default WorkbenchContent;
