/**
 * Layout Types
 * Type definitions for layout state and navigation
 */

/**
 * Navigation item identifiers
 */
export type NavId = 'prompts' | 'templates' | 'settings' | 'health' | 'deleted';

/**
 * Settings submenu item identifiers
 */
export type SettingsSubItem = 
  | 'qonsol' 
  | 'appearance' 
  | 'notifications' 
  | 'ai-models' 
  | 'manus'
  | 'integrations';

/**
 * Health submenu item identifiers
 */
export type HealthSubItem = 
  | 'overview' 
  | 'database' 
  | 'api' 
  | 'performance';

/**
 * Template tab identifiers
 */
export type TemplateTab = 'prompts' | 'schemas' | 'mappings';

/**
 * Panel visibility state
 */
export interface PanelState {
  folderPanelOpen: boolean;
  readingPaneOpen: boolean;
  conversationPanelOpen: boolean;
  navRailOpen: boolean;
  exportPanelOpen: boolean;
}

/**
 * Panel sizes (percentages or pixels)
 */
export interface PanelSizes {
  folderPanel: number;
  readingPane: number;
  conversationPanel: number;
}

/**
 * Layout state for persistence
 */
export interface LayoutState extends PanelState {
  activeNav: NavId;
  activeSubItem: string | null;
  isDark: boolean;
  panelSizes: PanelSizes;
}

/**
 * Navigation item configuration
 */
export interface NavItem {
  id: NavId;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  shortcut?: string;
  badge?: number | string;
  subItems?: SubMenuItem[];
}

/**
 * Submenu item configuration
 */
export interface SubMenuItem {
  id: string;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  shortcut?: string;
}

/**
 * Hover state for navigation
 */
export interface NavigationHoverState {
  hoveredNav: NavId | null;
  hoverTimeoutId: ReturnType<typeof setTimeout> | null;
}

/**
 * Layout context value
 */
export interface LayoutContextValue extends PanelState {
  // Setters
  setFolderPanelOpen: (open: boolean) => void;
  setReadingPaneOpen: (open: boolean) => void;
  setConversationPanelOpen: (open: boolean) => void;
  setNavRailOpen: (open: boolean) => void;
  setExportPanelOpen: (open: boolean) => void;
  
  // Navigation
  activeNav: NavId;
  setActiveNav: (nav: NavId) => void;
  activeSubItem: string | null;
  setActiveSubItem: (item: string | null) => void;
  
  // Theme
  isDark: boolean;
  toggleDark: () => void;
  
  // Toggles
  toggleFolderPanel: () => void;
  toggleReadingPane: () => void;
  toggleConversationPanel: () => void;
  toggleNavRail: () => void;
  toggleExportPanel: () => void;
  
  // Reset
  resetLayout: () => void;
}

/**
 * View mode for folder panel
 */
export type FolderViewMode = 'tree' | 'list';

/**
 * Sort options for prompts
 */
export type PromptSortOption = 
  | 'position' 
  | 'name' 
  | 'created_at' 
  | 'updated_at' 
  | 'starred';

/**
 * Sort direction
 */
export type SortDirection = 'asc' | 'desc';
