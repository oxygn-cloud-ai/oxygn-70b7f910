import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Command, MessageCircleQuestion, Moon, Sun, LogOut } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useAuth } from "@/contexts/AuthContext";
import { ToastHistoryPopover } from "@/components/ToastHistoryPopover";
import { UndoHistoryPopover } from "@/components/UndoHistoryPopover";
import { useTooltipSettings } from "@/contexts/TooltipContext";

const TopBar = ({ 
  isDark = false, 
  onToggleDark,
  onOpenSearch,
  onUndoAction
}) => {
  const { tooltipsEnabled, toggleTooltips } = useTooltipSettings();
  const { user, userProfile, signOut, isAdmin } = useAuth();
  
  // Get user display info
  const displayName = userProfile?.display_name || user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User';
  const avatarUrl = userProfile?.avatar_url || user?.user_metadata?.avatar_url;
  const email = userProfile?.email || user?.email;
  const initials = displayName
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const handleSignOut = async () => {
    await signOut();
  };

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
              onClick={toggleTooltips}
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

        <UndoHistoryPopover onUndo={onUndoAction} />

        <ToastHistoryPopover />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <motion.div
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="cursor-pointer"
            >
              <Avatar className="h-8 w-8 ring-2 ring-transparent hover:ring-primary/30 transition-all duration-200">
                {avatarUrl && <AvatarImage src={avatarUrl} alt={displayName} />}
                <AvatarFallback className="bg-tertiary-container text-on-surface text-[11px]">
                  {initials}
                </AvatarFallback>
              </Avatar>
            </motion.div>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 bg-surface-container-high border-outline-variant">
            <div className="px-3 py-2">
              <p className="text-body-sm font-medium text-on-surface">{displayName}</p>
              <p className="text-[10px] text-on-surface-variant">{email}</p>
              {isAdmin && (
                <span className="inline-block mt-1 px-1.5 py-0.5 text-[9px] font-medium bg-primary/10 text-primary rounded-m3-sm">
                  ADMIN
                </span>
              )}
            </div>
            <DropdownMenuSeparator className="bg-outline-variant" />
            <DropdownMenuItem 
              onClick={handleSignOut}
              className="text-body-sm text-on-surface cursor-pointer"
            >
              <LogOut className="h-4 w-4 mr-2 text-on-surface-variant" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </motion.div>
    </motion.header>
  );
};

export default TopBar;
