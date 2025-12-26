import React, { useState } from "react";
import { 
  FileText, 
  Bot, 
  Star, 
  Copy, 
  Trash2, 
  Download,
  Check
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const mockPrompts = [
  { 
    id: 1, 
    name: "API Documentation Generator", 
    type: "prompt", 
    preview: "Generate comprehensive API documentation from code...", 
    date: "Dec 24",
    starred: true 
  },
  { 
    id: 2, 
    name: "Customer Support Bot", 
    type: "assistant", 
    preview: "Handle customer inquiries with professional responses...", 
    date: "Dec 23",
    starred: false 
  },
  { 
    id: 3, 
    name: "Summary Generator", 
    type: "prompt", 
    preview: "Create concise summaries of long documents and articles...", 
    date: "Dec 22",
    starred: true 
  },
  { 
    id: 4, 
    name: "Code Review Assistant", 
    type: "assistant", 
    preview: "Review code for best practices, bugs, and improvements...", 
    date: "Dec 21",
    starred: false 
  },
  { 
    id: 5, 
    name: "Email Template Builder", 
    type: "prompt", 
    preview: "Create professional email templates for various purposes...", 
    date: "Dec 20",
    starred: false 
  },
  { 
    id: 6, 
    name: "Report Generator", 
    type: "prompt", 
    preview: "Generate detailed reports from raw data and metrics...", 
    date: "Dec 19",
    starred: true 
  },
];

const IconButton = ({ icon: Icon, label, onClick }) => (
  <Tooltip>
    <TooltipTrigger asChild>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onClick?.();
        }}
        className="w-7 h-7 flex items-center justify-center rounded-m3-sm text-on-surface-variant hover:bg-on-surface/[0.08] transition-colors duration-150"
        style={{ width: "28px", height: "28px" }}
      >
        <Icon className="h-[18px] w-[18px]" />
      </button>
    </TooltipTrigger>
    <TooltipContent className="text-label-sm">
      {label}
    </TooltipContent>
  </Tooltip>
);

const ListRow = ({ prompt, isSelected, onSelect, isActive, onClick }) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`
        h-10 flex items-center gap-3 px-3 cursor-pointer
        transition-colors duration-150 ease-emphasized rounded-m3-sm
        ${isActive 
          ? "bg-secondary-container" 
          : isHovered 
            ? "bg-on-surface/[0.08]" 
            : "bg-transparent"
        }
      `}
      style={{ height: "40px" }}
    >
      {/* Checkbox */}
      <div onClick={(e) => e.stopPropagation()}>
        <Checkbox 
          checked={isSelected}
          onCheckedChange={onSelect}
          className="h-[18px] w-[18px] border-on-surface-variant data-[state=checked]:bg-primary data-[state=checked]:border-primary"
        />
      </div>

      {/* Icon */}
      {prompt.type === "assistant" ? (
        <Bot className="h-5 w-5 text-primary flex-shrink-0" />
      ) : (
        <FileText className="h-5 w-5 text-on-surface-variant flex-shrink-0" />
      )}

      {/* Name - 12px */}
      <span 
        className={`
          w-44 truncate text-body-sm font-medium
          ${isActive ? "text-secondary-container-foreground" : "text-on-surface"}
        `}
        style={{ fontSize: "12px" }}
      >
        {prompt.name}
      </span>

      {/* Preview - 11px */}
      <span 
        className="flex-1 truncate text-label-md text-on-surface-variant"
        style={{ fontSize: "11px" }}
      >
        {prompt.preview}
      </span>

      {/* Hover Actions or Date */}
      <div className="flex items-center gap-1 w-24 justify-end">
        {isHovered ? (
          <>
            <IconButton 
              icon={prompt.starred ? Star : Star} 
              label={prompt.starred ? "Unstar" : "Star"} 
            />
            <IconButton icon={Copy} label="Duplicate" />
            <IconButton icon={Download} label="Export" />
            <IconButton icon={Trash2} label="Delete" />
          </>
        ) : (
          <>
            {prompt.starred && (
              <Star className="h-4 w-4 text-primary fill-primary" />
            )}
            <span 
              className="text-label-sm text-on-surface-variant"
              style={{ fontSize: "10px" }}
            >
              {prompt.date}
            </span>
          </>
        )}
      </div>
    </div>
  );
};

const MockupListView = ({ onSelectPrompt, activePromptId }) => {
  const [selectedIds, setSelectedIds] = useState(new Set());

  const toggleSelection = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  return (
    <div className="flex-1 flex flex-col bg-surface overflow-hidden">
      {/* Bulk Actions Bar */}
      {selectedIds.size > 0 && (
        <div className="h-10 flex items-center gap-3 px-4 bg-surface-container-high border-b border-outline-variant">
          <Checkbox 
            checked={selectedIds.size === mockPrompts.length}
            onCheckedChange={(checked) => {
              if (checked) {
                setSelectedIds(new Set(mockPrompts.map(p => p.id)));
              } else {
                setSelectedIds(new Set());
              }
            }}
            className="h-[18px] w-[18px]"
          />
          <span className="text-label-md text-on-surface">
            {selectedIds.size} selected
          </span>
          <div className="flex-1" />
          <IconButton icon={Star} label="Star selected" />
          <IconButton icon={Download} label="Export selected" />
          <IconButton icon={Trash2} label="Delete selected" />
        </div>
      )}

      {/* List */}
      <div className="flex-1 overflow-auto p-2 scrollbar-thin">
        <div className="flex flex-col gap-0.5">
          {mockPrompts.map((prompt) => (
            <ListRow
              key={prompt.id}
              prompt={prompt}
              isSelected={selectedIds.has(prompt.id)}
              onSelect={() => toggleSelection(prompt.id)}
              isActive={activePromptId === prompt.id}
              onClick={() => onSelectPrompt?.(prompt.id)}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default MockupListView;
