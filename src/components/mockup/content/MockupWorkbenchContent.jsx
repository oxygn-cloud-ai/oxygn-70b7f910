import React, { useState } from "react";
import { 
  MessageSquare, Plus, Clock, Star, Search, Send, Paperclip, 
  Mic, MoreVertical, PanelRightClose, PanelRightOpen, 
  Trash2, Edit3, FileText, Link2, BookOpen, Loader2,
  RefreshCw, X, ChevronDown, CheckCircle2, Wrench, Play, List
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  SkeletonThreadList, 
  SkeletonChat, 
  SkeletonListItem 
} from "../shared/MockupSkeletons";
import { 
  EmptyThreads, 
  EmptySearchResults, 
  WelcomeChat,
  EmptyLinkedPages 
} from "../shared/MockupEmptyStates";

// Mock data
const MOCK_THREADS = [
  { id: "1", title: "Customer Support Analysis", lastMessage: "2 hours ago", messageCount: 12, starred: true },
  { id: "2", title: "Code Review Discussion", lastMessage: "5 hours ago", messageCount: 8, starred: false },
  { id: "3", title: "Marketing Copy Draft", lastMessage: "1 day ago", messageCount: 24, starred: true },
  { id: "4", title: "API Integration Help", lastMessage: "2 days ago", messageCount: 6, starred: false },
  { id: "5", title: "Bug Investigation", lastMessage: "3 days ago", messageCount: 15, starred: false },
];

const MOCK_MESSAGES = [
  { id: 1, role: "user", content: "Can you help me analyze this customer feedback data?" },
  { id: 2, role: "assistant", content: "Of course! I'd be happy to help analyze customer feedback data. Could you share the data you'd like me to look at? I can help identify:\n\n• Key themes and patterns\n• Sentiment analysis\n• Common pain points\n• Actionable insights\n\nPlease paste the feedback or upload a file." },
  { id: 3, role: "user", content: "Here's a sample: 'Love the product but wish the mobile app was faster. Support team is always helpful though!'" },
  { id: 4, role: "assistant", content: "Great example! Here's my analysis:\n\n**Sentiment:** Mixed positive\n\n**Key Points:**\n1. **Product satisfaction** - Customer loves the core product\n2. **Performance issue** - Mobile app speed is a concern\n3. **Support praise** - Positive experience with support team\n\n**Recommendations:**\n• Prioritize mobile app performance optimization\n• Document support best practices for consistency\n• Consider in-app feedback for more data" },
];

const MOCK_TOOL_ACTIVITY = [
  { name: "list_prompts", label: "Listing prompts", status: "complete", icon: List, color: "text-blue-500" },
  { name: "get_prompt_details", label: "Reading prompt details", status: "complete", icon: FileText, color: "text-blue-500" },
  { name: "execute_prompt", label: "Executing prompt", status: "running", icon: Play, color: "text-green-500" },
];

const MOCK_FILES = [
  { id: "1", name: "customer_data.csv", size: "2.4 MB", type: "csv" },
  { id: "2", name: "analysis_results.json", size: "156 KB", type: "json" },
];

const MOCK_PAGES = [
  { id: "1", title: "Product Requirements", space: "Engineering" },
  { id: "2", title: "Customer Personas", space: "Marketing" },
];

