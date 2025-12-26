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
  GripVertical
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useDrag, useDrop } from "react-dnd";

const ITEM_TYPE = "PROMPT_ITEM";

const SmartFolder = ({ icon: Icon, label, count, isActive = false }) => (
  <button
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

const IconButton = ({ icon: Icon, label, className = "" }) => (
  <Tooltip>
    <TooltipTrigger asChild>
      <button
        onClick={(e) => e.stopPropagation()}
        className={`w-5 h-5 flex items-center justify-center rounded-sm text-on-surface-variant hover:bg-on-surface/[0.12] ${className}`}
      >
        <Icon className="h-3.5 w-3.5" />
      </button>
    </TooltipTrigger>
    <TooltipContent className="text-[10px]">{label}</TooltipContent>
  </Tooltip>
);

const OwnerAvatar = ({ initials, color }) => (
  <div 
    className={`w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-medium ${color}`}
    style={{ width: "20px", height: "20px" }}
  >
    {initials}
  </div>
);

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
  onMove,
  index
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const ref = useRef(null);
  const visualLevel = Math.min(level, 4);
  const paddingLeft = 12 + visualLevel * 12;
  const depthIndicator = level > 4 ? `${level}` : null;

  const [{ isDragging }, drag, preview] = useDrag({
    type: ITEM_TYPE,
    item: { id, index, level },
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
      onClick={onToggle}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`
        w-full h-7 flex items-center gap-1.5 pr-2 rounded-m3-sm cursor-grab
        transition-colors duration-150 ease-emphasized
        ${isActive 
          ? "bg-secondary-container text-secondary-container-foreground" 
          : "text-on-surface-variant hover:bg-on-surface/[0.08]"
        }
        ${isDragging ? "opacity-50" : ""}
        ${isOver && canDrop ? "ring-2 ring-primary ring-inset" : ""}
      `}
      style={{ height: "28px", paddingLeft: `${paddingLeft}px` }}
    >
      {/* Drag handle */}
      <GripVertical className="h-3 w-3 flex-shrink-0 text-on-surface-variant/40 cursor-grab" />
      
      {depthIndicator && (
        <span className="text-[8px] text-on-surface-variant/50 w-3 flex-shrink-0">{depthIndicator}</span>
      )}
      {hasChildren && (
        <span onClick={(e) => { e.stopPropagation(); onToggle?.(); }}>
          {isExpanded 
            ? <ChevronDown className="h-3.5 w-3.5 flex-shrink-0" />
            : <ChevronRight className="h-3.5 w-3.5 flex-shrink-0" />
          }
        </span>
      )}
      {!hasChildren && <span className="w-3.5" />}
      <Icon className="h-3.5 w-3.5 flex-shrink-0" />
      <span className="flex-1 text-left text-[11px] truncate">{label}</span>
      
      {/* Hover actions or status icons */}
      {isHovered ? (
        <div className="flex items-center gap-0.5">
          <IconButton icon={Star} label="Star" className={starred ? "text-primary" : ""} />
          <IconButton icon={Sparkles} label="Run" />
          <IconButton icon={Link2} label="Copy Variable Reference" />
          <IconButton icon={Plus} label="Add Child" />
          <IconButton icon={Copy} label="Duplicate" />
          <IconButton icon={Upload} label="Export" />
          <IconButton icon={Ban} label="Exclude from Cascade" className={excludedFromCascade ? "text-muted-foreground" : ""} />
          <IconButton icon={FileX} label="Exclude from Export" className={excludedFromExport ? "text-warning" : ""} />
          <IconButton icon={Trash2} label="Delete" />
        </div>
      ) : (
        <div className="flex items-center gap-1">
          {starred && <Star className="h-3 w-3 text-primary fill-primary" />}
          {excludedFromCascade && <Ban className="h-3 w-3 text-muted-foreground" />}
          {excludedFromExport && <FileX className="h-3 w-3 text-warning" />}
          {owner && <OwnerAvatar initials={owner.initials} color={owner.color} />}
        </div>
      )}
    </div>
  );
};

