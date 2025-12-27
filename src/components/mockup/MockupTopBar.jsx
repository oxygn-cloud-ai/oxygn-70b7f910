import React from "react";
import { Search, Bell, Command, MessageCircleQuestion, Moon, Sun } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

const MockupTopBar = ({ tooltipsEnabled = true, onToggleTooltips, isDark = false, onToggleDark }) => {
  return (
    <header 
      className="h-14 flex items-center gap-3 px-3 bg-surface-container-low border-b border-outline-variant"
      style={{ height: "56px" }}
    >
      {/* Logo + Title */}
      <div className="flex items-center gap-2">
        <img 
          src="/Qonsol-Full-Logo_Transparent_NoBuffer.png" 
          alt="Qonsol Logo" 
          className="h-7 w-auto"
        />
        <span className="text-title-sm font-medium text-on-surface">
          Qonsol
        </span>
      </div>

      {/* Center - Search Bar */}
      <div className="flex-1 max-w-xl mx-auto">
        <div 
          className="h-10 flex items-center gap-2 px-3 bg-surface-container-high rounded-m3-xl cursor-pointer hover:bg-surface-container-highest transition-colors duration-200"
          style={{ height: "40px", borderRadius: "20px" }}
        >
          <Search className="h-4 w-4 text-on-surface-variant" />
          <span className="flex-1 text-body-sm text-on-surface-variant">
            Search prompts, templates...
          </span>
          <div className="flex items-center gap-0.5 text-[10px] text-on-surface-variant bg-surface-container px-1.5 py-0.5 rounded-m3-sm">
            <Command className="h-3 w-3" />
            <span>K</span>
          </div>
        </div>
      </div>

      {/* Trailing - Toggles, Notifications & Avatar */}
      <div className="flex items-center gap-0.5">
        <Tooltip>
          <TooltipTrigger asChild>
            <button 
              onClick={onToggleTooltips}
              className="w-9 h-9 flex items-center justify-center rounded-m3-full text-on-surface-variant hover:bg-on-surface/[0.08] transition-colors duration-200"
            >
              <MessageCircleQuestion className={`h-4 w-4 ${tooltipsEnabled ? "text-on-surface" : "opacity-50"}`} />
            </button>
          </TooltipTrigger>
          <TooltipContent className="text-[10px]">
            {tooltipsEnabled ? "Disable tooltips" : "Enable tooltips"}
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <button 
              onClick={onToggleDark}
              className="w-9 h-9 flex items-center justify-center rounded-m3-full text-on-surface-variant hover:bg-on-surface/[0.08] transition-colors duration-200"
            >
              {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
          </TooltipTrigger>
          <TooltipContent className="text-[10px]">
            {isDark ? "Light mode" : "Dark mode"}
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <button className="w-9 h-9 flex items-center justify-center rounded-m3-full text-on-surface-variant hover:bg-on-surface/[0.08] transition-colors duration-200 relative">
              <Bell className="h-4 w-4" />
              <span className="absolute top-2 right-2 w-1.5 h-1.5 bg-primary rounded-full" />
            </button>
          </TooltipTrigger>
          <TooltipContent className="text-[10px]">
            Notifications
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Avatar className="h-8 w-8 cursor-pointer">
              <AvatarFallback className="bg-tertiary-container text-on-surface text-[11px]">
                JD
              </AvatarFallback>
            </Avatar>
          </TooltipTrigger>
          <TooltipContent className="text-[10px]">
            John Doe
          </TooltipContent>
        </Tooltip>
      </div>
    </header>
  );
};

export default MockupTopBar;