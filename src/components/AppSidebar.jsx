import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Settings, FileText, Bot, Database, Home, Folder, HeartPulse, LogOut, ChevronLeft, User, Settings2, Cpu } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
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

const mainNavItems = [
  { id: 'home', title: 'Home', icon: Home, to: '/' },
  { id: 'prompts', title: 'Prompts', icon: Folder, to: '/projects' },
];

const settingsSubItems = [
  { id: 'qonsol', title: 'Qonsol Settings', icon: Settings },
  { id: 'naming', title: 'Prompt Naming', icon: FileText },
  { id: 'models', title: 'AI Models', icon: Bot },
  { id: 'assistants', title: 'Assistant Defaults', icon: Bot },
  { id: 'openai-assistants', title: 'OpenAI Assistants', icon: Cpu },
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
    <Sidebar collapsible="icon" className="border-r border-border">
      <SidebarHeader className="flex flex-col items-start gap-4 px-2 py-4 border-b border-border">
        <img 
          src="/head-striped-icon.png" 
          alt="Logo" 
          className="h-8 w-8"
        />
        <button
          onClick={toggleSidebar}
          className="p-1 rounded-md hover:bg-accent bg-transparent transition-transform"
        >
          <ChevronLeft className={`h-4 w-4 transition-transform ${isCollapsed ? 'rotate-180' : ''}`} />
        </button>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainNavItems.map((item) => (
                <SidebarMenuItem key={item.id}>
                  <SidebarMenuButton
                    asChild
                    isActive={location.pathname === item.to}
                    tooltip={item.title}
                  >
                    <Link to={item.to}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
              
              {/* Health with sub-menu */}
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={isOnHealth}
                  tooltip="Health"
                >
                  <Link to="/health">
                    <HeartPulse className="h-4 w-4" />
                    <span>Health</span>
                  </Link>
                </SidebarMenuButton>
                
                {/* Health sub-items - only show when on health page and not collapsed */}
                {isOnHealth && !isCollapsed && (
                  <SidebarMenuSub>
                    {healthSubItems.map((item) => (
                      <SidebarMenuSubItem key={item.id}>
                        <SidebarMenuSubButton
                          onClick={() => onHealthSectionChange?.(item.id)}
                          isActive={activeHealthSection === item.id}
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
                >
                  <Link to="/settings">
                    <Settings className="h-4 w-4" />
                    <span>Settings</span>
                  </Link>
                </SidebarMenuButton>
                
                {/* Settings sub-items - only show when on settings page and not collapsed */}
                {isOnSettings && !isCollapsed && (
                  <SidebarMenuSub>
                    {settingsSubItems.map((item) => (
                      <SidebarMenuSubItem key={item.id}>
                        <SidebarMenuSubButton
                          onClick={() => onSettingsSectionChange?.(item.id)}
                          isActive={activeSettingsSection === item.id}
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
      
      {user && (
        <SidebarFooter className="border-t border-border">
          {!isCollapsed && (
            <div className="px-2 py-1 text-xs text-muted-foreground truncate">
              {user.email}
            </div>
          )}
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                onClick={signOut}
                tooltip="Sign out"
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