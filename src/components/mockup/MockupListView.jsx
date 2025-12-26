import React, { useState } from "react";
import { 
  FileText, 
  MessageSquare, 
  Star, 
  Copy, 
  Trash2, 
  Download,
  Sparkles,
  Link2,
  Plus,
  Upload,
  Ban,
  FileX
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const mockPrompts = [
  { 
    id: 1, 
    name: "API Documentation Generator", 
    type: "prompt", 
    preview: "Generate comprehensive API documentation from code...", 
    owner: { initials: "JD", color: "bg-blue-500" },
    starred: true,
    excludedFromCascade: false,
    excludedFromExport: false
  },
  { 
    id: 2, 
    name: "Customer Support Bot", 
    type: "conversation", 
    preview: "Handle customer inquiries with professional responses...", 
    owner: { initials: "AM", color: "bg-purple-500" },
    starred: false,
    excludedFromCascade: true,
    excludedFromExport: false
  },
  { 
    id: 3, 
    name: "Summary Generator", 
    type: "prompt", 
    preview: "Create concise summaries of long documents and articles...", 
    owner: { initials: "JD", color: "bg-blue-500" },
    starred: true,
    excludedFromCascade: false,
    excludedFromExport: true
  },
  { 
    id: 4, 
    name: "Code Review Assistant", 
    type: "conversation", 
    preview: "Review code for best practices, bugs, and improvements...", 
    owner: { initials: "KL", color: "bg-green-500" },
    starred: false,
    excludedFromCascade: true,
    excludedFromExport: true
  },
  { 
    id: 5, 
    name: "Email Template Builder", 
    type: "prompt", 
    preview: "Create professional email templates for various purposes...", 
    owner: { initials: "AM", color: "bg-purple-500" },
    starred: false,
    excludedFromCascade: false,
    excludedFromExport: false
  },
  { 
    id: 6, 
    name: "Report Generator", 
    type: "prompt", 
    preview: "Generate detailed reports from raw data and metrics...", 
    owner: { initials: "JD", color: "bg-blue-500" },
    starred: true,
    excludedFromCascade: false,
    excludedFromExport: false
  },
];

const IconButton = ({ icon: Icon, label, onClick, className = "" }) => (
  <Tooltip>
    <TooltipTrigger asChild>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onClick?.();
        }}
        className={`w-6 h-6 flex items-center justify-center rounded-m3-sm text-on-surface-variant hover:bg-on-surface/[0.08] transition-colors duration-150 ${className}`}
        style={{ width: "24px", height: "24px" }}
      >
        <Icon className="h-4 w-4" />
      </button>
    </TooltipTrigger>
    <TooltipContent className="text-label-sm">
      {label}
    </TooltipContent>
  </Tooltip>
);

const OwnerAvatar = ({ initials, color }) => (
  <div 
    className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-medium ${color}`}
    style={{ width: "24px", height: "24px" }}
  >
    {initials}
  </div>
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
      {prompt.type === "conversation" ? (
        <MessageSquare className="h-5 w-5 text-primary flex-shrink-0" />
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

      {/* Hover Actions or Owner + Status */}
      <div className="flex items-center gap-0.5 justify-end">
        {isHovered ? (
          <>
            <IconButton 
              icon={Star} 
              label={prompt.starred ? "Unstar" : "Star"} 
              className={prompt.starred ? "text-primary" : ""}
            />
            <IconButton icon={Sparkles} label="Run" />
            <IconButton icon={Link2} label="Copy Variable Reference" />
            <IconButton icon={Plus} label="Add Child" />
            <IconButton icon={Copy} label="Duplicate" />
            <IconButton icon={Upload} label="Export" />
            <IconButton 
              icon={Ban} 
              label={prompt.excludedFromCascade ? "Include in Cascade" : "Exclude from Cascade"} 
              className={prompt.excludedFromCascade ? "text-muted-foreground" : ""}
            />
            <IconButton 
              icon={FileX} 
              label={prompt.excludedFromExport ? "Include in Export" : "Exclude from Export"} 
              className={prompt.excludedFromExport ? "text-orange-500" : ""}
            />
            <IconButton icon={Trash2} label="Delete" />
          </>
        ) : (
          <>
            {prompt.starred && (
              <Star className="h-4 w-4 text-primary fill-primary flex-shrink-0" />
            )}
            {prompt.excludedFromCascade && (
              <Tooltip>
                <TooltipTrigger>
                  <Ban className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                </TooltipTrigger>
                <TooltipContent className="text-label-sm">Excluded from Cascade</TooltipContent>
              </Tooltip>
            )}
            {prompt.excludedFromExport && (
              <Tooltip>
                <TooltipTrigger>
                  <FileX className="h-4 w-4 text-orange-500 flex-shrink-0" />
                </TooltipTrigger>
                <TooltipContent className="text-label-sm">Excluded from Export</TooltipContent>
              </Tooltip>
            )}
            <OwnerAvatar initials={prompt.owner.initials} color={prompt.owner.color} />
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