// Thread List Component with micro-interactions
const ThreadList = ({ threads, activeThread, onSelectThread, filter = "all", isLoading = false, searchQuery = "" }) => {
  const filteredThreads = filter === "starred" 
    ? threads.filter(t => t.starred) 
    : threads;

  // Show loading skeleton
  if (isLoading) {
    return <SkeletonThreadList count={4} />;
  }

  // Show empty state for search
  if (searchQuery && filteredThreads.length === 0) {
    return <EmptySearchResults query={searchQuery} />;
  }

  // Show empty state for no threads
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

// Resources Panel Component
const ResourcesPanel = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState("files");

  if (!isOpen) return null;

  return (
    <div className="w-64 h-full flex flex-col bg-surface-container-low border-l border-outline-variant">
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
          </TabsTrigger>
          <TabsTrigger value="pages" className="text-[10px] gap-1 data-[state=active]:bg-secondary-container">
            <FileText className="h-3.5 w-3.5" />
          </TabsTrigger>
          <TabsTrigger value="library" className="text-[10px] gap-1 data-[state=active]:bg-secondary-container">
            <BookOpen className="h-3.5 w-3.5" />
          </TabsTrigger>
        </TabsList>

        <TabsContent value="files" className="flex-1 m-0 overflow-auto p-2">
          <div className="space-y-1">
            {MOCK_FILES.map(file => (
              <div key={file.id} className="flex items-center gap-2 p-2 rounded-m3-sm hover:bg-on-surface/[0.08]">
                <Paperclip className="h-3.5 w-3.5 text-on-surface-variant" />
                <div className="flex-1 min-w-0">
                  <p className="text-body-sm text-on-surface truncate">{file.name}</p>
                  <p className="text-[10px] text-on-surface-variant">{file.size}</p>
                </div>
              </div>
            ))}
            <Tooltip>
              <TooltipTrigger asChild>
                <button className="w-7 h-7 flex items-center justify-center rounded-m3-full text-on-surface-variant hover:bg-on-surface/[0.08]">
                  <Plus className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent className="text-[10px]">Upload File</TooltipContent>
            </Tooltip>
          </div>
        </TabsContent>

        <TabsContent value="pages" className="flex-1 m-0 overflow-auto p-2">
          <div className="space-y-1">
            {MOCK_PAGES.map(page => (
              <div key={page.id} className="flex items-center gap-2 p-2 rounded-m3-sm hover:bg-on-surface/[0.08]">
                <Link2 className="h-3.5 w-3.5 text-on-surface-variant" />
                <div className="flex-1 min-w-0">
                  <p className="text-body-sm text-on-surface truncate">{page.title}</p>
                  <p className="text-[10px] text-on-surface-variant">{page.space}</p>
                </div>
              </div>
            ))}
            <Tooltip>
              <TooltipTrigger asChild>
                <button className="w-7 h-7 flex items-center justify-center rounded-m3-full text-on-surface-variant hover:bg-on-surface/[0.08]">
                  <Plus className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent className="text-[10px]">Link Page</TooltipContent>
            </Tooltip>
          </div>
        </TabsContent>

        <TabsContent value="library" className="flex-1 m-0 overflow-auto p-2">
          <div className="flex flex-col items-center justify-center h-full text-center p-3">
            <BookOpen className="h-6 w-6 text-on-surface-variant/30 mb-2" />
            <p className="text-body-sm text-on-surface-variant">Prompt library shortcuts</p>
            <p className="text-[10px] text-on-surface-variant/70 mt-0.5">Add frequently used prompts</p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

// Main Workbench Content Component
const MockupWorkbenchContent = ({ activeSubItem = "new-conversation" }) => {
  const [activeThread, setActiveThread] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [resourcesOpen, setResourcesOpen] = useState(true);
  const [showToolActivity, setShowToolActivity] = useState(true);

  // Determine what to show based on activeSubItem
  const getFilteredThreads = () => {
    switch (activeSubItem) {
      case "starred":
        return MOCK_THREADS.filter(t => t.starred);
      case "recent":
        return MOCK_THREADS.slice(0, 3);
      default:
        return MOCK_THREADS;
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
      <div className="flex-1 flex flex-col bg-surface overflow-hidden">
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
              <button className="w-11 h-11 flex items-center justify-center rounded-full bg-primary text-primary-foreground transition-all hover:scale-105 hover:shadow-md active:scale-95">
                <Send className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Show thread list and chat view
  return (
    <div className="flex-1 flex bg-surface overflow-hidden">
      {/* Thread Sidebar */}
      <div className="w-56 h-full flex flex-col bg-surface-container-low border-r border-outline-variant">
        {/* Sidebar Header */}
        <div className="h-14 flex items-center justify-between px-3 border-b border-outline-variant" style={{ height: "56px" }}>
          <span className="text-title-sm text-on-surface font-medium">{getTitle()}</span>
          <Tooltip>
            <TooltipTrigger asChild>
              <button className="w-7 h-7 flex items-center justify-center rounded-m3-full text-on-surface-variant hover:bg-on-surface/[0.08]">
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

            {/* Messages */}
            <div className="flex-1 overflow-auto p-3 space-y-3">
              {MOCK_MESSAGES.map(msg => (
                <ChatMessage key={msg.id} message={msg} />
              ))}
              {showToolActivity && (
                <ToolActivityIndicator tools={MOCK_TOOL_ACTIVITY} isExecuting={true} />
              )}
            </div>

            {/* Input */}
            <div className="p-3 border-t border-outline-variant">
              <div className="flex items-end gap-2">
                <div className="flex-1 min-h-10 px-3 py-2 bg-surface-container-high rounded-2xl border border-outline-variant flex items-center">
                  <span className="text-body-sm text-on-surface-variant">Type a message...</span>
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
                  <button className="w-9 h-9 flex items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <Send className="h-4 w-4" />
                  </button>
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
      {activeThread && <ResourcesPanel isOpen={resourcesOpen} onClose={() => setResourcesOpen(false)} />}
    </div>
  );
};

export default MockupWorkbenchContent;