import React, { useState } from "react";
import { 
  Inbox, 
  MessageSquare, 
  Star, 
  Clock, 
  ChevronRight, 
  ChevronDown, 
  Folder, 
  FileText 
} from "lucide-react";

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

const TreeItem = ({ icon: Icon, label, level = 0, hasChildren = false, isExpanded = false, onToggle, isActive = false }) => {
  // Cap indentation at level 4, then use a subtle indicator for deeper levels
  const visualLevel = Math.min(level, 4);
  const paddingLeft = 12 + visualLevel * 12;
  const depthIndicator = level > 4 ? `${level}` : null;
  
  return (
    <button
      onClick={onToggle}
      className={`
        w-full h-7 flex items-center gap-1.5 pr-3 rounded-m3-sm
        transition-colors duration-150 ease-emphasized
        ${isActive 
          ? "bg-secondary-container text-secondary-container-foreground" 
          : "text-on-surface-variant hover:bg-on-surface/[0.08]"
        }
      `}
      style={{ height: "28px", paddingLeft: `${paddingLeft}px` }}
    >
      {depthIndicator && (
        <span className="text-[8px] text-on-surface-variant/50 w-3 flex-shrink-0">{depthIndicator}</span>
      )}
      {hasChildren && (
        isExpanded 
          ? <ChevronDown className="h-3.5 w-3.5 flex-shrink-0" />
          : <ChevronRight className="h-3.5 w-3.5 flex-shrink-0" />
      )}
      {!hasChildren && <span className="w-3.5" />}
      <Icon className="h-3.5 w-3.5 flex-shrink-0" />
      <span className="flex-1 text-left text-[11px] truncate">{label}</span>
    </button>
  );
};

const MockupFolderPanel = ({ isOpen }) => {
  const [expandedFolders, setExpandedFolders] = useState({ 
    "project-a": true,
    "deep-nest": true 
  });

  const toggleFolder = (id) => {
    setExpandedFolders(prev => ({ ...prev, [id]: !prev[id] }));
  };

  if (!isOpen) return null;

  return (
    <aside 
      className="w-60 h-full flex flex-col bg-surface-container-low border-r border-outline-variant overflow-hidden"
      style={{ width: "240px", minWidth: "240px" }}
    >
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

      {/* Folders Tree */}
      <div className="flex-1 overflow-auto p-2 scrollbar-thin">
        <p className="px-3 py-2 text-label-sm text-on-surface-variant uppercase tracking-wider">
          Folders
        </p>
        <div className="flex flex-col gap-0.5">
          {/* Project A - Expanded */}
          <TreeItem 
            icon={Folder} 
            label="Project A" 
            hasChildren 
            isExpanded={expandedFolders["project-a"]}
            onToggle={() => toggleFolder("project-a")}
          />
          {expandedFolders["project-a"] && (
            <>
              <TreeItem icon={FileText} label="API Documentation" level={1} />
              <TreeItem icon={MessageSquare} label="Customer Support Bot" level={1} isActive />
              <TreeItem icon={FileText} label="Summary Generator" level={1} />
            </>
          )}

          {/* Project B - Collapsed */}
          <TreeItem 
            icon={Folder} 
            label="Project B" 
            hasChildren 
            isExpanded={expandedFolders["project-b"]}
            onToggle={() => toggleFolder("project-b")}
          />
          {expandedFolders["project-b"] && (
            <>
              <TreeItem icon={FileText} label="Email Templates" level={1} />
              <TreeItem icon={FileText} label="Report Builder" level={1} />
            </>
          )}

          {/* Prompt with Deep Child Hierarchy - Shows 9 levels of nested prompts */}
          <TreeItem 
            icon={FileText} 
            label="Document Processor" 
            hasChildren 
            isExpanded={expandedFolders["deep-nest"]}
            onToggle={() => toggleFolder("deep-nest")}
          />
          {expandedFolders["deep-nest"] && (
            <>
              <TreeItem icon={FileText} label="1. Parse Input" level={1} hasChildren isExpanded />
              <TreeItem icon={FileText} label="2. Extract Metadata" level={2} hasChildren isExpanded />
              <TreeItem icon={FileText} label="3. Validate Schema" level={3} hasChildren isExpanded />
              <TreeItem icon={FileText} label="4. Transform Data" level={4} hasChildren isExpanded />
              <TreeItem icon={FileText} label="5. Enrich Content" level={5} hasChildren isExpanded />
              <TreeItem icon={FileText} label="6. Apply Rules" level={6} hasChildren isExpanded />
              <TreeItem icon={FileText} label="7. Generate Output" level={7} hasChildren isExpanded />
              <TreeItem icon={FileText} label="8. Format Response" level={8} hasChildren isExpanded />
              <TreeItem icon={FileText} label="9. Final Review" level={9} isActive />
            </>
          )}

          {/* Project C */}
          <TreeItem 
            icon={Folder} 
            label="Project C" 
            hasChildren 
            isExpanded={expandedFolders["project-c"]}
            onToggle={() => toggleFolder("project-c")}
          />

          {/* Standalone prompts */}
          <TreeItem icon={FileText} label="Quick Notes" />
          <TreeItem icon={FileText} label="Code Review" />
        </div>
      </div>
    </aside>
  );
};

export default MockupFolderPanel;
