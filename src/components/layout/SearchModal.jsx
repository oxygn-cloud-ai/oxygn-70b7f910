import React, { useState, useEffect, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, FileText, LayoutTemplate, Settings, Heart, ArrowRight, Command } from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { trackEvent } from "@/lib/posthog";

const SearchModal = ({
  isOpen,
  onClose,
  treeData = [],
  templates = [],
  onSelectPrompt,
  onSelectTemplate,
  onNavigate,
}) => {
  const [search, setSearch] = useState("");
  const searchDebounceRef = useRef(null);
  const hasTrackedOpenRef = useRef(false);

  // Track modal open and reset search
  useEffect(() => {
    if (isOpen) {
      setSearch("");
      if (!hasTrackedOpenRef.current) {
        trackEvent('search_modal_opened', { trigger: 'keyboard_or_click' });
        hasTrackedOpenRef.current = true;
      }
    } else {
      hasTrackedOpenRef.current = false;
    }
  }, [isOpen]);

  // Debounced search tracking
  useEffect(() => {
    if (!search.trim()) return;
    
    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
    }
    
    searchDebounceRef.current = setTimeout(() => {
      trackEvent('search_query_entered', { 
        query_length: search.length,
        query_preview: search.substring(0, 50)
      });
    }, 1000);
    
    return () => {
      if (searchDebounceRef.current) {
        clearTimeout(searchDebounceRef.current);
      }
    };
  }, [search]);

  // Flatten tree data for search
  const flatPrompts = useMemo(() => {
    const flatten = (items, result = []) => {
      items.forEach(item => {
        result.push(item);
        if (item.children?.length > 0) {
          flatten(item.children, result);
        }
      });
      return result;
    };
    return flatten(treeData);
  }, [treeData]);

  // Navigation items
  const navItems = [
    { id: "prompts", label: "Prompts", icon: FileText },
    { id: "templates", label: "Templates", icon: LayoutTemplate },
    { id: "settings", label: "Settings", icon: Settings },
    { id: "health", label: "Health", icon: Heart },
  ];

  const handleSelect = (type, item) => {
    // Track search selection
    trackEvent('search_result_selected', {
      result_type: type,
      item_id: type === 'nav' ? item.id : (item.row_id || item.id),
    });
    
    if (type === "prompt") {
      onSelectPrompt?.(item.row_id || item.id);
    } else if (type === "template") {
      onSelectTemplate?.(item);
    } else if (type === "nav") {
      onNavigate?.(item.id);
    }
    onClose();
  };

  return (
    <CommandDialog open={isOpen} onOpenChange={onClose}>
      <div className="flex items-center border-b border-outline-variant px-3">
        <Search className="mr-2 h-4 w-4 shrink-0 text-on-surface-variant" />
        <input
          className="flex h-11 w-full rounded-md bg-transparent py-3 text-body-sm outline-none placeholder:text-on-surface-variant disabled:cursor-not-allowed disabled:opacity-50"
          placeholder="Search prompts, templates, or navigate..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="flex items-center gap-1 text-[10px] text-on-surface-variant">
          <kbd className="px-1.5 py-0.5 rounded bg-surface-container text-[10px]">esc</kbd>
          <span>to close</span>
        </div>
      </div>
      <CommandList className="max-h-[300px]">
        <CommandEmpty className="py-6 text-center text-body-sm text-on-surface-variant">
          No results found.
        </CommandEmpty>

        {/* Navigation */}
        <CommandGroup heading="Navigate">
          {navItems.map((item) => (
            <CommandItem
              key={item.id}
              onSelect={() => handleSelect("nav", item)}
              className="flex items-center gap-3 px-3 py-2 cursor-pointer"
            >
              <item.icon className="h-4 w-4 text-on-surface-variant" />
              <span className="text-body-sm">{item.label}</span>
              <ArrowRight className="ml-auto h-3 w-3 text-on-surface-variant" />
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        {/* Prompts */}
        {flatPrompts.length > 0 && (
          <CommandGroup heading="Prompts">
            {flatPrompts.slice(0, 5).map((prompt) => (
              <CommandItem
                key={prompt.row_id || prompt.id}
                onSelect={() => handleSelect("prompt", prompt)}
                className="flex items-center gap-3 px-3 py-2 cursor-pointer"
              >
                <FileText className="h-4 w-4 text-on-surface-variant" />
                <span className="text-body-sm">{prompt.prompt_name || prompt.name || "Unnamed"}</span>
                {prompt.starred && (
                  <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded-full bg-primary/20 text-primary">
                    Starred
                  </span>
                )}
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        <CommandSeparator />

        {/* Templates */}
        {templates.length > 0 && (
          <CommandGroup heading="Templates">
            {templates.slice(0, 3).map((template) => (
              <CommandItem
                key={template.row_id || template.id}
                onSelect={() => handleSelect("template", template)}
                className="flex items-center gap-3 px-3 py-2 cursor-pointer"
              >
                <LayoutTemplate className="h-4 w-4 text-on-surface-variant" />
                <span className="text-body-sm">{template.template_name || template.schema_name || "Unnamed"}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>

      {/* Footer with keyboard hints */}
      <div className="flex items-center justify-between px-3 py-2 border-t border-outline-variant bg-surface-container-low">
        <div className="flex items-center gap-4 text-[10px] text-on-surface-variant">
          <div className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 rounded bg-surface-container">↑↓</kbd>
            <span>navigate</span>
          </div>
          <div className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 rounded bg-surface-container">↵</kbd>
            <span>select</span>
          </div>
        </div>
        <div className="flex items-center gap-1 text-[10px] text-on-surface-variant">
          <Command className="h-3 w-3" />
          <span>K to open</span>
        </div>
      </div>
    </CommandDialog>
  );
};

export default SearchModal;
