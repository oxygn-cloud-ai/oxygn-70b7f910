import React from "react";
import { 
  Plus, 
  FileText, 
  MessageSquare, 
  LayoutTemplate, 
  Settings, 
  Heart,
  Moon,
  Sun
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const NavItem = ({ icon: Icon, label, isActive = false }) => (
  <div className="flex flex-col items-center gap-0.5">
    <button
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

const MockupNavigationRail = ({ activeNav = "prompts", onToggleDark, isDark }) => {
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
      {/* FAB - New Prompt */}
      <Tooltip>
        <TooltipTrigger asChild>
          <button 
            className="w-14 h-14 rounded-m3-lg bg-primary text-primary-foreground flex items-center justify-center shadow-md hover:shadow-lg transition-shadow duration-200 ease-emphasized mb-4"
          >
            <Plus className="h-6 w-6" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="right" className="text-label-md">
          New Prompt
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
          />
        ))}
      </div>

      {/* Dark Mode Toggle */}
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={onToggleDark}
            className="w-10 h-10 flex items-center justify-center rounded-m3-full text-on-surface-variant hover:bg-on-surface/[0.08] transition-colors duration-200"
          >
            {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </button>
        </TooltipTrigger>
        <TooltipContent side="right" className="text-label-md">
          {isDark ? "Light mode" : "Dark mode"}
        </TooltipContent>
      </Tooltip>
    </nav>
  );
};

export default MockupNavigationRail;
