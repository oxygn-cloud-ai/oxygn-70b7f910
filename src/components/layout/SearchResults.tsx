/**
 * SearchResults Component (TypeScript)
 * 
 * Displays filtered search results for prompts, templates, and conversations.
 */

import React, { useMemo, ReactNode } from "react";
import { 
  FileText, 
  MessageSquare, 
  Layout, 
  Star,
  ArrowRight,
  X
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

// ============================================================================
// Types
// ============================================================================

interface PromptItem {
  row_id: string;
  prompt_name?: string;
  name?: string;
  starred?: boolean;
  input_admin_prompt?: string;
  children?: PromptItem[];
}

interface TemplateItem {
  row_id: string;
  template_name?: string;
  schema_name?: string;
  category?: string;
}

interface ThreadItem {
  row_id: string;
  title?: string;
  name?: string;
  updated_at?: string;
}

interface SearchResultSelection {
  type: 'prompt' | 'template' | 'thread';
  item: PromptItem | TemplateItem | ThreadItem;
}

export interface SearchResultsProps {
  isOpen?: boolean;
  searchQuery?: string;
  onClose?: () => void;
  onSelectResult?: (selection: SearchResultSelection) => void;
  treeData?: PromptItem[];
  templates?: TemplateItem[];
  threads?: ThreadItem[];
}

// ============================================================================
// Helper Functions
// ============================================================================

const getCategoryColor = (category: string): string => {
  const colors: Record<string, string> = {
    Support: "bg-tertiary-container text-on-tertiary-container",
    Onboarding: "bg-secondary-container text-on-secondary-container",
    Analysis: "bg-primary-container text-on-primary-container",
    Email: "bg-surface-container-highest text-on-surface-variant",
    Survey: "bg-secondary-container text-on-secondary-container"
  };
  return colors[category] || "bg-surface-container-high text-on-surface-variant";
};

const highlightMatch = (text: string | undefined | null, query: string): ReactNode => {
  if (!query || !text) return text || '';
  const regex = new RegExp(`(${query})`, 'gi');
  const parts = String(text).split(regex);
  return parts.map((part, i) => 
    regex.test(part) ? (
      <span key={i} className="bg-primary/20 text-primary font-medium">{part}</span>
    ) : part
  );
};

// ============================================================================
// SearchResults Component
// ============================================================================

const SearchResults: React.FC<SearchResultsProps> = ({ 
  isOpen = true, 
  searchQuery = "", 
  onClose,
  onSelectResult,
  treeData = [],
  templates = [],
  threads = []
}) => {
  // Flatten tree data for search
  const flatPrompts = useMemo(() => {
    const flatten = (items: PromptItem[], result: PromptItem[] = []): PromptItem[] => {
      items.forEach(item => {
        result.push(item);
        if (item.children?.length) {
          flatten(item.children, result);
        }
      });
      return result;
    };
    return flatten(treeData);
  }, [treeData]);

  // Filter results based on search query
  const filteredResults = useMemo(() => {
    const query = searchQuery.toLowerCase();
    if (!query) {
      return {
        prompts: flatPrompts.slice(0, 5),
        templates: templates.slice(0, 3),
        conversations: threads.slice(0, 3)
      };
    }
    
    return {
      prompts: flatPrompts.filter(p => 
        (p.prompt_name || '').toLowerCase().includes(query) ||
        (p.input_admin_prompt || '').toLowerCase().includes(query)
      ).slice(0, 5),
      templates: templates.filter(t => 
        (t.template_name || t.schema_name || '').toLowerCase().includes(query)
      ).slice(0, 3),
      conversations: threads.filter(t => 
        (t.title || t.name || '').toLowerCase().includes(query)
      ).slice(0, 3)
    };
  }, [searchQuery, flatPrompts, templates, threads]);

  if (!isOpen) return null;

  const totalResults = filteredResults.prompts.length + filteredResults.templates.length + filteredResults.conversations.length;

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

      {/* Search Results */}
      <div className="max-h-80 overflow-y-auto">
        {/* Prompts Section */}
        {filteredResults.prompts.length > 0 && (
          <div className="p-2">
            <div className="flex items-center justify-between px-2 mb-1">
              <span className="text-label-sm text-on-surface-variant">Prompts</span>
              <span className="text-[10px] text-on-surface-variant">{filteredResults.prompts.length} results</span>
            </div>
            {filteredResults.prompts.map((prompt) => (
              <button
                key={prompt.row_id}
                onClick={() => onSelectResult?.({ type: 'prompt', item: prompt })}
                className="w-full flex items-center gap-2 px-2 py-2 rounded-m3-sm hover:bg-on-surface/[0.08] transition-colors group"
              >
                <div className="w-8 h-8 flex items-center justify-center rounded-m3-sm bg-primary-container">
                  <FileText className="h-4 w-4 text-on-primary-container" />
                </div>
                <div className="flex-1 text-left">
                  <div className="flex items-center gap-1.5">
                    <span className="text-body-sm text-on-surface">
                      {highlightMatch(prompt.prompt_name || 'Unnamed', searchQuery)}
                    </span>
                    {prompt.starred && <Star className="h-3 w-3 text-amber-500 fill-amber-500" />}
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-on-surface-variant opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
            ))}
          </div>
        )}

        {/* Templates Section */}
        {filteredResults.templates.length > 0 && (
          <div className="p-2 border-t border-outline-variant">
            <div className="flex items-center justify-between px-2 mb-1">
              <span className="text-label-sm text-on-surface-variant">Templates</span>
              <span className="text-[10px] text-on-surface-variant">{filteredResults.templates.length} results</span>
            </div>
            {filteredResults.templates.map((template) => (
              <button
                key={template.row_id}
                onClick={() => onSelectResult?.({ type: 'template', item: template })}
                className="w-full flex items-center gap-2 px-2 py-2 rounded-m3-sm hover:bg-on-surface/[0.08] transition-colors group"
              >
                <div className="w-8 h-8 flex items-center justify-center rounded-m3-sm bg-secondary-container">
                  <Layout className="h-4 w-4 text-on-secondary-container" />
                </div>
                <div className="flex-1 text-left">
                  <span className="text-body-sm text-on-surface">
                    {highlightMatch(template.template_name || template.schema_name || 'Unnamed', searchQuery)}
                  </span>
                  {template.category && (
                    <span className={`ml-1.5 text-[10px] px-1 py-0.5 rounded ${getCategoryColor(template.category)}`}>
                      {template.category}
                    </span>
                  )}
                </div>
                <ArrowRight className="h-4 w-4 text-on-surface-variant opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
            ))}
          </div>
        )}

        {/* Conversations Section */}
        {filteredResults.conversations.length > 0 && (
          <div className="p-2 border-t border-outline-variant">
            <div className="flex items-center justify-between px-2 mb-1">
              <span className="text-label-sm text-on-surface-variant">Threads</span>
              <span className="text-[10px] text-on-surface-variant">{filteredResults.conversations.length} results</span>
            </div>
            {filteredResults.conversations.map((thread) => (
              <button
                key={thread.row_id}
                onClick={() => onSelectResult?.({ type: 'thread', item: thread })}
                className="w-full flex items-center gap-2 px-2 py-2 rounded-m3-sm hover:bg-on-surface/[0.08] transition-colors group"
              >
                <div className="w-8 h-8 flex items-center justify-center rounded-m3-sm bg-tertiary-container">
                  <MessageSquare className="h-4 w-4 text-on-tertiary-container" />
                </div>
                <div className="flex-1 text-left">
                  <span className="text-body-sm text-on-surface">
                    {highlightMatch(thread.title || thread.name || 'Untitled', searchQuery)}
                  </span>
                  <span className="ml-1.5 text-[10px] text-on-surface-variant">
                    {thread.updated_at ? new Date(thread.updated_at).toLocaleDateString() : ''}
                  </span>
                </div>
                <ArrowRight className="h-4 w-4 text-on-surface-variant opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
            ))}
          </div>
        )}

        {/* Empty state */}
        {totalResults === 0 && searchQuery && (
          <div className="p-8 text-center">
            <p className="text-body-sm text-on-surface-variant">No results found for "{searchQuery}"</p>
          </div>
        )}
      </div>

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
          {totalResults} total results
        </span>
      </div>
    </div>
  );
};

export default SearchResults;
