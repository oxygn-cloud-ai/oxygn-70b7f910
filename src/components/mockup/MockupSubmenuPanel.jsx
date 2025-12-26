import React from "react";
import { 
  MessageSquare, 
  Plus,
  Clock,
  Star,
  LayoutTemplate,
  FileText,
  Braces,
  FileJson,
  Settings,
  Database,
  Key,
  Palette,
  Bell,
  User,
  Heart,
  Activity,
  Server,
  Shield,
  Zap
} from "lucide-react";

const SubmenuItem = ({ icon: Icon, label, description, isActive = false, onClick }) => (
  <button
    onClick={onClick}
    className={`
      w-full flex items-start gap-3 p-3 rounded-m3-md text-left
      transition-colors duration-150 ease-emphasized
      ${isActive 
        ? "bg-secondary-container text-secondary-container-foreground" 
        : "text-on-surface hover:bg-on-surface/[0.08]"
      }
    `}
  >
    <Icon className="h-5 w-5 flex-shrink-0 mt-0.5" />
    <div className="flex-1 min-w-0">
      <p className="text-label-lg font-medium truncate">{label}</p>
      {description && (
        <p className={`text-label-sm truncate mt-0.5 ${isActive ? "opacity-80" : "text-on-surface-variant"}`}>{description}</p>
      )}
    </div>
  </button>
);

const SubmenuSection = ({ title, children }) => (
  <div className="space-y-1">
    <p className="px-3 py-2 text-label-sm text-on-surface-variant uppercase tracking-wider">
      {title}
    </p>
    <div className="flex flex-col gap-0.5">
      {children}
    </div>
  </div>
);

const WorkbenchSubmenu = ({ onItemClick, activeSubItem }) => (
  <div className="p-2 space-y-4">
    <SubmenuSection title="Conversations">
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
    </SubmenuSection>
    
    <div className="mx-3 h-px bg-outline-variant" />
    
    <SubmenuSection title="Quick Actions">
      <SubmenuItem 
        icon={MessageSquare} 
        label="Continue Last" 
        description="Resume previous session"
        isActive={activeSubItem === "continue-last"}
        onClick={() => onItemClick?.("continue-last")}
      />
    </SubmenuSection>
  </div>
);

const TemplatesSubmenu = ({ onItemClick, activeSubItem }) => (
  <div className="p-2 space-y-4">
    <SubmenuSection title="Template Types">
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
    </SubmenuSection>
    
    <div className="mx-3 h-px bg-outline-variant" />
    
    <SubmenuSection title="Actions">
      <SubmenuItem 
        icon={Plus} 
        label="Create Template" 
        description="Start from scratch"
        isActive={activeSubItem === "create-template"}
        onClick={() => onItemClick?.("create-template")}
      />
    </SubmenuSection>
  </div>
);

const SettingsSubmenu = ({ onItemClick, activeSubItem }) => (
  <div className="p-2 space-y-4">
    <SubmenuSection title="Configuration">
      <SubmenuItem 
        icon={Settings} 
        label="General" 
        description="App preferences"
        isActive={activeSubItem === "general"}
        onClick={() => onItemClick?.("general")}
      />
      <SubmenuItem 
        icon={Database} 
        label="AI Models" 
        description="Model defaults & pricing"
        isActive={activeSubItem === "ai-models"}
        onClick={() => onItemClick?.("ai-models")}
      />
      <SubmenuItem 
        icon={Key} 
        label="API Keys" 
        description="Manage credentials"
        isActive={activeSubItem === "api-keys"}
        onClick={() => onItemClick?.("api-keys")}
      />
    </SubmenuSection>
    
    <div className="mx-3 h-px bg-outline-variant" />
    
    <SubmenuSection title="Appearance">
      <SubmenuItem 
        icon={Palette} 
        label="Theme" 
        description="Light / Dark mode"
        isActive={activeSubItem === "theme"}
        onClick={() => onItemClick?.("theme")}
      />
      <SubmenuItem 
        icon={Bell} 
        label="Notifications" 
        description="Alert preferences"
        isActive={activeSubItem === "notifications"}
        onClick={() => onItemClick?.("notifications")}
      />
    </SubmenuSection>
    
    <div className="mx-3 h-px bg-outline-variant" />
    
    <SubmenuSection title="Account">
      <SubmenuItem 
        icon={User} 
        label="Profile" 
        description="User settings"
        isActive={activeSubItem === "profile"}
        onClick={() => onItemClick?.("profile")}
      />
    </SubmenuSection>
  </div>
);

const HealthSubmenu = ({ onItemClick, activeSubItem }) => (
  <div className="p-2 space-y-4">
    <SubmenuSection title="System Status">
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
    </SubmenuSection>
    
    <div className="mx-3 h-px bg-outline-variant" />
    
    <SubmenuSection title="Security">
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
    </SubmenuSection>
  </div>
);

const MockupSubmenuPanel = ({ hoveredNav, activeSubItem, onItemClick }) => {
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

export default MockupSubmenuPanel;
