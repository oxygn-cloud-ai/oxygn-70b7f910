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
  const paddingLeft = 12 + level * 16;
  
  return (
    <button
      onClick={onToggle}
      className={`
        w-full h-8 flex items-center gap-2 pr-3 rounded-m3-sm
        transition-colors duration-150 ease-emphasized
        ${isActive 
          ? "bg-secondary-container text-secondary-container-foreground" 
          : "text-on-surface-variant hover:bg-on-surface/[0.08]"
        }
      `}
      style={{ height: "32px", paddingLeft: `${paddingLeft}px` }}
    >
      {hasChildren && (
        isExpanded 
          ? <ChevronDown className="h-4 w-4 flex-shrink-0" />
          : <ChevronRight className="h-4 w-4 flex-shrink-0" />
      )}
      {!hasChildren && <span className="w-4" />}
      <Icon className="h-4 w-4 flex-shrink-0" />
      <span className="flex-1 text-left text-label-md truncate">{label}</span>
    </button>
  );
};

const MockupFolderPanel = ({ isOpen }) => {
  const [expandedFolders, setExpandedFolders] = useState({ "project-a": true });

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
              <TreeItem icon={Bot} label="Customer Support Bot" level={1} isActive />
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
