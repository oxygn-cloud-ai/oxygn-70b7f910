import React from "react";
import { 
  MessageSquare, 
  Plus,
  LayoutTemplate,
  Braces,
  FileJson,
  Settings,
  Palette,
  Bell,
  User,
  Activity,
  Server,
  Shield,
  Zap,
  Type,
  Cpu,
  FileText,
  Trash2,
  BookOpen,
  Key,
  CloudCog,
  Sparkles
} from "lucide-react";

const SubmenuItem = ({ icon: Icon, label, description, isActive = false, onClick }) => (
  <button
    onClick={onClick}
    className={`
      w-full flex items-start gap-2.5 p-2.5 rounded-m3-md text-left
      transition-colors duration-150 ease-emphasized
      ${isActive 
        ? "bg-secondary-container text-secondary-container-foreground" 
        : "text-on-surface hover:bg-on-surface/[0.08]"
      }
    `}
  >
    <Icon className="h-4 w-4 flex-shrink-0 mt-0.5" />
    <div className="flex-1 min-w-0">
      <p className="text-label-sm font-medium truncate">{label}</p>
      {description && (
        <p className={`text-[10px] truncate mt-0.5 ${isActive ? "opacity-80" : "text-on-surface-variant"}`}>{description}</p>
      )}
    </div>
  </button>
);

// Flat menu layout (no section titles) - matches Health pattern
const TemplatesSubmenu = ({ onItemClick, activeSubItem }) => (
  <div className="p-1.5">
    <div className="flex flex-col gap-0.5">
      <SubmenuItem 
        icon={LayoutTemplate} 
        label="Prompt Templates" 
        description="Reusable prompt structures"
        isActive={activeSubItem === "prompt-templates"}
        onClick={() => onItemClick?.("prompt-templates")}
      />
      <SubmenuItem 
        icon={Braces} 
        label="JSON Schemas" 
        description="Output format definitions"
        isActive={activeSubItem === "json-schemas"}
        onClick={() => onItemClick?.("json-schemas")}
      />
      <SubmenuItem 
        icon={FileJson} 
        label="Export Mappings" 
        description="Field mapping templates"
        isActive={activeSubItem === "export-mappings"}
        onClick={() => onItemClick?.("export-mappings")}
      />
      <SubmenuItem 
        icon={Plus} 
        label="Create Template" 
        description="Start from scratch"
        isActive={activeSubItem === "create-template"}
        onClick={() => onItemClick?.("create-template")}
      />
    </div>
  </div>
);

