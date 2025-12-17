import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Settings, FileText, Bot, Database, Home, Folder, Paintbrush, HeartPulse, LogOut } from 'lucide-react';
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
  { id: 'studio', title: 'Studio', icon: Paintbrush, to: '/studio' },
  { id: 'health', title: 'Health', icon: HeartPulse, to: '/health' },
];

const settingsSubItems = [
  { id: 'qonsol', title: 'Qonsol Settings', icon: Settings },
  { id: 'naming', title: 'Prompt Naming', icon: FileText },
  { id: 'models', title: 'AI Models', icon: Bot },
  { id: 'database', title: 'Database & Env', icon: Database },
];

export function AppSidebar({ activeSettingsSection, onSettingsSectionChange }) {
  const { state } = useSidebar();
  const location = useLocation();
  const { user, signOut } = useAuth();
  const isCollapsed = state === 'collapsed';
  const isOnSettings = location.pathname === '/settings';

  return (
    <Sidebar collapsible="icon" className="border-r border-border">
      <SidebarHeader className="h-14 flex items-center justify-center border-b border-border">
        <img 
          src="/head-striped-icon.png" 
          alt="Logo" 
          className="h-8 w-8"
        />
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
