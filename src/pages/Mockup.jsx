import React, { useState, useEffect } from "react";
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
  const [folderPanelOpen, setFolderPanelOpen] = useState(true);
  const [activeNav, setActiveNav] = useState("prompts");
  const [hoveredNav, setHoveredNav] = useState(null);
  const [activePromptId, setActivePromptId] = useState(2);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [exportPanelOpen, setExportPanelOpen] = useState(false);

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

  // Determine which panel content to show - hovered takes priority over active (except for templates)
  const showSubmenu = hoveredNav && hoveredNav !== "prompts" && hoveredNav !== "templates" && hoveredNav !== activeNav;

  const handleSubmenuClick = (itemId) => {
    console.log("Submenu item clicked:", itemId);
    // In a real app, this would navigate or trigger actions
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

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="h-screen w-full flex flex-col bg-surface overflow-hidden">
        {/* Info Banner */}
        <div className="h-10 flex items-center justify-center gap-4 bg-primary text-primary-foreground text-label-md">
          <span>M3 Gmail-Style Layout Mockup</span>
          <span className="opacity-70">|</span>
          <span className="opacity-70">Static preview - Panels are resizable</span>
        </div>

        {/* Main Layout */}
        <div className="flex-1 flex overflow-hidden">
          {/* Navigation Rail - 80px */}
          <MockupNavigationRail 
            activeNav={activeNav}
            onNavChange={setActiveNav}
            onNavHover={setHoveredNav}
            isDark={isDark}
            onToggleDark={() => setIsDark(!isDark)}
            folderPanelOpen={folderPanelOpen}
            onToggleFolderPanel={() => setFolderPanelOpen(!folderPanelOpen)}
          />

          {/* Content Area */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Top Bar - 64dp */}
            <MockupTopBar />

            {/* Main Content with Resizable Panels */}
            <div className="flex-1 flex overflow-hidden">
              <ResizablePanelGroup direction="horizontal" className="flex-1">
                {/* Folder/Submenu Panel - collapsible */}
                {folderPanelOpen && (
                  <>
                    <ResizablePanel defaultSize={20} minSize={15} maxSize={30}>
                      {showSubmenu ? (
                        <MockupSubmenuPanel 
                          hoveredNav={hoveredNav} 
                          onItemClick={handleSubmenuClick}
                        />
                      ) : activeNav === "prompts" ? (
                        <MockupFolderPanel />
                      ) : activeNav === "templates" ? (
                        <MockupTemplatesFolderPanel 
                          onSelectTemplate={handleSelectTemplate}
                          selectedTemplateId={selectedTemplate?.id}
                        />
                      ) : (
                        <MockupSubmenuPanel 
                          hoveredNav={activeNav} 
                          onItemClick={handleSubmenuClick}
                        />
                      )}
                    </ResizablePanel>
                    <ResizableHandle withHandle className="bg-outline-variant hover:bg-primary/50 transition-colors" />
                  </>
                )}

                {/* Reading Pane - flexible */}
                <ResizablePanel defaultSize={50} minSize={30}>
                  <MockupReadingPane 
                    hasSelection={activePromptId !== null} 
                    onExport={() => setExportPanelOpen(true)}
                    activeNav={activeNav}
                    selectedTemplate={selectedTemplate}
                  />
                </ResizablePanel>

                <ResizableHandle withHandle className="bg-outline-variant hover:bg-primary/50 transition-colors" />

                {/* Conversation Panel */}
                <ResizablePanel defaultSize={30} minSize={20} maxSize={40}>
                  <MockupConversationPanel />
                </ResizablePanel>

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

        {/* Specs Overlay */}
        <div className="fixed bottom-4 right-4 p-4 bg-surface-container-high border border-outline-variant rounded-m3-lg shadow-lg max-w-sm">
          <h3 className="text-label-lg text-on-surface font-semibold mb-2">M3 Specs Applied</h3>
          <ul className="text-label-sm text-on-surface-variant space-y-1">
            <li>• Nav Rail: 80px wide</li>
            <li>• Top Bar: 64dp height</li>
            <li>• Search: 56dp, 28px radius</li>
            <li>• Tree items: 28dp height</li>
            <li>• Typography: 10-14px scale</li>
            <li>• State layers: 8% hover, 10% focus</li>
            <li>• Panels: Horizontally resizable</li>
            <li>• Drag & Drop: Reorder prompts</li>
            <li>• Nav Hover: Submenu preview</li>
          </ul>
        </div>
      </div>
    </DndProvider>
  );
};

export default Mockup;