// Flat menu layout (no section titles) - matches Health pattern
const SettingsSubmenu = ({ onItemClick, activeSubItem }) => (
  <div className="p-1.5">
    <div className="flex flex-col gap-0.5">
      <SubmenuItem 
        icon={Settings} 
        label="General" 
        description="App preferences"
        isActive={activeSubItem === "qonsol"}
        onClick={() => onItemClick?.("qonsol")}
      />
      <SubmenuItem 
        icon={Type} 
        label="Prompt Naming" 
        description="Naming conventions"
        isActive={activeSubItem === "naming"}
        onClick={() => onItemClick?.("naming")}
      />
      <SubmenuItem 
        icon={Cpu} 
        label="AI Models" 
        description="Model defaults & pricing"
        isActive={activeSubItem === "models"}
        onClick={() => onItemClick?.("models")}
      />
      <SubmenuItem 
        icon={MessageSquare} 
        label="Conversation Defaults" 
        description="Assistant settings"
        isActive={activeSubItem === "assistants"}
        onClick={() => onItemClick?.("assistants")}
      />
      <SubmenuItem 
        icon={MessageSquare} 
        label="Conversations" 
        description="Thread management"
        isActive={activeSubItem === "conversations"}
        onClick={() => onItemClick?.("conversations")}
      />
      <SubmenuItem 
        icon={FileText} 
        label="Confluence" 
        description="Page sync settings"
        isActive={activeSubItem === "confluence"}
        onClick={() => onItemClick?.("confluence")}
      />
      <SubmenuItem 
        icon={Key} 
        label="OpenAI" 
        description="API key configuration"
        isActive={activeSubItem === "openai"}
        onClick={() => onItemClick?.("openai")}
      />
      <SubmenuItem 
        icon={Sparkles} 
        label="Google Gemini" 
        description="API key configuration"
        isActive={activeSubItem === "gemini"}
        onClick={() => onItemClick?.("gemini")}
      />
      <SubmenuItem 
        icon={Cpu} 
        label="Manus AI" 
        description="Agentic task automation"
        isActive={activeSubItem === "manus"}
        onClick={() => onItemClick?.("manus")}
      />
      <SubmenuItem 
        icon={Palette}
        label="Appearance" 
        description="Theme & colors"
        isActive={activeSubItem === "appearance"}
        onClick={() => onItemClick?.("appearance")}
      />
      <SubmenuItem 
        icon={Bell} 
        label="Notifications" 
        description="Alert preferences"
        isActive={activeSubItem === "notifications"}
        onClick={() => onItemClick?.("notifications")}
      />
      <SubmenuItem 
        icon={User} 
        label="Profile" 
        description="User settings"
        isActive={activeSubItem === "profile"}
        onClick={() => onItemClick?.("profile")}
      />
      <SubmenuItem 
        icon={BookOpen} 
        label="Knowledge Base" 
        description="Qonsol expert content"
        isActive={activeSubItem === "knowledge"}
        onClick={() => onItemClick?.("knowledge")}
      />
      <SubmenuItem 
        icon={Trash2} 
        label="Trash" 
        description="Deleted items"
        isActive={activeSubItem === "trash"}
        onClick={() => onItemClick?.("trash")}
      />
    </div>
  </div>
);

const HealthSubmenu = ({ onItemClick, activeSubItem }) => (
  <div className="p-1.5">
    <div className="flex flex-col gap-0.5">
      <SubmenuItem 
        icon={Activity} 
        label="Overview" 
        description="All systems operational"
        isActive={activeSubItem === "overview"}
        onClick={() => onItemClick?.("overview")}
      />
      <SubmenuItem 
        icon={Server} 
        label="Database" 
        description="Connected"
        isActive={activeSubItem === "database"}
        onClick={() => onItemClick?.("database")}
      />
      <SubmenuItem 
        icon={Zap} 
        label="AI Services" 
        description="Online"
        isActive={activeSubItem === "ai-services"}
        onClick={() => onItemClick?.("ai-services")}
      />
      <SubmenuItem 
        icon={CloudCog} 
        label="OpenAI Resources" 
        description="Vector stores & files"
        isActive={activeSubItem === "resources"}
        onClick={() => onItemClick?.("resources")}
      />
      <SubmenuItem 
        icon={Shield} 
        label="Auth Status" 
        description="Authenticated"
        isActive={activeSubItem === "auth-status"}
        onClick={() => onItemClick?.("auth-status")}
      />
      <SubmenuItem 
        icon={Key} 
        label="API Health" 
        description="All keys valid"
        isActive={activeSubItem === "api-health"}
        onClick={() => onItemClick?.("api-health")}
      />
    </div>
  </div>
);

const SubmenuPanel = ({ hoveredNav, activeSubItem, onItemClick }) => {
  const submenus = {
    templates: TemplatesSubmenu,
    settings: SettingsSubmenu,
    health: HealthSubmenu,
  };

  const SubmenuComponent = submenus[hoveredNav];

  if (!SubmenuComponent) return null;

  return (
    <div className="h-full flex flex-col bg-surface-container-low overflow-hidden">
      <div className="flex-1 overflow-auto scrollbar-thin">
        <SubmenuComponent onItemClick={onItemClick} activeSubItem={activeSubItem} />
      </div>
    </div>
  );
};

export default SubmenuPanel;
