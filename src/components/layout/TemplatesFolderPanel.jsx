import React, { useState, useRef, useMemo } from "react";
import { 
  LayoutTemplate, 
  Star, 
  Clock, 
  ChevronRight, 
  ChevronDown, 
  FileText,
  Braces,
  Link2,
  Plus,
  Copy,
  Trash2,
  Upload,
  GripVertical,
  Loader2
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useDrag, useDrop } from "react-dnd";
import { LabelBadge } from "@/components/ui/label-badge";

const ITEM_TYPE = "TEMPLATE_ITEM";

const SmartFolder = ({ icon: Icon, label, count, isActive = false, onClick }) => (
  <button
    onClick={onClick}
    className={`
      w-full h-8 flex items-center gap-3 px-3 rounded-m3-sm
      transition-colors duration-150 ease-emphasized
      ${isActive 
        ? "bg-secondary-container text-secondary-container-foreground" 
        : "text-on-surface-variant hover:bg-on-surface/[0.08]"
      }
    `}
    style={{ height: "32px" }}
  >
    <Icon className="h-5 w-5 flex-shrink-0" />
    <span className="flex-1 text-left text-label-lg truncate">{label}</span>
    <span className="text-label-sm">{count}</span>
  </button>
);

const IconButton = ({ icon: Icon, label, className = "", onClick }) => (
  <Tooltip>
    <TooltipTrigger asChild>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onClick?.();
        }}
        className={`w-5 h-5 flex items-center justify-center rounded-sm text-on-surface-variant hover:bg-on-surface/[0.12] ${className}`}
      >
        <Icon className="h-3.5 w-3.5" />
      </button>
    </TooltipTrigger>
    <TooltipContent className="text-[10px]">{label}</TooltipContent>
  </Tooltip>
);

const TemplateTreeItem = ({ 
  id,
  icon: Icon, 
  label, 
  isActive = false,
  starred = false,
  labels = [],
  onMove,
  index,
  onClick,
  onDelete,
  onDuplicate
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const ref = useRef(null);

  const [{ isDragging }, drag] = useDrag({
    type: ITEM_TYPE,
    item: { id, index },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });

  const [{ isOver, canDrop }, drop] = useDrop({
    accept: ITEM_TYPE,
    canDrop: (item) => item.id !== id,
    drop: (item) => {
      if (item.id !== id && onMove) {
        onMove(item.id, id, index);
      }
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
      canDrop: monitor.canDrop(),
    }),
  });

  drag(drop(ref));
  
  return (
    <div
      ref={ref}
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`
        w-full h-7 flex items-center gap-1.5 pr-2 pl-3 rounded-m3-sm cursor-pointer
        transition-colors duration-150 ease-emphasized
        ${isActive 
          ? "bg-secondary-container text-secondary-container-foreground" 
          : "text-on-surface-variant hover:bg-on-surface/[0.08]"
        }
        ${isDragging ? "opacity-50" : ""}
        ${isOver && canDrop ? "ring-2 ring-primary ring-inset" : ""}
      `}
      style={{ height: "28px" }}
    >
      <GripVertical className="h-3 w-3 flex-shrink-0 text-on-surface-variant/40 cursor-grab" />
      <Icon className="h-3.5 w-3.5 flex-shrink-0" />
      <span className="flex-1 text-left text-tree truncate">{label}</span>
      
      {isHovered ? (
        <div className="flex items-center gap-0.5">
          <IconButton icon={Star} label="Star" className={starred ? "text-amber-500" : ""} />
          <IconButton icon={Copy} label="Duplicate" onClick={onDuplicate} />
          <IconButton icon={Upload} label="Export" />
          <IconButton icon={Trash2} label="Delete" onClick={onDelete} />
        </div>
      ) : (
        <div className="flex items-center gap-1">
          {starred && <Star className="h-3 w-3 text-amber-500 fill-amber-500" />}
          {labels.slice(0, 1).map(lbl => (
            <LabelBadge key={lbl} label={lbl} size="xs" />
          ))}
          {labels.length > 1 && (
            <span className="text-[8px] text-on-surface-variant">+{labels.length - 1}</span>
          )}
        </div>
      )}
    </div>
  );
};

