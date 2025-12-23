import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Settings, FileText, Bot, Database, Home, Folder, HeartPulse, LogOut, ChevronLeft, User, Settings2, Cpu, FileStack, Plus, LayoutTemplate, Palette, MessageCircle, MessageCircleOff, CreditCard, MessagesSquare, HelpCircle, BookOpen } from 'lucide-react';
import { SlackIcon } from '@/components/icons/SlackIcon';
import { useAuth } from '@/contexts/AuthContext';
import { useTooltipSettings } from '@/contexts/TooltipContext';
import GuardedLink from '@/components/GuardedLink';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import { ToastHistoryPopover } from "@/components/ToastHistoryPopover";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { ExportDrawer } from '@/components/export';
import { useExport } from '@/hooks/useExport';
import { useConfluenceExport } from '@/hooks/useConfluenceExport';
import useTreeData from '@/hooks/useTreeData';
import { supabase } from '@/integrations/supabase/client';

const mainNavItems = [
  { id: 'home', title: 'Home', icon: Home, to: '/' },
  { id: 'prompts', title: 'Prompts', icon: Folder, to: '/projects', badge: null },
  { id: 'workbench', title: 'Workbench', icon: MessagesSquare, to: '/workbench', badge: null },
  { id: 'templates', title: 'Templates', icon: LayoutTemplate, to: '/templates', badge: null },
];

const settingsSubItems = [
  { id: 'qonsol', title: 'Qonsol Settings', icon: Settings },
  { id: 'naming', title: 'Prompt Naming', icon: FileText },
  { id: 'models', title: 'AI Models', icon: Bot },
  { id: 'assistants', title: 'Conversation Defaults', icon: Bot },
  { id: 'workbench', title: 'Workbench', icon: MessagesSquare },
  { id: 'conversations', title: 'Conversations', icon: Cpu },
  { id: 'confluence', title: 'Confluence', icon: FileStack },
  { id: 'cost-analytics', title: 'Cost Analytics', icon: Database },
  { id: 'openai-billing', title: 'OpenAI Billing', icon: CreditCard },
  { id: 'database', title: 'Database & Env', icon: Database },
  { id: 'appearance', title: 'Appearance', icon: Palette },
];

const healthSubItems = [
  { id: 'database', title: 'Database', icon: Database },
  { id: 'auth', title: 'Authentication', icon: User },
  { id: 'ai', title: 'AI API', icon: Bot },
  { id: 'environment', title: 'Environment', icon: Settings2 },
];

const helpSubItems = [
  { id: 'documentation', title: 'Documentation', icon: BookOpen, url: 'https://chocfin.atlassian.net/wiki/spaces/COM/pages/1582628910/' },
  { id: 'support', title: 'Support', icon: SlackIcon, url: 'slack://channel?team=T02C3QE9R&id=C07M3Q5PRLT' },
];

// Help menu item with toggle functionality
const HelpMenuItem = ({ isCollapsed }) => {
  const [isHelpExpanded, setIsHelpExpanded] = useState(false);
  
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        onClick={() => setIsHelpExpanded(!isHelpExpanded)}
        tooltip="Help"
        className="group"
      >
        <HelpCircle className="h-4 w-4 transition-colors text-sidebar-foreground/70 group-hover:text-sidebar-foreground" />
        <span>Help</span>
      </SidebarMenuButton>
      
      {isHelpExpanded && !isCollapsed && (
        <SidebarMenuSub className="ml-4 mt-1 border-l border-sidebar-border pl-3 space-y-0.5">
          {helpSubItems.map((item) => (
            <SidebarMenuSubItem key={item.id}>
              <SidebarMenuSubButton
                onClick={() => window.open(item.url, '_blank')}
                className="text-xs text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent cursor-pointer"
              >
                <item.icon className="h-3 w-3" />
                <span>{item.title}</span>
              </SidebarMenuSubButton>
            </SidebarMenuSubItem>
          ))}
        </SidebarMenuSub>
      )}
    </SidebarMenuItem>
  );
};

