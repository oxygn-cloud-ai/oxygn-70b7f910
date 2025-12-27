import React, { useState, useEffect, useRef } from "react";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import MockupNavigationRail from "@/components/mockup/MockupNavigationRail";
import MockupTopBar from "@/components/mockup/MockupTopBar";
import MockupFolderPanel from "@/components/mockup/MockupFolderPanel";
import MockupTemplatesFolderPanel from "@/components/mockup/MockupTemplatesFolderPanel";
import MockupSubmenuPanel from "@/components/mockup/MockupSubmenuPanel";
import MockupReadingPane from "@/components/mockup/MockupReadingPane";
import MockupConversationPanel from "@/components/mockup/MockupConversationPanel";
import MockupExportPanel from "@/components/mockup/MockupExportPanel";

const Mockup = () => {
  const [isDark, setIsDark] = useState(false);
  const [tooltipsEnabled, setTooltipsEnabled] = useState(true);
  const [folderPanelOpen, setFolderPanelOpen] = useState(true);
  const [conversationPanelOpen, setConversationPanelOpen] = useState(true);
  const [activeNav, setActiveNav] = useState("prompts");
  const [activeSubItem, setActiveSubItem] = useState(null);
  const [hoveredNav, setHoveredNav] = useState(null);
  const [activePromptId, setActivePromptId] = useState(2);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [exportPanelOpen, setExportPanelOpen] = useState(false);
  
  // Track if mouse is over the submenu panel
  const submenuRef = useRef(null);
  const hoverTimeoutRef = useRef(null);

  // Toggle dark mode on the document
  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
    return () => {
      document.documentElement.classList.remove("dark");
    };
  }, [isDark]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
    };
  }, []);

  // Determine what to show in the submenu panel
  // If hovering a nav item, show that nav's submenu
  // Otherwise show the active nav's content
  const displayedNav = hoveredNav || activeNav;
  
  // Check if current displayed nav has a submenu (not prompts or templates which have folder panels)
  const hasSubmenu = (navId) => navId !== "prompts" && navId !== "templates";

  const handleNavHover = (navId) => {
    // Clear any pending timeout
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    setHoveredNav(navId);
  };

  const handleNavLeave = () => {
    // Delay clearing hover to allow mouse to move to submenu
    hoverTimeoutRef.current = setTimeout(() => {
      setHoveredNav(null);
    }, 150);
  };

  const handleSubmenuMouseEnter = () => {
    // Cancel the timeout if mouse enters submenu
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
  };

  const handleSubmenuMouseLeave = () => {
    // When leaving submenu, clear hover state
    setHoveredNav(null);
  };

  const handleSubmenuClick = (navId, itemId) => {
    // Navigate to the parent nav and set the sub-item
    setActiveNav(navId);
    setActiveSubItem(itemId);
    setHoveredNav(null);
  };

  const handleSelectTemplate = (template) => {
    setSelectedTemplate(template);
  };

  // Clear selected template when switching away from templates nav
  useEffect(() => {
    if (activeNav !== "templates") {
      setSelectedTemplate(null);
    }
  }, [activeNav]);

  // Clear sub-item when switching nav
  useEffect(() => {
    if (activeNav === "prompts" || activeNav === "templates") {
      setActiveSubItem(null);
    }
  }, [activeNav]);

  // Render the appropriate panel content
  const renderFolderPanelContent = () => {
    // If hovering a nav with submenu, show that submenu
    if (hoveredNav && hasSubmenu(hoveredNav)) {
      return (
        <div
          ref={submenuRef}
          onMouseEnter={handleSubmenuMouseEnter}
          onMouseLeave={handleSubmenuMouseLeave}
          className="h-full"
        >
          <MockupSubmenuPanel 
            hoveredNav={hoveredNav}
            activeSubItem={hoveredNav === activeNav ? activeSubItem : null}
            onItemClick={(itemId) => handleSubmenuClick(hoveredNav, itemId)}
          />
        </div>
      );
    }

    // Otherwise show the active nav's content
    if (activeNav === "prompts") {
      return <MockupFolderPanel />;
    }
    
    if (activeNav === "templates") {
      return (
        <MockupTemplatesFolderPanel 
          onSelectTemplate={handleSelectTemplate}
          selectedTemplateId={selectedTemplate?.id}
        />
      );
    }
    
    // For other nav items, show their submenu
    return (
      <MockupSubmenuPanel 
        hoveredNav={activeNav}
        activeSubItem={activeSubItem}
        onItemClick={(itemId) => handleSubmenuClick(activeNav, itemId)}
      />
    );
  };

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="h-screen w-full flex flex-col bg-surface overflow-hidden">
        {/* Main Layout */}
        <div className="flex-1 flex overflow-hidden">
          {/* Navigation Rail - 80px */}
          <MockupNavigationRail 
            activeNav={activeNav}
            onNavChange={setActiveNav}
            onNavHover={handleNavHover}
            onNavLeave={handleNavLeave}
            folderPanelOpen={folderPanelOpen}
            onToggleFolderPanel={() => setFolderPanelOpen(!folderPanelOpen)}
          />

          {/* Content Area */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Top Bar - 64dp */}
            <MockupTopBar 
              tooltipsEnabled={tooltipsEnabled} 
              onToggleTooltips={() => setTooltipsEnabled(!tooltipsEnabled)}
              isDark={isDark}
              onToggleDark={() => setIsDark(!isDark)}
            />

            {/* Main Content with Resizable Panels */}
            <div className="flex-1 flex overflow-hidden">
              <ResizablePanelGroup direction="horizontal" className="flex-1">
                {/* Folder/Submenu Panel - collapsible */}
                {folderPanelOpen && (
                  <>
                    <ResizablePanel defaultSize={20} minSize={15} maxSize={30}>
                      <div className="h-full">
                        {renderFolderPanelContent()}
                      </div>
                    </ResizablePanel>
                    <ResizableHandle withHandle className="bg-outline-variant hover:bg-primary/50 transition-colors" />
                  </>
                )}

                {/* Reading Pane - flexible */}
                <ResizablePanel defaultSize={conversationPanelOpen ? 50 : 80} minSize={30}>
                  <MockupReadingPane 
                    hasSelection={activePromptId !== null} 
                    onExport={() => setExportPanelOpen(true)}
                    activeNav={activeNav}
                    activeSubItem={activeSubItem}
                    selectedTemplate={selectedTemplate}
                    onToggleConversation={() => setConversationPanelOpen(!conversationPanelOpen)}
                    conversationPanelOpen={conversationPanelOpen}
                  />
                </ResizablePanel>

                {conversationPanelOpen && (
                  <>
                    <ResizableHandle withHandle className="bg-outline-variant hover:bg-primary/50 transition-colors" />

                    {/* Conversation Panel */}
                    <ResizablePanel defaultSize={30} minSize={20} maxSize={40}>
                      <MockupConversationPanel onClose={() => setConversationPanelOpen(false)} />
                    </ResizablePanel>
                  </>
                )}

                {/* Export Panel - toggleable */}
                {exportPanelOpen && (
                  <>
                    <ResizableHandle withHandle className="bg-outline-variant hover:bg-primary/50 transition-colors" />
                    <ResizablePanel defaultSize={25} minSize={20} maxSize={35}>
                      <MockupExportPanel isOpen={true} onClose={() => setExportPanelOpen(false)} />
                    </ResizablePanel>
                  </>
                )}
              </ResizablePanelGroup>
            </div>
          </div>
        </div>
      </div>
    </DndProvider>
  );
};

export default Mockup;
