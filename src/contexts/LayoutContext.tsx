import React, { createContext, useContext, useState, useCallback, useEffect, useRef, ReactNode } from 'react';
import { getThemePreference } from '@/components/ui/sonner';

// ============= Types =============
export interface LayoutState {
  // Theme
  isDark: boolean;
  
  // Panel visibility
  folderPanelOpen: boolean;
  navRailOpen: boolean;
  readingPaneOpen: boolean;
  conversationPanelOpen: boolean;
  
  // Navigation
  activeNav: string;
  activeSubItem: string | null;
  hoveredNav: string | null;
  
  // Templates
  selectedTemplateId: string | null;
  activeTemplateTab: string;
  
  // Dialogs
  templateDialogOpen: boolean;
  saveAsTemplateDialogOpen: boolean;
  
  // Loading
  isInitialLoad: boolean;
  
  // Layout reset nonce
  layoutResetNonce: number;
}

export interface SaveAsTemplateSource {
  id: string;
  name: string;
  hasChildren: boolean;
}

export interface LayoutContextValue extends LayoutState {
  // Theme actions
  setIsDark: (value: boolean) => void;
  toggleDark: () => void;
  
  // Panel actions
  setFolderPanelOpen: (value: boolean) => void;
  toggleFolderPanel: () => void;
  setNavRailOpen: (value: boolean) => void;
  toggleNavRail: () => void;
  setReadingPaneOpen: (value: boolean) => void;
  toggleReadingPane: () => void;
  setConversationPanelOpen: (value: boolean) => void;
  toggleConversationPanel: () => void;
  
  // Navigation actions
  setActiveNav: (value: string) => void;
  setActiveSubItem: (value: string | null) => void;
  setHoveredNav: (value: string | null) => void;
  
  // Template actions
  setSelectedTemplateId: (value: string | null) => void;
  setActiveTemplateTab: (value: string) => void;
  
  // Dialog actions
  setTemplateDialogOpen: (value: boolean) => void;
  setSaveAsTemplateDialogOpen: (value: boolean) => void;
  saveAsTemplateSource: SaveAsTemplateSource | null;
  setSaveAsTemplateSource: (value: SaveAsTemplateSource | null) => void;
  handleSaveAsTemplate: (promptId: string, promptName: string, hasChildren: boolean) => void;
  
  // Loading actions
  setIsInitialLoad: (value: boolean) => void;
  
  // Layout reset
  handleResetLayout: () => void;
  
  // Refs for hover management
  submenuRef: React.RefObject<HTMLDivElement>;
  hoverTimeoutRef: React.MutableRefObject<ReturnType<typeof setTimeout> | null>;
  
  // Computed properties
  showConversationPanel: boolean;
  displayedNav: string;
}

// ============= Context =============
const LayoutContext = createContext<LayoutContextValue | null>(null);

// ============= Hook =============
export const useLayout = (): LayoutContextValue => {
  const context = useContext(LayoutContext);
  if (!context) {
    throw new Error('useLayout must be used within a LayoutProvider');
  }
  return context;
};

// ============= Utility Functions =============
const getStoredBoolean = (key: string, defaultValue: boolean): boolean => {
  try {
    const saved = localStorage.getItem(key);
    return saved !== null ? saved === 'true' : defaultValue;
  } catch {
    return defaultValue;
  }
};

const getStoredString = (key: string, defaultValue: string): string => {
  try {
    return localStorage.getItem(key) || defaultValue;
  } catch {
    return defaultValue;
  }
};

const setStoredValue = (key: string, value: string): void => {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Silently ignore storage errors
  }
};

// ============= Provider =============
interface LayoutProviderProps {
  children: ReactNode;
}

