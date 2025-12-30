import React from "react";
import { 
  MessageSquare, FileText, LayoutTemplate, FolderOpen, 
  Search, Inbox, Star, Clock, Settings, Variable,
  Link2, Sparkles, Plus, Zap
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

// Base empty state wrapper with entrance animation
const EmptyStateWrapper = ({ children, className = "" }) => (
  <div className={`flex flex-col items-center justify-center text-center p-6 animate-fade-in ${className}`}>
    {children}
  </div>
);

// Icon wrapper with subtle animation
const EmptyStateIcon = ({ icon: Icon, size = "lg" }) => {
  const sizes = {
    sm: "h-8 w-8",
    md: "h-10 w-10",
    lg: "h-12 w-12",
    xl: "h-16 w-16"
  };
  return (
    <div className="relative mb-3">
      <Icon className={`${sizes[size]} text-on-surface-variant/30`} />
      <div className="absolute inset-0 bg-primary/5 blur-xl rounded-full" />
    </div>
  );
};

// Generic empty state
export const EmptyState = ({ 
  icon: Icon = Inbox, 
  title, 
  description, 
  action,
  actionLabel = "Get Started",
  size = "lg"
}) => (
  <EmptyStateWrapper>
    <EmptyStateIcon icon={Icon} size={size} />
    <h3 className="text-title-sm text-on-surface font-medium mb-1">{title}</h3>
    <p className="text-body-sm text-on-surface-variant max-w-xs">{description}</p>
    {action && (
      <button 
        onClick={action}
        className="mt-4 px-4 h-9 flex items-center gap-2 bg-primary text-primary-foreground rounded-m3-full text-body-sm font-medium hover:bg-primary/90 transition-colors"
      >
        <Plus className="h-4 w-4" />
        {actionLabel}
      </button>
    )}
  </EmptyStateWrapper>
);

// No prompts selected
export const EmptyPromptSelection = () => (
  <EmptyState
    icon={FileText}
    title="Select a Prompt"
    description="Choose a prompt from the sidebar to view and edit its content"
  />
);

// No threads
export const EmptyThreads = ({ onNewThread }) => (
  <EmptyState
    icon={MessageSquare}
    title="No Conversations Yet"
    description="Start a new conversation to chat with AI assistants"
    action={onNewThread}
    actionLabel="New Conversation"
  />
);

// No search results
export const EmptySearchResults = ({ query }) => (
  <EmptyStateWrapper>
    <EmptyStateIcon icon={Search} size="md" />
    <h3 className="text-title-sm text-on-surface font-medium mb-1">No Results Found</h3>
    <p className="text-body-sm text-on-surface-variant max-w-xs">
      No matches for "<span className="text-on-surface font-medium">{query}</span>"
    </p>
    <p className="text-[10px] text-on-surface-variant/70 mt-1">Try different keywords</p>
  </EmptyStateWrapper>
);

// No starred items
export const EmptyStarred = () => (
  <EmptyState
    icon={Star}
    title="No Starred Items"
    description="Star your favorite prompts and threads for quick access"
    size="md"
  />
);

// No recent activity
export const EmptyRecent = () => (
  <EmptyState
    icon={Clock}
    title="No Recent Activity"
    description="Your recently accessed items will appear here"
    size="md"
  />
);

// No templates
export const EmptyTemplates = ({ onCreateTemplate }) => (
  <EmptyState
    icon={LayoutTemplate}
    title="No Templates"
    description="Create reusable templates to speed up your workflow"
    action={onCreateTemplate}
    actionLabel="Create Template"
  />
);

// No variables
export const EmptyVariables = ({ onAddVariable }) => (
  <EmptyStateWrapper className="py-8">
    <EmptyStateIcon icon={Variable} size="md" />
    <h3 className="text-body-sm text-on-surface font-medium mb-1">No Variables Detected</h3>
    <p className="text-[10px] text-on-surface-variant max-w-xs">
      Use {"{{variable_name}}"} syntax in your prompts to create variables
    </p>
    {onAddVariable && (
      <Tooltip>
        <TooltipTrigger asChild>
          <button 
            onClick={onAddVariable}
            className="mt-3 w-8 h-8 flex items-center justify-center rounded-m3-full text-on-surface-variant hover:bg-on-surface/[0.08] transition-colors"
          >
            <Plus className="h-4 w-4" />
          </button>
        </TooltipTrigger>
        <TooltipContent className="text-[10px]">Add Variable</TooltipContent>
      </Tooltip>
    )}
  </EmptyStateWrapper>
);

// No linked pages
export const EmptyLinkedPages = ({ onLinkPage }) => (
  <EmptyStateWrapper className="py-6">
    <EmptyStateIcon icon={Link2} size="sm" />
    <h3 className="text-body-sm text-on-surface font-medium mb-0.5">No Linked Pages</h3>
    <p className="text-[10px] text-on-surface-variant">Connect Confluence pages as context</p>
    {onLinkPage && (
      <Tooltip>
        <TooltipTrigger asChild>
          <button 
            onClick={onLinkPage}
            className="mt-2 w-7 h-7 flex items-center justify-center rounded-m3-full text-on-surface-variant hover:bg-on-surface/[0.08] transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent className="text-[10px]">Link Page</TooltipContent>
      </Tooltip>
    )}
  </EmptyStateWrapper>
);

// Empty folder
export const EmptyFolder = ({ folderName = "folder" }) => (
  <EmptyStateWrapper className="py-10">
    <EmptyStateIcon icon={FolderOpen} size="md" />
    <h3 className="text-body-sm text-on-surface font-medium mb-1">Empty {folderName}</h3>
    <p className="text-[10px] text-on-surface-variant">Add prompts or create subfolders</p>
  </EmptyStateWrapper>
);

// Conversation disabled (assistant mode off)
export const EmptyConversation = ({ onEnableAssistant }) => (
  <EmptyStateWrapper className="h-full">
    <EmptyStateIcon icon={MessageSquare} />
    <h3 className="text-title-sm text-on-surface font-medium mb-1">Enable Assistant Mode</h3>
    <p className="text-body-sm text-on-surface-variant max-w-xs">
      Turn on Assistant Mode to use conversations with memory
    </p>
    {onEnableAssistant && (
      <button 
        onClick={onEnableAssistant}
        className="mt-4 px-4 h-9 flex items-center gap-2 bg-secondary-container text-secondary-container-foreground rounded-m3-full text-body-sm font-medium hover:bg-secondary-container/80 transition-colors"
      >
        <Zap className="h-4 w-4" />
        Enable Assistant Mode
      </button>
    )}
  </EmptyStateWrapper>
);

// New chat welcome
export const WelcomeChat = () => (
  <EmptyStateWrapper className="h-full">
    <div className="relative mb-4">
      <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
        <Sparkles className="h-8 w-8 text-primary" />
      </div>
      <div className="absolute -inset-2 bg-primary/5 blur-2xl rounded-full -z-10" />
    </div>
    <h3 className="text-title-sm text-on-surface font-medium mb-2">Start a Conversation</h3>
    <p className="text-body-sm text-on-surface-variant max-w-sm mb-4">
      Chat with AI, attach files, link pages, and use your prompt library
    </p>
    <div className="flex flex-wrap gap-2 justify-center">
      {["Analyze data", "Draft content", "Code review", "Brainstorm"].map(suggestion => (
        <button 
          key={suggestion}
          className="px-3 py-1.5 text-tree bg-surface-container-low border border-outline-variant rounded-m3-full text-on-surface-variant hover:bg-surface-container hover:text-on-surface transition-colors"
        >
          {suggestion}
        </button>
      ))}
    </div>
  </EmptyStateWrapper>
);

// No output yet
export const EmptyOutput = () => (
  <div className="flex items-center justify-center py-8 text-center animate-fade-in">
    <div>
      <Zap className="h-6 w-6 mx-auto mb-2 text-on-surface-variant/30" />
      <p className="text-body-sm text-on-surface-variant italic">Run the prompt to see output...</p>
    </div>
  </div>
);

export default {
  EmptyState,
  EmptyPromptSelection,
  EmptyThreads,
  EmptySearchResults,
  EmptyStarred,
  EmptyRecent,
  EmptyTemplates,
  EmptyVariables,
  EmptyLinkedPages,
  EmptyFolder,
  EmptyConversation,
  WelcomeChat,
  EmptyOutput,
};
