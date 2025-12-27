import React, { createContext, useContext, useState } from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { navItems } from "./nav-items";
import { AuthProvider } from "./contexts/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import Auth from "./pages/Auth";
import Mockup from "./pages/Mockup";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./components/AppSidebar";
import { ApiCallProvider } from "@/contexts/ApiCallContext";
import NavigationGuard from "@/components/NavigationGuard";
import BackgroundCallsIndicator from "@/components/BackgroundCallsIndicator";
import { CreatePromptProvider, useCreatePrompt } from "@/contexts/CreatePromptContext";
import { TooltipSettingsProvider } from "@/contexts/TooltipContext";
import { ToastHistoryProvider } from "@/contexts/ToastHistoryContext";
import ErrorBoundary from "@/components/ErrorBoundary";
import { CascadeRunProvider } from "@/contexts/CascadeRunContext";
import CascadeRunProgress from "@/components/CascadeRunProgress";
import CascadeErrorDialog from "@/components/CascadeErrorDialog";
import { UIPreferenceProvider, useUIPreference } from "@/contexts/UIPreferenceContext";

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
              <CascadeRunProgress />
              <div className="flex-1 overflow-auto">
                <Routes>
                  {navItems.map(({ to, page }) => (
                    <Route key={to} path={to} element={page} />
                  ))}
                </Routes>
              </div>
            </main>
            <CascadeErrorDialog />
          </div>
        </SidebarProvider>
      </HealthSectionContext.Provider>
    </SettingsSectionContext.Provider>
  );
};


// Component that switches between old and new UI
const UILayoutSwitch = () => {
  const { isNewUI } = useUIPreference();
  
  if (isNewUI) {
    return <Mockup />;
  }
  
  return <AppLayout />;
};

const App = () => (
  <ErrorBoundary message="The application encountered an error. Please refresh the page.">
    <QueryClientProvider client={queryClient}>
      <ToastHistoryProvider>
        <CreatePromptProvider>
          <TooltipSettingsProvider>
            <TooltipProvider>
              <CascadeRunProvider>
                <UIPreferenceProvider>
                  <BrowserRouter>
                    <ApiCallProvider>
                      <AuthProvider>
                        <NavigationGuard />
                        <BackgroundCallsIndicator />
                        <ErrorBoundary message="This page encountered an error.">
                          <Routes>
                            <Route path="/auth" element={<Auth />} />
                            <Route
                              path="/*"
                              element={
                                <ProtectedRoute>
                                  <UILayoutSwitch />
                                </ProtectedRoute>
                              }
                            />
                          </Routes>
                        </ErrorBoundary>
                      </AuthProvider>
                    </ApiCallProvider>
                  </BrowserRouter>
                </UIPreferenceProvider>
              </CascadeRunProvider>
            </TooltipProvider>
          </TooltipSettingsProvider>
        </CreatePromptProvider>
      </ToastHistoryProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;

