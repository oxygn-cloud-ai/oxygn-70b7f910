import React, { createContext, useContext, useState } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { navItems } from "./nav-items";
import { AuthProvider } from "./contexts/AuthContext";
import { ApiCallProvider } from "./contexts/ApiCallContext";
import ProtectedRoute from "./components/ProtectedRoute";
import NavigationGuard from "./components/NavigationGuard";
import BackgroundCallsIndicator from "./components/BackgroundCallsIndicator";
import Auth from "./pages/Auth";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./components/AppSidebar";

const queryClient = new QueryClient();

// Context for settings section state
export const SettingsSectionContext = createContext({
  activeSection: 'qonsol',
  setActiveSection: () => {},
});

export const useSettingsSection = () => useContext(SettingsSectionContext);

// Context for health section state
export const HealthSectionContext = createContext({
  activeSection: 'database',
  setActiveSection: () => {},
});

export const useHealthSection = () => useContext(HealthSectionContext);

const AppLayout = () => {
  const [activeSettingsSection, setActiveSettingsSection] = useState('qonsol');
  const [activeHealthSection, setActiveHealthSection] = useState('database');

  return (
    <SettingsSectionContext.Provider value={{ 
      activeSection: activeSettingsSection, 
      setActiveSection: setActiveSettingsSection 
    }}>
      <HealthSectionContext.Provider value={{ 
        activeSection: activeHealthSection, 
        setActiveSection: setActiveHealthSection 
      }}>
        <SidebarProvider defaultOpen={true}>
          <NavigationGuard />
          <BackgroundCallsIndicator />
          <div className="flex min-h-screen w-full">
            <AppSidebar 
              activeSettingsSection={activeSettingsSection}
              onSettingsSectionChange={setActiveSettingsSection}
              activeHealthSection={activeHealthSection}
              onHealthSectionChange={setActiveHealthSection}
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

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <BrowserRouter>
        <AuthProvider>
          <ApiCallProvider>
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
          </ApiCallProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
