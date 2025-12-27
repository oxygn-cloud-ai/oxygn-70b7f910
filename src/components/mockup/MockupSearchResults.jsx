import React from "react";
import { 
  FileText, 
  FolderOpen, 
  MessageSquare, 
  Layout, 
  Star,
  Clock,
  ArrowRight,
  X
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const MockupSearchResults = ({ 
  isOpen = true, 
  searchQuery = "customer", 
  onClose,
  onSelectResult 
}) => {
  // Mock search results data
  const recentSearches = [
    "customer support",
    "email template",
    "API documentation"
  ];

  const results = {
    prompts: [
      { id: 1, name: "Customer Support Bot", category: "Support", starred: true },
      { id: 2, name: "Customer Onboarding Flow", category: "Onboarding", starred: false },
      { id: 3, name: "Customer Feedback Analysis", category: "Analysis", starred: true }
    ],
    templates: [
      { id: 1, name: "Customer Email Response", category: "Email" },
      { id: 2, name: "Customer Survey Template", category: "Survey" }
    ],
    conversations: [
      { id: 1, name: "Customer inquiry about pricing", date: "2 hours ago" },
      { id: 2, name: "Customer feature request discussion", date: "Yesterday" }
    ]
  };

  const getCategoryColor = (category) => {
    const colors = {
      Support: "bg-tertiary-container text-on-tertiary-container",
      Onboarding: "bg-secondary-container text-on-secondary-container",
      Analysis: "bg-primary-container text-on-primary-container",
      Email: "bg-surface-container-highest text-on-surface-variant",
      Survey: "bg-secondary-container text-on-secondary-container"
    };
    return colors[category] || "bg-surface-container-high text-on-surface-variant";
  };

  const highlightMatch = (text, query) => {
    if (!query) return text;
    const regex = new RegExp(`(${query})`, 'gi');
    const parts = text.split(regex);
    return parts.map((part, i) => 
      regex.test(part) ? (
        <span key={i} className="bg-primary/20 text-primary font-medium">{part}</span>
      ) : part
    );
  };

  if (!isOpen) return null;

  return (
    <div 
      className="absolute top-14 left-1/2 -translate-x-1/2 w-full max-w-xl bg-surface-container rounded-m3-lg shadow-elevation-3 border border-outline-variant overflow-hidden z-50"
      style={{ borderRadius: "16px" }}
    >
      {/* Search Input */}
      <div className="flex items-center gap-2 p-3 border-b border-outline-variant">
        <input
          type="text"
          value={searchQuery}
          readOnly
          className="flex-1 bg-transparent text-body-md text-on-surface placeholder:text-on-surface-variant focus:outline-none"
          placeholder="Search prompts, templates..."
        />
        <Tooltip>
          <TooltipTrigger asChild>
            <button 
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-m3-full text-on-surface-variant hover:bg-on-surface/[0.08] transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent className="text-[10px]">Close</TooltipContent>
        </Tooltip>
      </div>

      {/* Recent Searches */}
      {!searchQuery && (
        <div className="p-2">
          <span className="px-2 text-label-sm text-on-surface-variant">Recent</span>
          <div className="mt-1">
            {recentSearches.map((search, idx) => (
              <button
                key={idx}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-m3-sm hover:bg-on-surface/[0.08] transition-colors"
              >
                <Clock className="h-3.5 w-3.5 text-on-surface-variant" />
                <span className="text-body-sm text-on-surface">{search}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Search Results */}
      {searchQuery && (
        <div className="max-h-80 overflow-y-auto">
          {/* Prompts Section */}
          <div className="p-2">
            <div className="flex items-center justify-between px-2 mb-1">
              <span className="text-label-sm text-on-surface-variant">Prompts</span>
              <span className="text-[10px] text-on-surface-variant">{results.prompts.length} results</span>
            </div>
            {results.prompts.map((prompt) => (
              <button
                key={prompt.id}
                onClick={() => onSelectResult?.(prompt)}
                className="w-full flex items-center gap-2 px-2 py-2 rounded-m3-sm hover:bg-on-surface/[0.08] transition-colors group"
              >
                <div className="w-8 h-8 flex items-center justify-center rounded-m3-sm bg-primary-container">
                  <FileText className="h-4 w-4 text-on-primary-container" />
                </div>
                <div className="flex-1 text-left">
                  <div className="flex items-center gap-1.5">
                    <span className="text-body-sm text-on-surface">
                      {highlightMatch(prompt.name, searchQuery)}
                    </span>
                    {prompt.starred && <Star className="h-3 w-3 text-amber-500 fill-amber-500" />}
                  </div>
                  <span className={`text-[10px] px-1 py-0.5 rounded ${getCategoryColor(prompt.category)}`}>
                    {prompt.category}
                  </span>
                </div>
                <ArrowRight className="h-4 w-4 text-on-surface-variant opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
            ))}
          </div>

          {/* Templates Section */}
          <div className="p-2 border-t border-outline-variant">
            <div className="flex items-center justify-between px-2 mb-1">
              <span className="text-label-sm text-on-surface-variant">Templates</span>
              <span className="text-[10px] text-on-surface-variant">{results.templates.length} results</span>
            </div>
            {results.templates.map((template) => (
              <button
                key={template.id}
                onClick={() => onSelectResult?.(template)}
                className="w-full flex items-center gap-2 px-2 py-2 rounded-m3-sm hover:bg-on-surface/[0.08] transition-colors group"
              >
                <div className="w-8 h-8 flex items-center justify-center rounded-m3-sm bg-secondary-container">
                  <Layout className="h-4 w-4 text-on-secondary-container" />
                </div>
                <div className="flex-1 text-left">
                  <span className="text-body-sm text-on-surface">
                    {highlightMatch(template.name, searchQuery)}
                  </span>
                  <span className={`ml-1.5 text-[10px] px-1 py-0.5 rounded ${getCategoryColor(template.category)}`}>
                    {template.category}
                  </span>
                </div>
                <ArrowRight className="h-4 w-4 text-on-surface-variant opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
            ))}
          </div>

          {/* Conversations Section */}
          <div className="p-2 border-t border-outline-variant">
            <div className="flex items-center justify-between px-2 mb-1">
              <span className="text-label-sm text-on-surface-variant">Conversations</span>
              <span className="text-[10px] text-on-surface-variant">{results.conversations.length} results</span>
            </div>
            {results.conversations.map((convo) => (
              <button
                key={convo.id}
                onClick={() => onSelectResult?.(convo)}
                className="w-full flex items-center gap-2 px-2 py-2 rounded-m3-sm hover:bg-on-surface/[0.08] transition-colors group"
              >
                <div className="w-8 h-8 flex items-center justify-center rounded-m3-sm bg-tertiary-container">
                  <MessageSquare className="h-4 w-4 text-on-tertiary-container" />
                </div>
                <div className="flex-1 text-left">
                  <span className="text-body-sm text-on-surface">
                    {highlightMatch(convo.name, searchQuery)}
                  </span>
                  <span className="ml-1.5 text-[10px] text-on-surface-variant">
                    {convo.date}
                  </span>
                </div>
                <ArrowRight className="h-4 w-4 text-on-surface-variant opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between p-2 border-t border-outline-variant bg-surface-container-low">
        <div className="flex items-center gap-3 text-[10px] text-on-surface-variant">
          <span className="flex items-center gap-1">
            <kbd className="px-1 py-0.5 bg-surface-container-high rounded text-[9px]">↑↓</kbd>
            Navigate
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1 py-0.5 bg-surface-container-high rounded text-[9px]">↵</kbd>
            Select
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1 py-0.5 bg-surface-container-high rounded text-[9px]">esc</kbd>
            Close
          </span>
        </div>
        <span className="text-[10px] text-on-surface-variant">
          {results.prompts.length + results.templates.length + results.conversations.length} total results
        </span>
      </div>
    </div>
  );
};

export default MockupSearchResults;
