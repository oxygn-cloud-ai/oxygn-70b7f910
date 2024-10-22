import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useNavigate } from "react-router-dom";
import { navItems } from "./nav-items";
import Navbar from "./components/Navbar";
import { useState, useCallback } from 'react';

const queryClient = new QueryClient();

const AppContent = () => {
  const navigate = useNavigate();
  const [unsavedChanges, setUnsavedChanges] = useState({});

  const handleNavigation = useCallback((to) => {
    const unsavedFieldsMessage = () => {
      const fields = Object.keys(unsavedChanges).filter(field => unsavedChanges[field]);
      if (fields.length === 0) return null;
      return `You have unsaved changes in the following fields: ${fields.join(', ')}. Are you sure you want to leave?`;
    };

    const message = unsavedFieldsMessage();
    if (!message || window.confirm(message)) {
      navigate(to);
    }
  }, [navigate, unsavedChanges]);

  return (
    <>
      <Navbar handleNavigation={handleNavigation} />
      <Routes>
        {navItems.map(({ to, page: PageComponent }) => (
          <Route 
            key={to} 
            path={to} 
            element={<PageComponent setUnsavedChanges={setUnsavedChanges} />} 
          />
        ))}
      </Routes>
    </>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <BrowserRouter>
        <AppContent />
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;