import React, { useState, useRef } from "react";
import { 
  Inbox, 
  MessageSquare, 
  Star, 
  Clock, 
  ChevronRight, 
  ChevronDown, 
  FileText,
  Plus,
  Copy,
  Trash2,
  Ban,
  FileX,
  Sparkles,
  Link2,
  Upload,
  GripVertical,
  Workflow
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useDrag, useDrop } from "react-dnd";
import { SkeletonListItem } from "./shared/MockupSkeletons";

const ITEM_TYPE = "PROMPT_ITEM";

const SmartFolder = ({ icon: Icon, label, count, isActive = false }) => (
  <button
    className={`
      w-full h-7 flex items-center gap-2 px-2.5 rounded-m3-sm
      transition-all duration-200 ease-emphasized group
      ${isActive 
        ? "bg-secondary-container text-secondary-container-foreground" 
        : "text-on-surface-variant hover:bg-on-surface/[0.08] hover:translate-x-0.5"
      }
    `}
    style={{ height: "28px" }}
  >
    <Icon className={`h-4 w-4 flex-shrink-0 transition-transform duration-200 ${isActive ? '' : 'group-hover:scale-110'}`} />
    <span className="flex-1 text-left text-[11px] truncate">{label}</span>
    <span className={`text-[10px] px-1.5 py-0.5 rounded-full transition-colors ${
      isActive ? 'bg-secondary-container-foreground/10' : 'bg-on-surface/[0.05]'
    }`}>{count}</span>
  </button>
);

const IconButton = ({ icon: Icon, label, className = "", onClick }) => (
  <Tooltip>
    <TooltipTrigger asChild>
      <button
        onClick={(e) => { e.stopPropagation(); onClick?.(); }}
        className={`w-5 h-5 flex items-center justify-center rounded-sm text-on-surface-variant hover:bg-on-surface/[0.12] hover:scale-110 transition-all duration-150 ${className}`}
      >
        <Icon className="h-3 w-3" />
      </button>
    </TooltipTrigger>
    <TooltipContent className="text-[10px]">{label}</TooltipContent>
  </Tooltip>
);

const OwnerAvatar = ({ initials, color }) => (
  <div 
    className={`w-4 h-4 rounded-full flex items-center justify-center text-[7px] font-medium ${color}`}
    style={{ width: "16px", height: "16px" }}
  >
    {initials}
  </div>
);

// Drop zone between items for inserting
const DropZone = ({ onDrop, isFirst = false }) => {
  const [{ isOver, canDrop }, drop] = useDrop({
    accept: ITEM_TYPE,
    drop: (item) => {
      onDrop(item.id, 'between');
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
      canDrop: monitor.canDrop(),
    }),
  });

  return (
    <div
      ref={drop}
      className={`
        h-0.5 mx-2 rounded-full transition-all duration-150
        ${isOver && canDrop ? 'h-0.5 bg-primary' : 'bg-transparent'}
        ${canDrop && !isOver ? 'hover:bg-primary/30' : ''}
      `}
      style={{ 
        marginTop: isFirst ? 0 : '-1px',
        marginBottom: '-1px'
      }}
    />
  );
};

