import React from 'react';
import { useLocation } from 'react-router-dom';
import { ChevronRight, Home, Folder, Settings, HeartPulse, Link } from 'lucide-react';

const routeConfig = {
  '/': { title: 'Home', icon: Home, description: 'Welcome to Qonsol Policy Builder' },
  '/projects': { title: 'Prompts', icon: Folder, description: 'Manage your prompts and assistants' },
  '/settings': { title: 'Settings', icon: Settings, description: 'Configure application settings' },
  '/health': { title: 'Health Check', icon: HeartPulse, description: 'System health and diagnostics' },
  '/links': { title: 'Links', icon: Link, description: 'Manage links' },
};

export function ContextHeader({ breadcrumbs = [], actions }) {
  const location = useLocation();
  const currentRoute = routeConfig[location.pathname] || { title: 'Page', icon: Home };
  const Icon = currentRoute.icon;

  const allBreadcrumbs = [
    { label: currentRoute.title, icon: Icon },
    ...breadcrumbs
  ];

  return (
    <header className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border">
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex flex-col gap-1">
          {/* Breadcrumbs */}
          <nav className="flex items-center gap-1 text-sm">
            {allBreadcrumbs.map((crumb, index) => (
              <React.Fragment key={index}>
                {index > 0 && (
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                )}
                <span className={`flex items-center gap-1.5 ${
                  index === allBreadcrumbs.length - 1 
                    ? 'text-foreground font-medium' 
                    : 'text-muted-foreground hover:text-foreground transition-colors'
                }`}>
                  {crumb.icon && <crumb.icon className="h-3.5 w-3.5" />}
                  {crumb.label}
                </span>
              </React.Fragment>
            ))}
          </nav>
          
          {/* Description */}
          {currentRoute.description && breadcrumbs.length === 0 && (
            <p className="text-xs text-muted-foreground">
              {currentRoute.description}
            </p>
          )}
        </div>

        {/* Actions */}
        {actions && (
          <div className="flex items-center gap-2">
            {actions}
          </div>
        )}
      </div>
    </header>
  );
}

export default ContextHeader;