const TemplatesFolderPanel = ({ 
  onSelectTemplate, 
  selectedTemplateId,
  activeTemplateTab = "prompts",
  onTemplateTabChange,
  // Real data props - Phase 8-9
  templates = [],
  schemaTemplates = [],
  mappingTemplates = [],
  isLoadingTemplates = false,
  isLoadingSchemas = false,
  onCreateTemplate,
  onDeleteTemplate,
  onCreateSchema,
  onDeleteSchema,
}) => {
  const [activeFolder, setActiveFolder] = useState("all");

  // Use controlled state if provided, otherwise internal
  const activeType = activeTemplateTab;
  const setActiveType = (type) => {
    onTemplateTabChange?.(type);
  };

  const handleMove = (draggedId, targetId, targetIndex) => {
    console.log(`Move ${draggedId} to position near ${targetId} (index: ${targetIndex})`);
  };

  // Mapping templates come from exportTemplates prop (empty array fallback)

  // Transform real data to display format while keeping original data
  const displayTemplates = useMemo(() => {
    switch (activeType) {
      case "prompts":
        return templates.map(t => ({
          ...t, // Keep all original template properties
          id: t.row_id,
          name: t.template_name || "Untitled Template",
          description: t.template_description,
          labels: t.category ? [t.category] : [],
          starred: false, // Not implemented yet
        }));
      case "schemas":
        return schemaTemplates.map(s => ({
          ...s, // Keep all original schema properties
          id: s.row_id,
          name: s.schema_name || "Untitled Schema",
          description: s.schema_description,
          labels: s.category ? [s.category] : [],
          starred: false,
        }));
      case "mappings":
        return mappingTemplates;
      default:
        return templates.map(t => ({
          ...t,
          id: t.row_id,
          name: t.template_name || "Untitled Template",
          labels: t.category ? [t.category] : [],
          starred: false,
        }));
    }
  }, [activeType, templates, schemaTemplates, mappingTemplates]);

  const getIcon = () => {
    switch (activeType) {
      case "prompts": return LayoutTemplate;
      case "schemas": return Braces;
      case "mappings": return Link2;
      default: return LayoutTemplate;
    }
  };

  const TemplateIcon = getIcon();
  const isLoading = activeType === "prompts" ? isLoadingTemplates : 
                    activeType === "schemas" ? isLoadingSchemas : false;

  const handleCreateNew = async () => {
    if (activeType === "prompts" && onCreateTemplate) {
      const newTemplate = await onCreateTemplate({
        name: "New Template",
        description: "",
        category: "general",
        structure: { input_admin_prompt: "", input_user_prompt: "" },
        isPrivate: false,
      });
      if (newTemplate) {
        onSelectTemplate?.(newTemplate);
      }
    } else if (activeType === "schemas" && onCreateSchema) {
      const newSchema = await onCreateSchema({
        schemaName: "New Schema",
        schemaDescription: "",
        category: "general",
        jsonSchema: { type: "object", properties: {}, required: [] },
      });
      if (newSchema) {
        onSelectTemplate?.(newSchema);
      }
    }
  };

  const handleDelete = async (template) => {
    if (activeType === "prompts" && onDeleteTemplate) {
      await onDeleteTemplate(template.row_id);
    } else if (activeType === "schemas" && onDeleteSchema) {
      await onDeleteSchema(template.row_id);
    }
  };

  return (
    <div className="h-full flex flex-col bg-surface-container-low overflow-hidden">
      {/* Template Type Tabs */}
      <div className="p-2 border-b border-outline-variant">
        <div className="flex gap-1 p-1 bg-surface-container rounded-m3-sm">
          {[
            { id: "prompts", icon: LayoutTemplate, label: "Prompts" },
            { id: "schemas", icon: Braces, label: "Schemas" },
            { id: "mappings", icon: Link2, label: "Mappings" },
          ].map(tab => (
            <Tooltip key={tab.id}>
              <TooltipTrigger asChild>
                <button
                  onClick={() => setActiveType(tab.id)}
                  className={`flex-1 h-7 flex items-center justify-center gap-1.5 rounded-sm text-tree transition-colors ${
                    activeType === tab.id 
                      ? "bg-secondary-container text-secondary-container-foreground" 
                      : "text-on-surface-variant hover:bg-on-surface/[0.08]"
                  }`}
                >
                  <tab.icon className="h-3.5 w-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent className="text-[10px]">{tab.label}</TooltipContent>
            </Tooltip>
          ))}
        </div>
      </div>

      {/* Smart Folders */}
      <div className="p-2">
        <p className="px-3 py-2 text-label-sm text-on-surface-variant uppercase tracking-wider">
          Smart Folders
        </p>
        <div className="flex flex-col gap-0.5">
          <SmartFolder 
            icon={LayoutTemplate} 
            label="All Templates" 
            count={displayTemplates.length} 
            isActive={activeFolder === "all"}
            onClick={() => setActiveFolder("all")}
          />
          <SmartFolder 
            icon={Star} 
            label="Starred" 
            count={displayTemplates.filter(t => t.starred).length}
            isActive={activeFolder === "starred"}
            onClick={() => setActiveFolder("starred")}
          />
          <SmartFolder 
            icon={Clock} 
            label="Recent" 
            count={Math.min(3, displayTemplates.length)}
            isActive={activeFolder === "recent"}
            onClick={() => setActiveFolder("recent")}
          />
        </div>
      </div>

      {/* Divider */}
      <div className="mx-3 h-px bg-outline-variant" />

      {/* Templates Tree */}
      <div className="flex-1 overflow-auto p-2 scrollbar-thin">
        <div className="flex items-center justify-between px-3 py-2">
          <p className="text-label-sm text-on-surface-variant uppercase tracking-wider">
            {activeType === "prompts" ? "Prompt Templates" : activeType === "schemas" ? "JSON Schemas" : "Variable Mappings"}
          </p>
          <Tooltip>
            <TooltipTrigger asChild>
              <button 
                onClick={handleCreateNew}
                className="w-5 h-5 flex items-center justify-center rounded-sm text-on-surface-variant hover:bg-on-surface/[0.08]"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent className="text-[10px]">New {activeType === "prompts" ? "Template" : activeType === "schemas" ? "Schema" : "Mapping"}</TooltipContent>
          </Tooltip>
        </div>
        
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 text-on-surface-variant animate-spin" />
          </div>
        ) : displayTemplates.length === 0 ? (
          <div className="text-center py-8 text-on-surface-variant">
            <LayoutTemplate className="h-8 w-8 mx-auto mb-2 opacity-30" />
            <p className="text-tree">No {activeType} yet</p>
          </div>
        ) : (
          <div className="flex flex-col gap-0.5">
            {displayTemplates
              .filter(t => activeFolder === "all" || (activeFolder === "starred" && t.starred))
              .slice(0, activeFolder === "recent" ? 3 : undefined)
              .map((template, index) => (
                <TemplateTreeItem 
                  key={template.id}
                  id={template.id}
                  icon={TemplateIcon} 
                  label={template.name}
                  labels={template.labels || []}
                  starred={template.starred}
                  isActive={selectedTemplateId === template.id || selectedTemplateId === template.row_id}
                  onMove={handleMove}
                  index={index}
                  onClick={() => onSelectTemplate?.(template)}
                  onDelete={() => handleDelete(template)}
                />
              ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default TemplatesFolderPanel;