const MockupFolderPanel = () => {
  const [expandedFolders, setExpandedFolders] = useState({ 
    "doc-processor": true,
    "support-bot": true
  });

  const toggleFolder = (id) => {
    setExpandedFolders(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleMove = (draggedId, targetId, targetIndex) => {
    // In a real app, this would update the tree structure
    console.log(`Move ${draggedId} to position near ${targetId} (index: ${targetIndex})`);
  };

  const owners = {
    jd: { initials: "JD", color: "bg-primary text-primary-foreground" },
    am: { initials: "AM", color: "bg-secondary-container text-secondary-container-foreground" },
    kl: { initials: "KL", color: "bg-tertiary-container text-on-surface" },
  };

  return (
    <div className="h-full flex flex-col bg-surface-container-low overflow-hidden">
      {/* Smart Folders */}
      <div className="p-2">
        <p className="px-3 py-2 text-label-sm text-on-surface-variant uppercase tracking-wider">
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
      <div className="mx-3 h-px bg-outline-variant" />

      {/* Prompts Tree */}
      <div className="flex-1 overflow-auto p-2 scrollbar-thin">
        <p className="px-3 py-2 text-label-sm text-on-surface-variant uppercase tracking-wider">
          Prompts
        </p>
        <div className="flex flex-col gap-0.5">
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
            onMove={handleMove}
            index={0}
          />
          {expandedFolders["doc-processor"] && (
            <>
              <TreeItem id="parse-input" icon={FileText} label="1. Parse Input" level={1} hasChildren isExpanded owner={owners.jd} onMove={handleMove} index={1} />
              <TreeItem id="extract-meta" icon={FileText} label="2. Extract Metadata" level={2} hasChildren isExpanded owner={owners.jd} onMove={handleMove} index={2} />
              <TreeItem id="validate-schema" icon={FileText} label="3. Validate Schema" level={3} hasChildren isExpanded excludedFromCascade owner={owners.jd} onMove={handleMove} index={3} />
              <TreeItem id="transform-data" icon={FileText} label="4. Transform Data" level={4} hasChildren isExpanded owner={owners.jd} onMove={handleMove} index={4} />
              <TreeItem id="enrich-content" icon={FileText} label="5. Enrich Content" level={5} hasChildren isExpanded owner={owners.jd} onMove={handleMove} index={5} />
              <TreeItem id="apply-rules" icon={FileText} label="6. Apply Rules" level={6} hasChildren isExpanded owner={owners.jd} onMove={handleMove} index={6} />
              <TreeItem id="gen-output" icon={FileText} label="7. Generate Output" level={7} hasChildren isExpanded owner={owners.jd} onMove={handleMove} index={7} />
              <TreeItem id="format-response" icon={FileText} label="8. Format Response" level={8} hasChildren isExpanded owner={owners.jd} onMove={handleMove} index={8} />
              <TreeItem id="final-review" icon={FileText} label="9. Final Review" level={9} owner={owners.jd} onMove={handleMove} index={9} />
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
            onMove={handleMove}
            index={10}
          />
          {expandedFolders["support-bot"] && (
            <>
              <TreeItem id="greeting" icon={FileText} label="Greeting Handler" level={1} owner={owners.am} onMove={handleMove} index={11} />
              <TreeItem id="issue-classifier" icon={FileText} label="Issue Classifier" level={1} hasChildren isExpanded excludedFromExport owner={owners.am} onMove={handleMove} index={12} />
              <TreeItem id="tech-issues" icon={FileText} label="Technical Issues" level={2} owner={owners.am} onMove={handleMove} index={13} />
              <TreeItem id="billing-issues" icon={FileText} label="Billing Issues" level={2} owner={owners.am} onMove={handleMove} index={14} />
              <TreeItem id="escalation" icon={FileText} label="Escalation Handler" level={1} owner={owners.am} onMove={handleMove} index={15} />
            </>
          )}

          {/* Simple top-level prompts */}
          <TreeItem id="api-docs" icon={FileText} label="API Documentation" owner={owners.kl} onMove={handleMove} index={16} />
          <TreeItem id="summary-gen" icon={FileText} label="Summary Generator" starred owner={owners.jd} onMove={handleMove} index={17} />
          <TreeItem id="email-templates" icon={FileText} label="Email Templates" hasChildren isExpanded={expandedFolders["email"]} onToggle={() => toggleFolder("email")} owner={owners.am} onMove={handleMove} index={18} />
          {expandedFolders["email"] && (
            <>
              <TreeItem id="welcome-email" icon={FileText} label="Welcome Email" level={1} owner={owners.am} onMove={handleMove} index={19} />
              <TreeItem id="followup-email" icon={FileText} label="Follow-up Email" level={1} owner={owners.am} onMove={handleMove} index={20} />
            </>
          )}
          <TreeItem id="quick-notes" icon={FileText} label="Quick Notes" excludedFromCascade excludedFromExport owner={owners.kl} onMove={handleMove} index={21} />
          <TreeItem id="code-review" icon={FileText} label="Code Review" owner={owners.jd} onMove={handleMove} index={22} />
        </div>
      </div>
    </div>
  );
};

export default MockupFolderPanel;