const TreeItem = ({ 
  id,
  icon: Icon, 
  label, 
  level = 0, 
  hasChildren = false, 
  isExpanded = false, 
  onToggle, 
  isActive = false,
  starred = false,
  excludedFromCascade = false,
  excludedFromExport = false,
  owner = null,
  onMoveInto,
  onMoveBetween,
  index,
  isConversation = false
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const ref = useRef(null);
  const visualLevel = Math.min(level, 4);
  const paddingLeft = 10 + visualLevel * 10;
  const depthIndicator = level > 4 ? `${level}` : null;

  const [{ isDragging }, drag, preview] = useDrag({
    type: ITEM_TYPE,
    item: { id, index, level },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });

  // Drop on item to make it a child
  const [{ isOver, canDrop }, drop] = useDrop({
    accept: ITEM_TYPE,
    canDrop: (item) => item.id !== id,
    drop: (item, monitor) => {
      if (!monitor.didDrop() && item.id !== id && onMoveInto) {
        onMoveInto(item.id, id);
      }
    },
    collect: (monitor) => ({
      isOver: monitor.isOver({ shallow: true }),
      canDrop: monitor.canDrop(),
    }),
  });

  drag(drop(ref));
  
  return (
    <>
      <div
        ref={ref}
        onClick={onToggle}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={`
          w-full h-6 flex items-center gap-1 pr-1.5 rounded-m3-sm cursor-grab
          transition-all duration-200 ease-emphasized group
          ${isActive 
            ? "bg-secondary-container text-secondary-container-foreground" 
            : "text-on-surface-variant hover:bg-on-surface/[0.08]"
          }
          ${isDragging ? "opacity-50 scale-95" : "hover:translate-x-0.5"}
          ${isOver && canDrop ? "ring-1 ring-primary bg-primary/10" : ""}
        `}
        style={{ height: "24px", paddingLeft: `${paddingLeft}px` }}
      >
        {/* Drag handle */}
        <GripVertical className="h-2.5 w-2.5 flex-shrink-0 text-on-surface-variant/40 cursor-grab" />
        
        {depthIndicator && (
          <span className="text-[7px] text-on-surface-variant/50 w-2.5 flex-shrink-0">{depthIndicator}</span>
        )}
        {hasChildren && (
          <span onClick={(e) => { e.stopPropagation(); onToggle?.(); }}>
            {isExpanded 
              ? <ChevronDown className="h-3 w-3 flex-shrink-0" />
              : <ChevronRight className="h-3 w-3 flex-shrink-0" />
            }
          </span>
        )}
        {!hasChildren && <span className="w-3" />}
        <Icon className="h-3 w-3 flex-shrink-0" />
        <span className="flex-1 text-left text-[10px] truncate">{label}</span>
        
        {/* Hover actions or status icons */}
        {isHovered ? (
          <div className="flex items-center gap-0.5">
            <IconButton icon={Star} label="Star" className={starred ? "text-amber-500" : ""} />
            <IconButton icon={Sparkles} label="Run" />
            {hasChildren && <IconButton icon={Workflow} label="Run Cascade" />}
            <IconButton icon={Link2} label="Copy Variable Reference" />
            <IconButton icon={Plus} label="Add Child" />
            <IconButton icon={Copy} label="Duplicate" />
            <IconButton icon={Upload} label="Export" />
            <IconButton icon={Ban} label="Exclude from Cascade" className={excludedFromCascade ? "text-muted-foreground" : ""} />
            <IconButton icon={FileX} label="Exclude from Export" className={excludedFromExport ? "text-warning" : ""} />
            <IconButton icon={Trash2} label="Delete" />
          </div>
        ) : (
          <div className="flex items-center gap-0.5">
            {starred && <Star className="h-2.5 w-2.5 text-amber-500 fill-amber-500" />}
            {excludedFromCascade && <Ban className="h-2.5 w-2.5 text-muted-foreground" />}
            {excludedFromExport && <FileX className="h-2.5 w-2.5 text-warning" />}
            {owner && <OwnerAvatar initials={owner.initials} color={owner.color} />}
          </div>
        )}
      </div>
      
      {/* Drop indicator when hovering - shows "drop to make child" hint */}
      {isOver && canDrop && (
        <div className="mx-2 py-0.5 text-[8px] text-primary text-center bg-primary/5 rounded">
          Drop to make child of "{label}"
        </div>
      )}
    </>
  );
};

const MockupFolderPanel = ({ selectedPrompt, onSelectPrompt }) => {
  const [expandedFolders, setExpandedFolders] = useState({ 
    "doc-processor": true,
    "support-bot": true
  });

  const toggleFolder = (id) => {
    setExpandedFolders(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleMoveInto = (draggedId, targetId) => {
    // In a real app, this would make draggedId a child of targetId
    console.log(`Make ${draggedId} a child of ${targetId}`);
  };

  const handleMoveBetween = (draggedId, position) => {
    // In a real app, this would insert draggedId at the specified position
    console.log(`Insert ${draggedId} at position`);
  };

  const owners = {
    jd: { initials: "JD", color: "bg-tertiary-container text-on-surface" },
    am: { initials: "AM", color: "bg-secondary-container text-secondary-container-foreground" },
    kl: { initials: "KL", color: "bg-surface-container-high text-on-surface" },
  };

  return (
    <div className="h-full flex flex-col bg-surface-container-low overflow-hidden">
      {/* Smart Folders */}
      <div className="p-1.5">
        <p className="px-2 py-1 text-[9px] text-on-surface-variant uppercase tracking-wider">
          Smart Folders
        </p>
        <div className="flex flex-col gap-0.5">
          <SmartFolder icon={Inbox} label="All Prompts" count={24} isActive />
          <SmartFolder icon={MessageSquare} label="Conversations" count={3} />
          <SmartFolder icon={Star} label="Starred" count={7} />
          <SmartFolder icon={Clock} label="Recent" count={5} />
        </div>
      </div>

      {/* Divider */}
      <div className="mx-2 h-px bg-outline-variant" />

      {/* Prompts Tree */}
      <div className="flex-1 overflow-auto p-1.5 scrollbar-thin">
        <div className="flex items-center justify-between px-2 py-1">
          <p className="text-[9px] text-on-surface-variant uppercase tracking-wider">
            Prompts
          </p>
          <Tooltip>
            <TooltipTrigger asChild>
              <button className="w-5 h-5 flex items-center justify-center rounded-sm text-on-surface-variant hover:bg-on-surface/[0.12] hover:text-on-surface transition-colors">
                <Plus className="h-3.5 w-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent className="text-[10px]">Create new prompt</TooltipContent>
          </Tooltip>
        </div>
        <div className="flex flex-col">
          {/* Drop zone at top */}
          <DropZone onDrop={handleMoveBetween} isFirst />
          
          {/* Top-level prompt with deep child hierarchy */}
          <TreeItem 
            id="doc-processor"
            icon={FileText} 
            label="Document Processor" 
            hasChildren 
            isExpanded={expandedFolders["doc-processor"]}
            onToggle={() => toggleFolder("doc-processor")}
            starred
            owner={owners.jd}
            onMoveInto={handleMoveInto}
            onMoveBetween={handleMoveBetween}
            index={0}
          />
          <DropZone onDrop={handleMoveBetween} />
          
          {expandedFolders["doc-processor"] && (
            <>
              <TreeItem id="parse-input" icon={FileText} label="1. Parse Input" level={1} hasChildren isExpanded owner={owners.jd} onMoveInto={handleMoveInto} onMoveBetween={handleMoveBetween} index={1} />
              <DropZone onDrop={handleMoveBetween} />
              <TreeItem id="extract-meta" icon={FileText} label="2. Extract Metadata" level={2} hasChildren isExpanded owner={owners.jd} onMoveInto={handleMoveInto} onMoveBetween={handleMoveBetween} index={2} />
              <DropZone onDrop={handleMoveBetween} />
              <TreeItem id="validate-schema" icon={FileText} label="3. Validate Schema" level={3} hasChildren isExpanded excludedFromCascade owner={owners.jd} onMoveInto={handleMoveInto} onMoveBetween={handleMoveBetween} index={3} />
              <DropZone onDrop={handleMoveBetween} />
              <TreeItem id="transform-data" icon={FileText} label="4. Transform Data" level={4} hasChildren isExpanded owner={owners.jd} onMoveInto={handleMoveInto} onMoveBetween={handleMoveBetween} index={4} />
              <DropZone onDrop={handleMoveBetween} />
              <TreeItem id="enrich-content" icon={FileText} label="5. Enrich Content" level={5} hasChildren isExpanded owner={owners.jd} onMoveInto={handleMoveInto} onMoveBetween={handleMoveBetween} index={5} />
              <DropZone onDrop={handleMoveBetween} />
              <TreeItem id="apply-rules" icon={FileText} label="6. Apply Rules" level={6} hasChildren isExpanded owner={owners.jd} onMoveInto={handleMoveInto} onMoveBetween={handleMoveBetween} index={6} />
              <DropZone onDrop={handleMoveBetween} />
              <TreeItem id="gen-output" icon={FileText} label="7. Generate Output" level={7} hasChildren isExpanded owner={owners.jd} onMoveInto={handleMoveInto} onMoveBetween={handleMoveBetween} index={7} />
              <DropZone onDrop={handleMoveBetween} />
              <TreeItem id="format-response" icon={FileText} label="8. Format Response" level={8} hasChildren isExpanded owner={owners.jd} onMoveInto={handleMoveInto} onMoveBetween={handleMoveBetween} index={8} />
              <DropZone onDrop={handleMoveBetween} />
              <TreeItem id="final-review" icon={FileText} label="9. Final Review" level={9} owner={owners.jd} onMoveInto={handleMoveInto} onMoveBetween={handleMoveBetween} index={9} />
              <DropZone onDrop={handleMoveBetween} />
            </>
          )}

          {/* Conversation with children */}
          <TreeItem 
            id="support-bot"
            icon={MessageSquare} 
            label="Customer Support Bot" 
            hasChildren 
            isExpanded={expandedFolders["support-bot"]}
            onToggle={() => toggleFolder("support-bot")}
            isActive
            starred
            owner={owners.am}
            onMoveInto={handleMoveInto}
            onMoveBetween={handleMoveBetween}
            index={10}
            isConversation
          />
          <DropZone onDrop={handleMoveBetween} />
          
          {expandedFolders["support-bot"] && (
            <>
              <TreeItem id="greeting" icon={FileText} label="Greeting Handler" level={1} owner={owners.am} onMoveInto={handleMoveInto} onMoveBetween={handleMoveBetween} index={11} />
              <DropZone onDrop={handleMoveBetween} />
              <TreeItem id="issue-classifier" icon={FileText} label="Issue Classifier" level={1} hasChildren isExpanded excludedFromExport owner={owners.am} onMoveInto={handleMoveInto} onMoveBetween={handleMoveBetween} index={12} />
              <DropZone onDrop={handleMoveBetween} />
              <TreeItem id="tech-issues" icon={FileText} label="Technical Issues" level={2} owner={owners.am} onMoveInto={handleMoveInto} onMoveBetween={handleMoveBetween} index={13} />
              <DropZone onDrop={handleMoveBetween} />
              <TreeItem id="billing-issues" icon={FileText} label="Billing Issues" level={2} owner={owners.am} onMoveInto={handleMoveInto} onMoveBetween={handleMoveBetween} index={14} />
              <DropZone onDrop={handleMoveBetween} />
              <TreeItem id="escalation" icon={FileText} label="Escalation Handler" level={1} owner={owners.am} onMoveInto={handleMoveInto} onMoveBetween={handleMoveBetween} index={15} />
              <DropZone onDrop={handleMoveBetween} />
            </>
          )}

          {/* Simple top-level prompts */}
          <TreeItem id="api-docs" icon={FileText} label="API Documentation" owner={owners.kl} onMoveInto={handleMoveInto} onMoveBetween={handleMoveBetween} index={16} />
          <DropZone onDrop={handleMoveBetween} />
          <TreeItem id="summary-gen" icon={FileText} label="Summary Generator" starred owner={owners.jd} onMoveInto={handleMoveInto} onMoveBetween={handleMoveBetween} index={17} />
          <DropZone onDrop={handleMoveBetween} />
          <TreeItem id="email-templates" icon={FileText} label="Email Templates" hasChildren isExpanded={expandedFolders["email"]} onToggle={() => toggleFolder("email")} owner={owners.am} onMoveInto={handleMoveInto} onMoveBetween={handleMoveBetween} index={18} />
          <DropZone onDrop={handleMoveBetween} />
          {expandedFolders["email"] && (
            <>
              <TreeItem id="welcome-email" icon={FileText} label="Welcome Email" level={1} owner={owners.am} onMoveInto={handleMoveInto} onMoveBetween={handleMoveBetween} index={19} />
              <DropZone onDrop={handleMoveBetween} />
              <TreeItem id="followup-email" icon={FileText} label="Follow-up Email" level={1} owner={owners.am} onMoveInto={handleMoveInto} onMoveBetween={handleMoveBetween} index={20} />
              <DropZone onDrop={handleMoveBetween} />
            </>
          )}
          <TreeItem id="quick-notes" icon={FileText} label="Quick Notes" excludedFromCascade excludedFromExport owner={owners.kl} onMoveInto={handleMoveInto} onMoveBetween={handleMoveBetween} index={21} />
          <DropZone onDrop={handleMoveBetween} />
          <TreeItem id="code-review" icon={FileText} label="Code Review" owner={owners.jd} onMoveInto={handleMoveInto} onMoveBetween={handleMoveBetween} index={22} />
          <DropZone onDrop={handleMoveBetween} />
        </div>
      </div>
    </div>
  );
};

export default MockupFolderPanel;