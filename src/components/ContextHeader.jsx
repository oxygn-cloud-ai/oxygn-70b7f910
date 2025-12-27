import React from 'react';
import { useLocation } from 'react-router-dom';
import { ChevronRight, Home, Folder, Settings, HeartPulse, Link } from 'lucide-react';

const routeConfig = {
  '/': { title: 'Home', icon: Home, description: 'Welcome to Qonsol Policy Builder' },
  '/projects': { title: 'Prompts', icon: Folder, description: 'Manage your prompts and conversations' },
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
    <header className="sticky top-0 z-10 bg-surface-container/95 backdrop-blur supports-[backdrop-filter]:bg-surface-container/80 border-b border-outline-variant">
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex flex-col gap-1">
          {/* Breadcrumbs */}
          <nav className="flex items-center gap-1 text-label-medium">
            {allBreadcrumbs.map((crumb, index) => (
              <React.Fragment key={index}>
                {index > 0 && (
                  <ChevronRight className="h-4 w-4 text-on-surface-variant" />
                )}
                <span className={`flex items-center gap-1.5 transition-colors duration-medium-1 ${
                  index === allBreadcrumbs.length - 1 
                    ? 'text-on-surface font-medium' 
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}>
                  {crumb.icon && <crumb.icon className="h-4 w-4" />}
                  {crumb.label}
                </span>
              </React.Fragment>
            ))}
          </nav>
          
          {/* Description */}
          {currentRoute.description && breadcrumbs.length === 0 && (
            <p className="text-body-small text-on-surface-variant">
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