export const LayoutProvider: React.FC<LayoutProviderProps> = ({ children }) => {
  // Theme state
  const [isDark, setIsDark] = useState<boolean>(() => {
    const pref = getThemePreference();
    if (pref === 'system') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return pref === 'dark';
  });

  // Layout reset nonce for forcing panel group remount
  const [layoutResetNonce, setLayoutResetNonce] = useState(0);

  // Panel visibility states with localStorage persistence
  const [folderPanelOpen, setFolderPanelOpen] = useState(() => 
    getStoredBoolean('qonsol-folder-panel-open', true)
  );
  const [navRailOpen, setNavRailOpen] = useState(() => 
    getStoredBoolean('qonsol-nav-rail-open', true)
  );
  const [readingPaneOpen, setReadingPaneOpen] = useState(() => 
    getStoredBoolean('qonsol-reading-pane-open', true)
  );
  const [conversationPanelOpen, setConversationPanelOpen] = useState(() => 
    getStoredBoolean('qonsol-conversation-panel-open', false)
  );

  // Navigation state
  const [activeNav, setActiveNav] = useState(() => 
    getStoredString('qonsol-active-nav', 'prompts')
  );
  const [activeSubItem, setActiveSubItem] = useState<string | null>(null);
  const [hoveredNav, setHoveredNav] = useState<string | null>(null);

  // Template state
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [activeTemplateTab, setActiveTemplateTab] = useState('prompts');
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [saveAsTemplateDialogOpen, setSaveAsTemplateDialogOpen] = useState(false);
  const [saveAsTemplateSource, setSaveAsTemplateSource] = useState<SaveAsTemplateSource | null>(null);

  // Initial load state
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  // Refs for hover management
  const submenuRef = useRef<HTMLDivElement>(null);
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Persist panel states to localStorage
  useEffect(() => {
    setStoredValue('qonsol-folder-panel-open', String(folderPanelOpen));
  }, [folderPanelOpen]);

  useEffect(() => {
    setStoredValue('qonsol-nav-rail-open', String(navRailOpen));
  }, [navRailOpen]);

  useEffect(() => {
    setStoredValue('qonsol-reading-pane-open', String(readingPaneOpen));
  }, [readingPaneOpen]);

  useEffect(() => {
    setStoredValue('qonsol-conversation-panel-open', String(conversationPanelOpen));
  }, [conversationPanelOpen]);

  useEffect(() => {
    setStoredValue('qonsol-active-nav', activeNav);
  }, [activeNav]);

  // Toggle functions
  const toggleDark = useCallback(() => setIsDark(prev => !prev), []);
  const toggleFolderPanel = useCallback(() => setFolderPanelOpen(prev => !prev), []);
  const toggleNavRail = useCallback(() => setNavRailOpen(prev => !prev), []);
  const toggleReadingPane = useCallback(() => setReadingPaneOpen(prev => !prev), []);
  const toggleConversationPanel = useCallback(() => setConversationPanelOpen(prev => !prev), []);

  // Reset layout to defaults
  const handleResetLayout = useCallback(() => {
    setNavRailOpen(true);
    setFolderPanelOpen(true);
    setReadingPaneOpen(true);
    setConversationPanelOpen(true);

    setStoredValue('qonsol-nav-rail-open', 'true');
    setStoredValue('qonsol-folder-panel-open', 'true');
    setStoredValue('qonsol-reading-pane-open', 'true');
    setStoredValue('qonsol-conversation-panel-open', 'true');

    // Clear ResizablePanelGroup persisted layout
    try {
      Object.keys(localStorage).forEach(key => {
        if (key.includes('qonsol-panel-layout')) {
          localStorage.removeItem(key);
        }
      });
    } catch {}

    setLayoutResetNonce(prev => prev + 1);
  }, []);

  // Handler for save as template
  const handleSaveAsTemplate = useCallback((promptId: string, promptName: string, hasChildren: boolean) => {
    setSaveAsTemplateSource({ id: promptId, name: promptName, hasChildren });
    setSaveAsTemplateDialogOpen(true);
  }, []);

  // Computed properties
  const showConversationPanel = activeNav === 'prompts' && conversationPanelOpen;
  const displayedNav = hoveredNav || activeNav;

  // Clear selected template when switching away from templates nav
  useEffect(() => {
    if (activeNav !== 'templates') {
      setSelectedTemplateId(null);
    }
  }, [activeNav]);

  // Clear sub-item when switching nav, and set defaults for settings/health
  useEffect(() => {
    if (activeNav === 'prompts' || activeNav === 'templates') {
      setActiveSubItem(null);
    } else if (activeNav === 'settings' && !activeSubItem) {
      setActiveSubItem('qonsol');
    } else if (activeNav === 'health' && !activeSubItem) {
      setActiveSubItem('overview');
    }
  }, [activeNav, activeSubItem]);

  // Auto-open reading pane for views that always need it
  useEffect(() => {
    const viewsRequiringReadingPane = ['templates', 'settings', 'health'];
    if (viewsRequiringReadingPane.includes(activeNav)) {
      setReadingPaneOpen(true);
    }
  }, [activeNav]);

  // Auto-open folder panel for views that use it
  useEffect(() => {
    const viewsRequiringFolderPanel = ['templates', 'prompts'];
    if (viewsRequiringFolderPanel.includes(activeNav)) {
      setFolderPanelOpen(true);
    }
  }, [activeNav]);

  // Cleanup hover timeout on unmount
  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
    };
  }, []);

  const value: LayoutContextValue = {
    // State
    isDark,
    folderPanelOpen,
    navRailOpen,
    readingPaneOpen,
    conversationPanelOpen,
    activeNav,
    activeSubItem,
    hoveredNav,
    selectedTemplateId,
    activeTemplateTab,
    templateDialogOpen,
    saveAsTemplateDialogOpen,
    isInitialLoad,
    layoutResetNonce,

    // Theme actions
    setIsDark,
    toggleDark,

    // Panel actions
    setFolderPanelOpen,
    toggleFolderPanel,
    setNavRailOpen,
    toggleNavRail,
    setReadingPaneOpen,
    toggleReadingPane,
    setConversationPanelOpen,
    toggleConversationPanel,

    // Navigation actions
    setActiveNav,
    setActiveSubItem,
    setHoveredNav,

    // Template actions
    setSelectedTemplateId,
    setActiveTemplateTab,

    // Dialog actions
    setTemplateDialogOpen,
    setSaveAsTemplateDialogOpen,
    saveAsTemplateSource,
    setSaveAsTemplateSource,
    handleSaveAsTemplate,

    // Loading actions
    setIsInitialLoad,

    // Layout reset
    handleResetLayout,

    // Refs
    submenuRef,
    hoverTimeoutRef,

    // Computed
    showConversationPanel,
    displayedNav,
  };

  return (
    <LayoutContext.Provider value={value}>
      {children}
    </LayoutContext.Provider>
  );
};

export default LayoutContext;
