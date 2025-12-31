import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Menu,
  FileText, 
  MessageSquare, 
  LayoutTemplate, 
  Settings, 
  Heart,
  PanelLeftClose,
  PanelLeft,
  Keyboard,
  EyeOff,
  RotateCcw
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { trackEvent } from '@/lib/posthog';

const NavItem = ({ icon: Icon, label, isActive = false, isHovered = false, onClick, onMouseEnter, onMouseLeave, shortcut }) => (
  <Tooltip>
    <TooltipTrigger asChild>
      <motion.div 
        className="flex flex-col items-center gap-0.5 relative"
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
      >
        {/* Active indicator pill */}
        <AnimatePresence>
          {isActive && (
            <motion.div
              layoutId="activeNavIndicator"
              className="absolute -left-2 top-1/2 -translate-y-1/2 w-1 h-8 bg-primary rounded-r-full"
              initial={{ opacity: 0, x: -4 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -4 }}
              transition={{ type: "spring", stiffness: 500, damping: 30 }}
            />
          )}
        </AnimatePresence>

        <button
          onClick={onClick}
          className={`
            relative w-14 h-8 flex items-center justify-center rounded-m3-lg
            transition-all duration-200 ease-emphasized
            ${isActive 
              ? "bg-secondary-container text-secondary-container-foreground shadow-sm" 
              : isHovered
                ? "bg-on-surface/[0.12] text-on-surface"
                : "text-on-surface-variant hover:bg-on-surface/[0.08]"
            }
          `}
        >
          <motion.div
            animate={{ 
              scale: isActive ? 1.1 : 1,
              rotate: isActive ? [0, -5, 5, 0] : 0
            }}
            transition={{ duration: 0.3 }}
          >
            <Icon className="h-5 w-5" />
          </motion.div>
        </button>
        <motion.span 
          className={`text-[9px] leading-tight transition-colors duration-200 ${isActive || isHovered ? "text-on-surface font-medium" : "text-on-surface-variant"}`}
          animate={{ opacity: isActive ? 1 : 0.8 }}
        >
          {label}
        </motion.span>
      </motion.div>
    </TooltipTrigger>
    {shortcut && (
      <TooltipContent side="right" className="flex items-center gap-2">
        <span className="text-[10px]">{label}</span>
        <kbd className="text-[9px] px-1.5 py-0.5 rounded bg-surface-container">{shortcut}</kbd>
      </TooltipContent>
    )}
  </Tooltip>
);

const NavigationRail = ({ 
  activeNav = "prompts", 
  onNavChange, 
  onNavHover, 
  onNavLeave, 
  onToggleFolderPanel, 
  folderPanelOpen,
  onShowShortcuts,
  onHideNavRail,
  onResetLayout
}) => {
  const navItems = [
    { id: "prompts", icon: FileText, label: "Prompts", shortcut: "1" },
    { id: "templates", icon: LayoutTemplate, label: "Templates", shortcut: "2" },
    { id: "workbench", icon: MessageSquare, label: "Workbench", shortcut: "3" },
    { id: "settings", icon: Settings, label: "Settings", shortcut: "4" },
    { id: "health", icon: Heart, label: "Health", shortcut: "5" },
  ];

  const [hoveredId, setHoveredId] = useState(null);

  const handleMouseEnter = (id) => {
    setHoveredId(id);
    onNavHover?.(id);
  };

  const handleMouseLeave = () => {
    setHoveredId(null);
    onNavLeave?.();
  };

  return (
    <motion.nav 
      initial={{ x: -80, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className="w-20 h-full flex flex-col items-center py-4 gap-2 bg-surface-container-lowest border-r border-outline-variant"
      style={{ minWidth: "80px", maxWidth: "80px" }}
    >
      {/* Hamburger Menu - Dropdown with options */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <motion.button 
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="w-10 h-10 rounded-m3-full flex items-center justify-center text-on-surface-variant hover:bg-on-surface/[0.08] transition-colors duration-200 mb-4"
          >
            <Menu className="h-6 w-6" />
          </motion.button>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="right" align="start" className="w-56">
          <DropdownMenuItem onClick={onToggleFolderPanel} className="gap-2">
            {folderPanelOpen ? (
              <PanelLeftClose className="h-4 w-4" />
            ) : (
              <PanelLeft className="h-4 w-4" />
            )}
            <span>{folderPanelOpen ? "Close folders" : "Open folders"}</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onShowShortcuts} className="gap-2">
            <Keyboard className="h-4 w-4" />
            <span>Keyboard shortcuts</span>
          </DropdownMenuItem>
          <DropdownMenuSeparator className="bg-outline-variant" />
          <DropdownMenuItem onClick={onHideNavRail} className="gap-2">
            <EyeOff className="h-4 w-4" />
            <span>Hide navigation</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onResetLayout} className="gap-2">
            <RotateCcw className="h-4 w-4" />
            <span>Reset layout</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Nav Items with staggered animation */}
      <motion.div 
        className="flex flex-col items-center gap-3 flex-1"
        initial="hidden"
        animate="visible"
        variants={{
          visible: {
            transition: {
              staggerChildren: 0.05
            }
          }
        }}
      >
        {navItems.map((item, index) => (
          <motion.div
            key={item.id}
            variants={{
              hidden: { opacity: 0, x: -20 },
              visible: { opacity: 1, x: 0 }
            }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
          >
            <NavItem
              icon={item.icon}
              label={item.label}
              shortcut={item.shortcut}
              isActive={activeNav === item.id}
              isHovered={hoveredId === item.id && activeNav !== item.id}
              onClick={() => {
                trackEvent('navigation_section_changed', { 
                  section: item.id, 
                  from_section: activeNav 
                });
                onNavChange?.(item.id);
              }}
              onMouseEnter={() => handleMouseEnter(item.id)}
              onMouseLeave={handleMouseLeave}
            />
          </motion.div>
        ))}
      </motion.div>

      {/* Version indicator at bottom */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="text-[8px] text-on-surface-variant/50 mt-auto"
      >
        v2.0
      </motion.div>
    </motion.nav>
  );
};

export default NavigationRail;
