import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Bell, Command, MessageCircleQuestion, Moon, Sun } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

const TopBar = ({ 
  tooltipsEnabled = true, 
  onToggleTooltips, 
  isDark = false, 
  onToggleDark,
  onOpenSearch,
  hasNotifications = true 
}) => {
  return (
    <motion.header 
      initial={{ y: -56, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className="h-14 flex items-center gap-3 px-3 bg-surface-container-low border-b border-outline-variant"
      style={{ height: "56px" }}
    >
      {/* Logo + Title */}
      <motion.div 
        className="flex items-center gap-2"
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.1 }}
      >
        <img 
          src="/Qonsol-Full-Logo_Transparent_NoBuffer.png" 
          alt="Qonsol Logo" 
          className="h-7 w-auto"
        />
        <span className="text-title-sm font-medium text-on-surface">
          Qonsol
        </span>
      </motion.div>

      {/* Center - Search Bar */}
      <motion.div 
        className="flex-1 max-w-xl mx-auto"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
      >
        <motion.button
          onClick={onOpenSearch}
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
          className="w-full h-10 flex items-center gap-2 px-3 bg-surface-container-high rounded-m3-xl cursor-pointer hover:bg-surface-container-highest hover:shadow-sm transition-all duration-200"
          style={{ height: "40px", borderRadius: "20px" }}
        >
          <Search className="h-4 w-4 text-on-surface-variant" />
          <span className="flex-1 text-left text-body-sm text-on-surface-variant">
            Search prompts, templates...
          </span>
          <div className="flex items-center gap-0.5 text-[10px] text-on-surface-variant bg-surface-container px-1.5 py-0.5 rounded-m3-sm">
            <Command className="h-3 w-3" />
            <span>K</span>
          </div>
        </motion.button>
      </motion.div>

      {/* Trailing - Toggles, Notifications & Avatar */}
      <motion.div 
        className="flex items-center gap-0.5"
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.2 }}
      >
        <Tooltip>
          <TooltipTrigger asChild>
            <motion.button 
              onClick={onToggleTooltips}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              className="w-9 h-9 flex items-center justify-center rounded-m3-full text-on-surface-variant hover:bg-on-surface/[0.08] transition-colors duration-200"
            >
              <MessageCircleQuestion className={`h-4 w-4 transition-opacity duration-200 ${tooltipsEnabled ? "text-on-surface" : "opacity-50"}`} />
            </motion.button>
          </TooltipTrigger>
          <TooltipContent className="text-[10px]">
            {tooltipsEnabled ? "Disable tooltips" : "Enable tooltips"}
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <motion.button 
              onClick={onToggleDark}
              whileHover={{ scale: 1.1, rotate: 15 }}
              whileTap={{ scale: 0.9 }}
              className="w-9 h-9 flex items-center justify-center rounded-m3-full text-on-surface-variant hover:bg-on-surface/[0.08] transition-colors duration-200"
            >
              <AnimatePresence mode="wait">
                {isDark ? (
                  <motion.div
                    key="sun"
                    initial={{ rotate: -90, opacity: 0 }}
                    animate={{ rotate: 0, opacity: 1 }}
                    exit={{ rotate: 90, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <Sun className="h-4 w-4" />
                  </motion.div>
                ) : (
                  <motion.div
                    key="moon"
                    initial={{ rotate: 90, opacity: 0 }}
                    animate={{ rotate: 0, opacity: 1 }}
                    exit={{ rotate: -90, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <Moon className="h-4 w-4" />
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.button>
          </TooltipTrigger>
          <TooltipContent className="text-[10px]">
            {isDark ? "Light mode" : "Dark mode"}
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <motion.button 
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              className="w-9 h-9 flex items-center justify-center rounded-m3-full text-on-surface-variant hover:bg-on-surface/[0.08] transition-colors duration-200 relative"
            >
              <Bell className="h-4 w-4" />
              <AnimatePresence>
                {hasNotifications && (
                  <motion.span 
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0 }}
                    className="absolute top-2 right-2 w-1.5 h-1.5 bg-primary rounded-full"
                  >
                    <motion.span
                      animate={{ scale: [1, 1.5, 1], opacity: [1, 0, 1] }}
                      transition={{ duration: 2, repeat: Infinity }}
                      className="absolute inset-0 w-full h-full bg-primary rounded-full"
                    />
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.button>
          </TooltipTrigger>
          <TooltipContent className="text-[10px]">
            Notifications
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <motion.div
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <Avatar className="h-8 w-8 cursor-pointer ring-2 ring-transparent hover:ring-primary/30 transition-all duration-200">
                <AvatarFallback className="bg-tertiary-container text-on-surface text-[11px]">
                  JD
                </AvatarFallback>
              </Avatar>
            </motion.div>
          </TooltipTrigger>
          <TooltipContent className="text-[10px]">
            John Doe
          </TooltipContent>
        </Tooltip>
      </motion.div>
    </motion.header>
  );
};

export default TopBar;
