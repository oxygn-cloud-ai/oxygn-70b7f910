import React, { createContext, useContext, useState, useEffect } from "react";
import { Toaster, setToastHistoryCallback } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { navItems } from "./nav-items";
import { AuthProvider } from "./contexts/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import Auth from "./pages/Auth";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./components/AppSidebar";
import { ApiCallProvider } from "@/contexts/ApiCallContext";
import NavigationGuard from "@/components/NavigationGuard";
import BackgroundCallsIndicator from "@/components/BackgroundCallsIndicator";
import { ToastHistoryProvider, useToastHistory } from "@/contexts/ToastHistoryContext";
import { CreatePromptProvider, useCreatePrompt } from "@/contexts/CreatePromptContext";

const queryClient = new QueryClient();

// Context for settings section state
export const SettingsSectionContext = createContext({
  activeSection: "qonsol",
  setActiveSection: () => {},
});

export const useSettingsSection = () => useContext(SettingsSectionContext);

// Context for health section state
export const HealthSectionContext = createContext({
  activeSection: "database",
  setActiveSection: () => {},
});

export const useHealthSection = () => useContext(HealthSectionContext);

const AppLayout = () => {
  const [activeSettingsSection, setActiveSettingsSection] = useState("qonsol");
  const [activeHealthSection, setActiveHealthSection] = useState("database");
  const { triggerCreatePrompt } = useCreatePrompt();

  return (
    <SettingsSectionContext.Provider
      value={{
        activeSection: activeSettingsSection,
        setActiveSection: setActiveSettingsSection,
      }}
    >
      <HealthSectionContext.Provider
        value={{
          activeSection: activeHealthSection,
          setActiveSection: setActiveHealthSection,
        }}
      >
        <SidebarProvider defaultOpen={true}>
          <div className="flex min-h-screen w-full">
            <AppSidebar
              activeSettingsSection={activeSettingsSection}
              onSettingsSectionChange={setActiveSettingsSection}
              activeHealthSection={activeHealthSection}
              onHealthSectionChange={setActiveHealthSection}
              onCreatePrompt={triggerCreatePrompt}
            />
            <main className="flex-1 flex flex-col">
              <div className="md:hidden p-2 border-b border-border">
                <SidebarTrigger />
              </div>
              <div className="flex-1 overflow-auto">
                <Routes>
                  {navItems.map(({ to, page }) => (
                    <Route key={to} path={to} element={page} />
                  ))}
                </Routes>
              </div>
            </main>
          </div>
        </SidebarProvider>
      </HealthSectionContext.Provider>
    </SettingsSectionContext.Provider>
  );
};

// Component to connect toast history
const ToastHistoryConnector = () => {
  const { addToHistory } = useToastHistory();
  
  useEffect(() => {
    setToastHistoryCallback(addToHistory);
    return () => setToastHistoryCallback(null);
  }, [addToHistory]);
  
  return null;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ToastHistoryProvider>
      <CreatePromptProvider>
        <TooltipProvider>
          <Toaster />
          <ToastHistoryConnector />
          <BrowserRouter>
            <ApiCallProvider>
              <AuthProvider>
                <NavigationGuard />
                <BackgroundCallsIndicator />
                <Routes>
                  <Route path="/auth" element={<Auth />} />
                  <Route
                    path="/*"
                    element={
                      <ProtectedRoute>
                        <AppLayout />
                      </ProtectedRoute>
                    }
                  />
                </Routes>
              </AuthProvider>
            </ApiCallProvider>
          </BrowserRouter>
        </TooltipProvider>
      </CreatePromptProvider>
    </ToastHistoryProvider>
  </QueryClientProvider>
);

export default App;
);

export default App;