export function AppSidebar({ activeSettingsSection, onSettingsSectionChange, activeHealthSection, onHealthSectionChange, onCreatePrompt }) {
  const { state, toggleSidebar } = useSidebar();
  const location = useLocation();
  const { user, signOut, userProfile } = useAuth();
  const { tooltipsEnabled, toggleTooltips } = useTooltipSettings();
  const isCollapsed = state === 'collapsed';
  const isOnSettings = location.pathname === '/settings';
  const isOnHealth = location.pathname === '/health';

  // Export functionality
  const { treeData, refreshTreeData } = useTreeData(supabase);
  const exportState = useExport();
  const confluenceExport = useConfluenceExport();

  // Refresh tree data when export drawer opens
  useEffect(() => {
    if (exportState.isOpen) {
      refreshTreeData();
    }
  }, [exportState.isOpen, refreshTreeData]);

  const getInitials = () => {
    if (userProfile?.display_name) {
      return userProfile.display_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
    }
    if (user?.email) {
      return user.email[0].toUpperCase();
    }
    return 'U';
  };

  return (
    <>
      <ExportDrawer
        isOpen={exportState.isOpen}
        onClose={exportState.closeExport}
        currentStep={exportState.currentStep}
        selectedPromptIds={exportState.selectedPromptIds}
        selectedFields={exportState.selectedFields}
        selectedVariables={exportState.selectedVariables}
        exportType={exportState.exportType}
        promptsData={exportState.promptsData}
        variablesData={exportState.variablesData}
        treeData={treeData}
        isLoadingPrompts={exportState.isLoadingPrompts}
        isLoadingVariables={exportState.isLoadingVariables}
        canProceed={exportState.canProceed}
        onGoBack={exportState.goBack}
        onGoNext={exportState.goNext}
        onTogglePrompt={exportState.togglePromptSelection}
        onSelectAllPrompts={exportState.selectAllPrompts}
        onClearPrompts={exportState.clearPromptSelection}
        onToggleField={exportState.toggleFieldSelection}
        onToggleVariable={exportState.toggleVariableSelection}
        onSetExportType={exportState.setExportType}
        onFetchPrompts={exportState.fetchPromptsData}
        onFetchVariables={exportState.fetchVariablesData}
        getExportData={exportState.getExportData}
        EXPORT_STEPS={exportState.EXPORT_STEPS}
        EXPORT_TYPES={exportState.EXPORT_TYPES}
        STANDARD_FIELDS={exportState.STANDARD_FIELDS}
        confluenceExport={confluenceExport}
      />
    <Sidebar collapsible="icon" className="border-r border-sidebar-border bg-sidebar">
      {/* Header with Logo */}
      <SidebarHeader className="flex flex-col items-start gap-3 px-3 py-4 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <img 
            src="/favicon.png" 
            alt="Chocolate Logo" 
            className="h-8 w-8 flex-shrink-0 object-contain transition-transform hover:scale-105"
          />
          {!isCollapsed && (
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-sidebar-foreground">Qonsol</span>
              <span className="text-[10px] text-primary font-medium">Policy Builder 7</span>
            </div>
          )}
        </div>
        <button
          onClick={toggleSidebar}
          className="p-1.5 rounded-md hover:bg-sidebar-accent text-sidebar-foreground/70 hover:text-sidebar-foreground transition-all"
          aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <ChevronLeft className={`h-4 w-4 transition-transform duration-200 ${isCollapsed ? 'rotate-180' : ''}`} />
        </button>
      </SidebarHeader>

      <SidebarContent className="px-2 py-3">
        {/* Main Navigation */}
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-1">
            {mainNavItems.map((item) => (
                <SidebarMenuItem key={item.id}>
                  <SidebarMenuButton
                    asChild
                    isActive={location.pathname === item.to}
                    tooltip={item.title}
                    className="group relative"
                  >
                    <GuardedLink to={item.to} className="flex items-center gap-3">
                      <item.icon className={`h-4 w-4 transition-colors ${
                        location.pathname === item.to ? 'text-primary' : 'text-sidebar-foreground/70 group-hover:text-sidebar-foreground'
                      }`} />
                      <span className="flex-1">{item.title}</span>
                      {item.badge && !isCollapsed && (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                          {item.badge}
                        </Badge>
                      )}
                      {item.id === 'prompts' && !isCollapsed && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              className="h-6 w-6 inline-flex items-center justify-center rounded-md opacity-0 group-hover:opacity-100 transition-opacity text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                              aria-label="Create new prompt"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                onCreatePrompt?.();
                              }}
                            >
                              <Plus className="h-3.5 w-3.5" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="right">
                            <p>Create new prompt</p>
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </GuardedLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* System Section - Health & Settings at bottom */}
        <SidebarGroup className="mt-auto">
          <SidebarGroupContent>
            <SidebarMenu className="space-y-1">
              {/* Health with sub-menu */}
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={isOnHealth}
                  tooltip="Health"
                  className="group"
                >
                  <GuardedLink to="/health" className="flex items-center gap-3">
                    <HeartPulse className={`h-4 w-4 transition-colors ${
                      isOnHealth ? 'text-primary' : 'text-sidebar-foreground/70 group-hover:text-sidebar-foreground'
                    }`} />
                    <span>Health</span>
                  </GuardedLink>
                </SidebarMenuButton>
                
                {isOnHealth && !isCollapsed && (
                  <SidebarMenuSub className="ml-4 mt-1 border-l border-sidebar-border pl-3 space-y-0.5">
                    {healthSubItems.map((item) => (
                      <SidebarMenuSubItem key={item.id}>
                        <SidebarMenuSubButton
                          onClick={() => onHealthSectionChange?.(item.id)}
                          isActive={activeHealthSection === item.id}
                          className={`text-xs ${
                            activeHealthSection === item.id 
                              ? 'text-primary font-medium bg-primary/10' 
                              : 'text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent'
                          }`}
                        >
                          <item.icon className="h-3 w-3" />
                          <span>{item.title}</span>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                    ))}
                  </SidebarMenuSub>
                )}
              </SidebarMenuItem>
              
              {/* Settings with sub-menu */}
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={isOnSettings}
                  tooltip="Settings"
                  className="group"
                >
                  <GuardedLink to="/settings" className="flex items-center gap-3">
                    <Settings className={`h-4 w-4 transition-colors ${
                      isOnSettings ? 'text-primary' : 'text-sidebar-foreground/70 group-hover:text-sidebar-foreground'
                    }`} />
                    <span>Settings</span>
                  </GuardedLink>
                </SidebarMenuButton>
                
                {isOnSettings && !isCollapsed && (
                  <SidebarMenuSub className="ml-4 mt-1 border-l border-sidebar-border pl-3 space-y-0.5">
                    {settingsSubItems.map((item) => (
                      <SidebarMenuSubItem key={item.id}>
                        <SidebarMenuSubButton
                          onClick={() => onSettingsSectionChange?.(item.id)}
                          isActive={activeSettingsSection === item.id}
                          className={`text-xs ${
                            activeSettingsSection === item.id 
                              ? 'text-primary font-medium bg-primary/10' 
                              : 'text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent'
                          }`}
                        >
                          <item.icon className="h-3 w-3" />
                          <span>{item.title}</span>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                    ))}
                  </SidebarMenuSub>
                )}
              </SidebarMenuItem>

              {/* Help with expandable sub-menu */}
              <HelpMenuItem isCollapsed={isCollapsed} />
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      
      {/* Footer with User */}
      {user && (
        <SidebarFooter className="border-t border-sidebar-border p-3">
          {!isCollapsed ? (
            <div className="flex items-center gap-3 px-1 py-1.5 mb-2">
              <Avatar className="h-8 w-8 border border-sidebar-border">
                <AvatarImage src={userProfile?.avatar_url} alt={userProfile?.display_name || user.email} />
                <AvatarFallback className="bg-primary/10 text-primary text-xs font-medium">
                  {getInitials()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                {userProfile?.display_name && (
                  <p className="text-xs font-medium text-sidebar-foreground truncate">
                    {userProfile.display_name}
                  </p>
                )}
                <p className="text-[10px] text-sidebar-foreground/60 truncate">
                  {user.email}
                </p>
              </div>
            </div>
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex justify-center mb-2">
                  <Avatar className="h-8 w-8 border border-sidebar-border cursor-pointer">
                    <AvatarImage src={userProfile?.avatar_url} alt={userProfile?.display_name || user.email} />
                    <AvatarFallback className="bg-primary/10 text-primary text-xs font-medium">
                      {getInitials()}
                    </AvatarFallback>
                  </Avatar>
                </div>
              </TooltipTrigger>
              <TooltipContent side="right">
                <p className="font-medium">{userProfile?.display_name || user.email}</p>
                {userProfile?.display_name && <p className="text-xs text-muted-foreground">{user.email}</p>}
              </TooltipContent>
            </Tooltip>
          )}
          <div className="flex items-center justify-between gap-1">
            <ToastHistoryPopover />
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={toggleTooltips}
                    className={`h-8 w-8 transition-colors ${
                      tooltipsEnabled 
                        ? 'text-primary hover:text-primary hover:bg-primary/10' 
                        : 'text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent'
                    }`}
                  >
                    {tooltipsEnabled ? (
                      <MessageCircle className="h-4 w-4" />
                    ) : (
                      <MessageCircleOff className="h-4 w-4" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">
                  {tooltipsEnabled ? 'Disable tooltips' : 'Enable tooltips'}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={signOut}
                    className="h-8 w-8 text-sidebar-foreground/70 hover:text-destructive hover:bg-destructive/10 transition-colors"
                  >
                    <LogOut className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">
                  Sign out
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </SidebarFooter>
      )}
    </Sidebar>
    </>
  );
}
