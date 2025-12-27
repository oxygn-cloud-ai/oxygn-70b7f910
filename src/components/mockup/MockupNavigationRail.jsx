import React from "react";
import { 
  Menu,
  FileText, 
  MessageSquare, 
  LayoutTemplate, 
  Settings, 
  Heart,
  Undo2,
  PanelLeftClose,
  PanelLeft
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useUIPreference } from "@/contexts/UIPreferenceContext";

const NavItem = ({ icon: Icon, label, isActive = false, isHovered = false, onClick, onMouseEnter, onMouseLeave }) => (
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
          : isHovered
            ? "bg-on-surface/[0.12] text-on-surface"
            : "text-on-surface-variant hover:bg-on-surface/[0.08]"
        }
      `}
    >
      <Icon className="h-5 w-5" />
    </button>
    <span 
      className={`text-[9px] leading-tight ${isActive || isHovered ? "text-on-surface" : "text-on-surface-variant"}`}
    >
      {label}
    </span>
  </div>
);

const MockupNavigationRail = ({ activeNav = "prompts", onNavChange, onNavHover, onNavLeave, onToggleFolderPanel, folderPanelOpen }) => {
  const { toggleUI } = useUIPreference();
  
  const navItems = [
    { id: "prompts", icon: FileText, label: "Prompts" },
    { id: "templates", icon: LayoutTemplate, label: "Templates" },
    { id: "workbench", icon: MessageSquare, label: "Workbench" },
    { id: "settings", icon: Settings, label: "Settings" },
    { id: "health", icon: Heart, label: "Health" },
  ];

  const [hoveredId, setHoveredId] = React.useState(null);

  const handleMouseEnter = (id) => {
    setHoveredId(id);
    onNavHover?.(id);
  };

  const handleMouseLeave = () => {
    setHoveredId(null);
    onNavLeave?.();
  };

  return (
    <nav 
      className="w-20 h-full flex flex-col items-center py-4 gap-2 bg-surface-container-lowest border-r border-outline-variant"
      style={{ minWidth: "80px", maxWidth: "80px" }}
    >
      {/* Hamburger Menu - Dropdown with options */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button 
            className="w-10 h-10 rounded-m3-full flex items-center justify-center text-on-surface-variant hover:bg-on-surface/[0.08] transition-colors duration-200 mb-4"
          >
            <Menu className="h-6 w-6" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="right" align="start" className="w-48">
          <DropdownMenuItem onClick={onToggleFolderPanel} className="gap-2">
            {folderPanelOpen ? (
              <PanelLeftClose className="h-4 w-4" />
            ) : (
              <PanelLeft className="h-4 w-4" />
            )}
            <span>{folderPanelOpen ? "Close folders" : "Open folders"}</span>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={toggleUI} className="gap-2">
            <Undo2 className="h-4 w-4" />
            <span>Switch to Old UI</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Nav Items */}
      <div className="flex flex-col items-center gap-3 flex-1">
        {navItems.map((item) => (
          <NavItem
            key={item.id}
            icon={item.icon}
            label={item.label}
            isActive={activeNav === item.id}
            isHovered={hoveredId === item.id && activeNav !== item.id}
            onClick={() => onNavChange?.(item.id)}
            onMouseEnter={() => handleMouseEnter(item.id)}
            onMouseLeave={handleMouseLeave}
          />
        ))}
      </div>
    </nav>
  );
};

export default MockupNavigationRail;
