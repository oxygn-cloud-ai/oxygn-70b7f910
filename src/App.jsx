import React, { createContext, useContext, useState } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { navItems } from "./nav-items";
import { AuthProvider } from "./contexts/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
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

const AppLayout = () => {
  const [activeSettingsSection, setActiveSettingsSection] = useState('qonsol');

  return (
    <SettingsSectionContext.Provider value={{ 
      activeSection: activeSettingsSection, 
      setActiveSection: setActiveSettingsSection 
    }}>
      <SidebarProvider defaultOpen={true}>
        <div className="flex min-h-screen w-full">
          <AppSidebar 
            activeSettingsSection={activeSettingsSection}
            onSettingsSectionChange={setActiveSettingsSection}
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
    </SettingsSectionContext.Provider>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <BrowserRouter>
        <AuthProvider>
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
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
