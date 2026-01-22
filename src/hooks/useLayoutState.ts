import { useState, useEffect, useCallback, useRef } from 'react';
import { getThemePreference } from '@/components/ui/sonner';

/**
 * Hook to manage layout panel states with localStorage persistence.
 * Extracts all panel visibility/toggle state from MainLayout.
 */
export const useLayoutState = () => {
  // Theme state
  const [isDark, setIsDark] = useState(() => {
    const pref = getThemePreference();
    if (pref === 'system') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return pref === 'dark';
  });
  
  // Layout reset nonce for forcing panel group remount
  const [layoutResetNonce, setLayoutResetNonce] = useState(0);
  
  // Panel visibility states with localStorage persistence
  const [folderPanelOpen, setFolderPanelOpen] = useState(() => {
    try {
      const saved = localStorage.getItem('qonsol-folder-panel-open');
      return saved !== null ? saved === 'true' : true;
    } catch {
      return true;
    }
  });
  
  const [navRailOpen, setNavRailOpen] = useState(() => {
    try {
      const saved = localStorage.getItem('qonsol-nav-rail-open');
      return saved !== null ? saved === 'true' : true;
    } catch {
      return true;
    }
  });
  
  const [readingPaneOpen, setReadingPaneOpen] = useState(() => {
    try {
      const saved = localStorage.getItem('qonsol-reading-pane-open');
      return saved !== null ? saved === 'true' : true;
    } catch {
      return true;
    }
  });
  
  const [conversationPanelOpen, setConversationPanelOpen] = useState(() => {
    try {
      const saved = localStorage.getItem('qonsol-conversation-panel-open');
      return saved !== null ? saved === 'true' : false;
    } catch {
      return false;
    }
  });
  
  // Navigation state
  const [activeNav, setActiveNav] = useState(() => {
    try {
      const saved = localStorage.getItem('qonsol-active-nav');
      return saved || 'prompts';
    } catch {
      return 'prompts';
    }
  });
  
  const [activeSubItem, setActiveSubItem] = useState(null);
  const [hoveredNav, setHoveredNav] = useState(null);
  
  // Template state
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [activeTemplateTab, setActiveTemplateTab] = useState('prompts');
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [saveAsTemplateDialogOpen, setSaveAsTemplateDialogOpen] = useState(false);
  const [saveAsTemplateSource, setSaveAsTemplateSource] = useState(null);
  
  // Initial load state
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  
  // Refs for hover management
  const submenuRef = useRef(null);
  const hoverTimeoutRef = useRef(null);
  
  // Persist panel states to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('qonsol-folder-panel-open', String(folderPanelOpen));
    } catch {}
  }, [folderPanelOpen]);
  
  useEffect(() => {
    try {
      localStorage.setItem('qonsol-nav-rail-open', String(navRailOpen));
    } catch {}
  }, [navRailOpen]);
  
  useEffect(() => {
    try {
      localStorage.setItem('qonsol-reading-pane-open', String(readingPaneOpen));
    } catch {}
  }, [readingPaneOpen]);
  
  useEffect(() => {
    try {
      localStorage.setItem('qonsol-conversation-panel-open', String(conversationPanelOpen));
    } catch {}
  }, [conversationPanelOpen]);
  
  useEffect(() => {
    try {
      localStorage.setItem('qonsol-active-nav', activeNav);
    } catch {}
  }, [activeNav]);
  
  // Reset layout to defaults
  const handleResetLayout = useCallback(() => {
    setNavRailOpen(true);
    setFolderPanelOpen(true);
    setReadingPaneOpen(true);
    setConversationPanelOpen(true);
    
    try {
      localStorage.setItem('qonsol-nav-rail-open', 'true');
      localStorage.setItem('qonsol-folder-panel-open', 'true');
      localStorage.setItem('qonsol-reading-pane-open', 'true');
      localStorage.setItem('qonsol-conversation-panel-open', 'true');
      
      // Clear ResizablePanelGroup persisted layout
      Object.keys(localStorage).forEach(key => {
        if (key.includes('qonsol-panel-layout')) {
          localStorage.removeItem(key);
        }
      });
    } catch {}
    
    setLayoutResetNonce(prev => prev + 1);
  }, []);
  
  // Handler for save as template
  const handleSaveAsTemplate = useCallback((promptId, promptName, hasChildren) => {
    setSaveAsTemplateSource({ id: promptId, name: promptName, hasChildren });
    setSaveAsTemplateDialogOpen(true);
  }, []);
  
  return {
    // Theme
    isDark,
    setIsDark,
    
    // Layout
    layoutResetNonce,
    handleResetLayout,
    
    // Panel visibility
    folderPanelOpen,
    setFolderPanelOpen,
    navRailOpen,
    setNavRailOpen,
    readingPaneOpen,
    setReadingPaneOpen,
    conversationPanelOpen,
    setConversationPanelOpen,
    
    // Navigation
    activeNav,
    setActiveNav,
    activeSubItem,
    setActiveSubItem,
    hoveredNav,
    setHoveredNav,
    
    // Templates
    selectedTemplate,
    setSelectedTemplate,
    activeTemplateTab,
    setActiveTemplateTab,
    
    // Dialogs/Modals (search removed - replaced by LiveApiDashboard)
    templateDialogOpen,
    setTemplateDialogOpen,
    saveAsTemplateDialogOpen,
    setSaveAsTemplateDialogOpen,
    saveAsTemplateSource,
    setSaveAsTemplateSource,
    handleSaveAsTemplate,
    
    // Loading
    isInitialLoad,
    setIsInitialLoad,
    
    // Refs
    submenuRef,
    hoverTimeoutRef,
  };
};

export default useLayoutState;
