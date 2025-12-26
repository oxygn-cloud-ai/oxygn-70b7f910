import React from "react";
import { Menu, Search, Bell, Command } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

const MockupTopBar = ({ onToggleFolderPanel, folderPanelOpen }) => {
  return (
    <header 
      className="h-16 flex items-center gap-4 px-4 bg-surface-container-low border-b border-outline-variant"
      style={{ height: "64px" }}
    >
      {/* Leading - Hamburger Menu */}
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={onToggleFolderPanel}
            className="w-10 h-10 flex items-center justify-center rounded-m3-full text-on-surface-variant hover:bg-on-surface/[0.08] transition-colors duration-200"
          >
            <Menu className="h-6 w-6" />
          </button>
        </TooltipTrigger>
        <TooltipContent className="text-label-md">
          {folderPanelOpen ? "Close folders" : "Open folders"}
        </TooltipContent>
      </Tooltip>

      {/* Logo / Title */}
      <span className="text-title-md font-semibold text-on-surface">
        Qonsol
      </span>

      {/* Center - Search Bar */}
      <div className="flex-1 max-w-2xl mx-auto">
        <div 
          className="h-14 flex items-center gap-3 px-4 bg-surface-container-high rounded-m3-xl cursor-pointer hover:bg-surface-container-highest transition-colors duration-200"
          style={{ height: "56px", borderRadius: "28px" }}
        >
          <Search className="h-5 w-5 text-on-surface-variant" />
          <span className="flex-1 text-body-md text-on-surface-variant">
            Search prompts, templates...
          </span>
          <div className="flex items-center gap-1 text-label-sm text-on-surface-variant bg-surface-container px-2 py-1 rounded-m3-sm">
            <Command className="h-3 w-3" />
            <span>K</span>
          </div>
        </div>
      </div>

      {/* Trailing - Notifications & Avatar */}
      <div className="flex items-center gap-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <button className="w-10 h-10 flex items-center justify-center rounded-m3-full text-on-surface-variant hover:bg-on-surface/[0.08] transition-colors duration-200 relative">
              <Bell className="h-5 w-5" />
              <span className="absolute top-2 right-2 w-2 h-2 bg-primary rounded-full" />
            </button>
          </TooltipTrigger>
          <TooltipContent className="text-label-md">
            Notifications
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Avatar className="h-10 w-10 cursor-pointer">
              <AvatarFallback className="bg-tertiary-container text-tertiary-foreground text-label-lg">
                JD
              </AvatarFallback>
            </Avatar>
          </TooltipTrigger>
          <TooltipContent className="text-label-md">
            John Doe
          </TooltipContent>
        </Tooltip>
      </div>
    </header>
  );
};

export default MockupTopBar;
