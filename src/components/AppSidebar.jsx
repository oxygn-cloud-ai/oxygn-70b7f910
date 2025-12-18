import React from 'react';
import { useLocation } from 'react-router-dom';
import { Settings, FileText, Bot, Database, Home, Folder, HeartPulse, LogOut, ChevronLeft, User, Settings2, Cpu, FileStack } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
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

const mainNavItems = [
  { id: 'home', title: 'Home', icon: Home, to: '/' },
  { id: 'prompts', title: 'Prompts', icon: Folder, to: '/projects', badge: null },
];

const settingsSubItems = [
  { id: 'qonsol', title: 'Qonsol Settings', icon: Settings },
  { id: 'naming', title: 'Prompt Naming', icon: FileText },
  { id: 'models', title: 'AI Models', icon: Bot },
  { id: 'assistants', title: 'Assistant Defaults', icon: Bot },
  { id: 'openai-assistants', title: 'OpenAI Assistants', icon: Cpu },
  { id: 'confluence', title: 'Confluence', icon: FileStack },
  { id: 'database', title: 'Database & Env', icon: Database },
];

const healthSubItems = [
  { id: 'database', title: 'Database', icon: Database },
  { id: 'auth', title: 'Authentication', icon: User },
  { id: 'openai', title: 'OpenAI API', icon: Bot },
  { id: 'environment', title: 'Environment', icon: Settings2 },
];

export function AppSidebar({ activeSettingsSection, onSettingsSectionChange, activeHealthSection, onHealthSectionChange }) {
  const { state, toggleSidebar } = useSidebar();
  const location = useLocation();
  const { user, signOut } = useAuth();
  const isCollapsed = state === 'collapsed';
  const isOnSettings = location.pathname === '/settings';
  const isOnHealth = location.pathname === '/health';

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border bg-sidebar">
      {/* Header with Logo */}
      <SidebarHeader className="flex flex-col items-start gap-3 px-3 py-4 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <img 
            src="/head-striped-icon.png" 
            alt="Qonsol Logo" 
            className="h-8 w-8 transition-transform hover:scale-105"
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
          {!isCollapsed && (
            <SidebarGroupLabel className="text-[10px] uppercase tracking-wider text-sidebar-foreground/50 font-medium mb-2">
              Navigation
            </SidebarGroupLabel>
          )}
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
                    </GuardedLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* System Section */}
        <SidebarGroup className="mt-4">
          {!isCollapsed && (
            <SidebarGroupLabel className="text-[10px] uppercase tracking-wider text-sidebar-foreground/50 font-medium mb-2">
              System
            </SidebarGroupLabel>
          )}
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
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      
      {/* Footer with User */}
      {user && (
        <SidebarFooter className="border-t border-sidebar-border p-3">
          {!isCollapsed && (
            <div className="px-1 py-1.5 mb-2">
              <p className="text-[10px] uppercase tracking-wider text-sidebar-foreground/50 font-medium">Signed in as</p>
              <p className="text-xs text-sidebar-foreground truncate mt-0.5">
                {user.email}
              </p>
            </div>
          )}
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                onClick={signOut}
                tooltip="Sign out"
                className="text-sidebar-foreground/70 hover:text-destructive hover:bg-destructive/10 transition-colors"
              >
                <LogOut className="h-4 w-4" />
                <span>Sign out</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      )}
    </Sidebar>
  );
}
