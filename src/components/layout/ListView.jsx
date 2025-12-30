import React, { useState, useMemo } from "react";
import { 
  FileText, 
  MessageSquare, 
  Star, 
  Copy, 
  Trash2, 
  Download,
  Play,
  Braces,
  Plus,
  Upload,
  Ban,
  FileX
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

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

const ListRow = ({ prompt, isSelected, onSelect, isActive, onClick, onToggleStar, onDelete }) => {
  const [isHovered, setIsHovered] = useState(false);
  
  // Get owner initials from owner_id or fallback
  const getOwnerInitials = () => {
    if (prompt.owner?.initials) return prompt.owner.initials;
    // Generate from prompt name if no owner
    const name = prompt.prompt_name || prompt.name || "?";
    return name.slice(0, 2).toUpperCase();
  };

  const getOwnerColor = () => {
    if (prompt.owner?.color) return prompt.owner.color;
    // Generate color based on owner_id hash
    const colors = ["bg-blue-500", "bg-purple-500", "bg-green-500", "bg-orange-500", "bg-pink-500"];
    const hash = (prompt.owner_id || prompt.row_id || "").charCodeAt(0) || 0;
    return colors[hash % colors.length];
  };

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
      {prompt.is_assistant ? (
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
        {prompt.prompt_name || prompt.name || "Unnamed"}
      </span>

      {/* Preview */}
      <span className="flex-1 truncate text-tree text-on-surface-variant">
        {prompt.input_admin_prompt?.slice(0, 80) || prompt.preview || "No description"}
      </span>

      {/* Hover Actions or Owner + Status */}
      <div className="flex items-center gap-0.5 justify-end">
        {isHovered ? (
          <>
            <IconButton 
              icon={Star} 
              label={prompt.starred ? "Unstar" : "Star"} 
              className={prompt.starred ? "text-primary" : ""}
              onClick={() => onToggleStar?.(prompt.row_id)}
            />
            <IconButton icon={Play} label="Play" />
            <IconButton icon={Braces} label="Copy Variable Reference" />
            <IconButton icon={Plus} label="Add Child" />
            <IconButton icon={Copy} label="Duplicate" />
            <IconButton icon={Upload} label="Export" />
            <IconButton 
              icon={Ban} 
              label={prompt.exclude_from_cascade ? "Include in Cascade" : "Exclude from Cascade"} 
              className={prompt.exclude_from_cascade ? "text-muted-foreground" : ""}
            />
            <IconButton 
              icon={FileX} 
              label={prompt.exclude_from_export ? "Include in Export" : "Exclude from Export"} 
              className={prompt.exclude_from_export ? "text-orange-500" : ""}
            />
            <IconButton 
              icon={Trash2} 
              label="Delete" 
              onClick={() => onDelete?.(prompt.row_id)}
            />
          </>
        ) : (
          <>
            {prompt.starred && (
              <Star className="h-4 w-4 text-primary fill-primary flex-shrink-0" />
            )}
            {prompt.exclude_from_cascade && (
              <Tooltip>
                <TooltipTrigger>
                  <Ban className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                </TooltipTrigger>
                <TooltipContent className="text-label-sm">Excluded from Cascade</TooltipContent>
              </Tooltip>
            )}
            {prompt.exclude_from_export && (
              <Tooltip>
                <TooltipTrigger>
                  <FileX className="h-4 w-4 text-orange-500 flex-shrink-0" />
                </TooltipTrigger>
                <TooltipContent className="text-label-sm">Excluded from Export</TooltipContent>
              </Tooltip>
            )}
            <OwnerAvatar initials={getOwnerInitials()} color={getOwnerColor()} />
          </>
        )}
      </div>
    </div>
  );
};

const ListView = ({ 
  onSelectPrompt, 
  activePromptId,
  treeData = [],
  onToggleStar,
  onDelete
}) => {
  const [selectedIds, setSelectedIds] = useState(new Set());

  // Flatten tree data for list view
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
            checked={selectedIds.size === flatPrompts.length}
            onCheckedChange={(checked) => {
              if (checked) {
                setSelectedIds(new Set(flatPrompts.map(p => p.row_id)));
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
        {flatPrompts.length === 0 ? (
          <div className="flex items-center justify-center h-full text-on-surface-variant">
            <div className="text-center">
              <FileText className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p className="text-body-sm">No prompts found</p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-0.5">
            {flatPrompts.map((prompt) => (
              <ListRow
                key={prompt.row_id}
                prompt={prompt}
                isSelected={selectedIds.has(prompt.row_id)}
                onSelect={() => toggleSelection(prompt.row_id)}
                isActive={activePromptId === prompt.row_id}
                onClick={() => onSelectPrompt?.(prompt.row_id)}
                onToggleStar={onToggleStar}
                onDelete={onDelete}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ListView;