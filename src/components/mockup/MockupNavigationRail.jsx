import React from "react";
import { 
  Menu,
  FileText, 
  MessageSquare, 
  LayoutTemplate, 
  Settings, 
  Heart
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const NavItem = ({ icon: Icon, label, isActive = false, onClick, onMouseEnter, onMouseLeave }) => (
  <div 
    className="flex flex-col items-center gap-0.5"
    onMouseEnter={onMouseEnter}
    onMouseLeave={onMouseLeave}
  >
    <button
      onClick={onClick}
      className={`
        relative w-14 h-8 flex items-center justify-center rounded-m3-lg
        transition-all duration-200 ease-emphasized
        ${isActive 
          ? "bg-secondary-container text-secondary-container-foreground" 
          : "text-on-surface-variant hover:bg-on-surface/[0.08]"
        }
      `}
    >
      <Icon className="h-5 w-5" />
    </button>
    <span 
      className={`text-[9px] leading-tight ${isActive ? "text-on-surface" : "text-on-surface-variant"}`}
    >
      {label}
    </span>
  </div>
);

const MockupNavigationRail = ({ activeNav = "prompts", onNavChange, onNavHover, onToggleFolderPanel, folderPanelOpen }) => {
  const navItems = [
    { id: "prompts", icon: FileText, label: "Prompts" },
    { id: "workbench", icon: MessageSquare, label: "Workbench" },
    { id: "templates", icon: LayoutTemplate, label: "Templates" },
    { id: "settings", icon: Settings, label: "Settings" },
    { id: "health", icon: Heart, label: "Health" },
  ];

  return (
    <nav 
      className="w-20 h-full flex flex-col items-center py-4 gap-2 bg-surface-container-lowest border-r border-outline-variant"
      style={{ minWidth: "80px", maxWidth: "80px" }}
    >
      {/* Hamburger Menu - Toggle Folder Panel */}
      <Tooltip>
        <TooltipTrigger asChild>
          <button 
            onClick={onToggleFolderPanel}
            className="w-10 h-10 rounded-m3-full flex items-center justify-center text-on-surface-variant hover:bg-on-surface/[0.08] transition-colors duration-200 mb-4"
          >
            <Menu className="h-6 w-6" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="right" className="text-label-md">
          {folderPanelOpen ? "Close folders" : "Open folders"}
        </TooltipContent>
      </Tooltip>

      {/* Nav Items */}
      <div className="flex flex-col items-center gap-1 flex-1">
        {navItems.map((item) => (
          <NavItem
            key={item.id}
            icon={item.icon}
            label={item.label}
            isActive={activeNav === item.id}
            onClick={() => onNavChange?.(item.id)}
            onMouseEnter={() => onNavHover?.(item.id)}
            onMouseLeave={() => onNavHover?.(null)}
          />
        ))}
      </div>
    </nav>
  );
};

export default MockupNavigationRail;
