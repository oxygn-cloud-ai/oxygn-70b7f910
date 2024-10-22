import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useNavigate, useLocation } from "react-router-dom";
import { navItems } from "./nav-items";
import Navbar from "./components/Navbar";
import { useState, useCallback, useEffect } from 'react';
import { toast } from 'sonner';

const queryClient = new QueryClient();

const AppContent = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [unsavedChanges, setUnsavedChanges] = useState({});

  const handleNavigation = useCallback((to) => {
    const unsavedFieldsMessage = () => {
      const fields = Object.keys(unsavedChanges).filter(field => unsavedChanges[field]);
      if (fields.length === 0) return null;
      return `You have unsaved changes in the following fields: ${fields.join(', ')}. Are you sure you want to leave?`;
    };

    const message = unsavedFieldsMessage();
    if (message) {
      const userConfirmed = window.confirm(message);
      if (!userConfirmed) {
        return;
      }
    }
    navigate(to);
  }, [navigate, unsavedChanges]);

  useEffect(() => {
    console.log("Current location:", location.pathname);
  }, [location]);

  useEffect(() => {
    const handleBeforeUnload = (event) => {
      if (Object.values(unsavedChanges).some(Boolean)) {
        event.preventDefault();
        event.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [unsavedChanges]);

  return (
    <>
      <Navbar handleNavigation={handleNavigation} />
      <Routes>
        {navItems.map(({ to, page: PageComponent }) => (
          <Route 
            key={to} 
            path={to === "/projects" ? "/projects/*" : to} 
            element={
              PageComponent ? 
                <PageComponent setUnsavedChanges={setUnsavedChanges} /> : 
                null
            } 
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