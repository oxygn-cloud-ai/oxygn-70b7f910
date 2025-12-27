import React from "react";
import { 
  MessageSquare, 
  Plus,
  Clock,
  Star,
  LayoutTemplate,
  Braces,
  FileJson,
  Settings,
  Database,
  Key,
  Palette,
  Bell,
  User,
  Activity,
  Server,
  Shield,
  Zap,
  Type,
  Cpu,
  DollarSign,
  CreditCard,
  Briefcase,
  FileText
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
const WorkbenchSubmenu = ({ onItemClick, activeSubItem }) => (
  <div className="p-1.5">
    <div className="flex flex-col gap-0.5">
      <SubmenuItem 
        icon={Plus} 
        label="New Conversation" 
        description="Start a new chat thread"
        isActive={activeSubItem === "new-conversation"}
        onClick={() => onItemClick?.("new-conversation")}
      />
      <SubmenuItem 
        icon={Clock} 
        label="Recent" 
        description="5 conversations"
        isActive={activeSubItem === "recent"}
        onClick={() => onItemClick?.("recent")}
      />
      <SubmenuItem 
        icon={Star} 
        label="Starred" 
        description="2 starred"
        isActive={activeSubItem === "starred"}
        onClick={() => onItemClick?.("starred")}
      />
      <SubmenuItem 
        icon={MessageSquare} 
        label="Continue Last" 
        description="Resume previous session"
        isActive={activeSubItem === "continue-last"}
        onClick={() => onItemClick?.("continue-last")}
      />
    </div>
  </div>
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
        icon={Database} 
        label="Database & Environment" 
        description="Settings & secrets"
        isActive={activeSubItem === "database"}
        onClick={() => onItemClick?.("database")}
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
        icon={Briefcase} 
        label="Workbench" 
        description="Workbench options"
        isActive={activeSubItem === "workbench"}
        onClick={() => onItemClick?.("workbench")}
      />
      <SubmenuItem 
        icon={DollarSign} 
        label="Cost Analytics" 
        description="Usage & spending"
        isActive={activeSubItem === "cost-analytics"}
        onClick={() => onItemClick?.("cost-analytics")}
      />
      <SubmenuItem 
        icon={CreditCard} 
        label="OpenAI Billing" 
        description="Subscription & credits"
        isActive={activeSubItem === "openai-billing"}
        onClick={() => onItemClick?.("openai-billing")}
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
        icon={Key} 
        label="API Keys" 
        description="Credentials & tokens"
        isActive={activeSubItem === "api-keys"}
        onClick={() => onItemClick?.("api-keys")}
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
      <SubmenuItem 
        icon={Server} 
        label="Environment" 
        description="Variables & secrets"
        isActive={activeSubItem === "environment"}
        onClick={() => onItemClick?.("environment")}
      />
    </div>
  </div>
);

const SubmenuPanel = ({ hoveredNav, activeSubItem, onItemClick }) => {
  const submenus = {
    workbench: WorkbenchSubmenu,
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
