/**
 * useLayoutState Hook (TypeScript)
 * 
 * Thin re-export for backwards compatibility.
 * The actual implementation now lives in LayoutContext.tsx.
 * 
 * This file maintains API compatibility with existing imports while
 * the codebase transitions to using useLayout from LayoutContext directly.
 */

import { useLayout } from '@/contexts/LayoutContext';

// Re-export useLayout as useLayoutState for backwards compatibility
export const useLayoutState = () => {
  const layout = useLayout();
  
  // Map to the old API structure for compatibility
  return {
    // Theme
    isDark: layout.isDark,
    setIsDark: layout.setIsDark,
    
    // Layout
    layoutResetNonce: layout.layoutResetNonce,
    handleResetLayout: layout.handleResetLayout,
    
    // Panel visibility
    folderPanelOpen: layout.folderPanelOpen,
    setFolderPanelOpen: layout.setFolderPanelOpen,
    navRailOpen: layout.navRailOpen,
    setNavRailOpen: layout.setNavRailOpen,
    readingPaneOpen: layout.readingPaneOpen,
    setReadingPaneOpen: layout.setReadingPaneOpen,
    conversationPanelOpen: layout.conversationPanelOpen,
    setConversationPanelOpen: layout.setConversationPanelOpen,
    
    // Navigation
    activeNav: layout.activeNav,
    setActiveNav: layout.setActiveNav,
    activeSubItem: layout.activeSubItem,
    setActiveSubItem: layout.setActiveSubItem,
    hoveredNav: layout.hoveredNav,
    setHoveredNav: layout.setHoveredNav,
    
    // Templates - map selectedTemplateId to selectedTemplate object pattern
    selectedTemplate: layout.selectedTemplateId ? { row_id: layout.selectedTemplateId, id: layout.selectedTemplateId } : null,
    setSelectedTemplate: (template: { row_id?: string; id?: string } | null) => {
      layout.setSelectedTemplateId(template?.row_id || template?.id || null);
    },
    activeTemplateTab: layout.activeTemplateTab,
    setActiveTemplateTab: layout.setActiveTemplateTab,
    
    // Dialogs/Modals
    templateDialogOpen: layout.templateDialogOpen,
    setTemplateDialogOpen: layout.setTemplateDialogOpen,
    saveAsTemplateDialogOpen: layout.saveAsTemplateDialogOpen,
    setSaveAsTemplateDialogOpen: layout.setSaveAsTemplateDialogOpen,
    saveAsTemplateSource: layout.saveAsTemplateSource,
    setSaveAsTemplateSource: layout.setSaveAsTemplateSource,
    handleSaveAsTemplate: layout.handleSaveAsTemplate,
    
    // Loading
    isInitialLoad: layout.isInitialLoad,
    setIsInitialLoad: layout.setIsInitialLoad,
    
    // Refs
    submenuRef: layout.submenuRef,
    hoverTimeoutRef: layout.hoverTimeoutRef,
  };
};

export default useLayoutState;
