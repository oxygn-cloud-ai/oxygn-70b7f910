import * as React from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import Auth from "./pages/Auth";
import MainLayout from "./pages/MainLayout";
import { ApiCallProvider } from "@/contexts/ApiCallContext";
import NavigationGuard from "@/components/NavigationGuard";
import BackgroundCallsIndicator from "@/components/BackgroundCallsIndicator";
import { CreatePromptProvider } from "@/contexts/CreatePromptContext";
import { TooltipSettingsProvider } from "@/contexts/TooltipContext";
import { ToastHistoryProvider } from "@/contexts/ToastHistoryContext";
import ErrorBoundary from "@/components/ErrorBoundary";
import { CascadeRunProvider } from "@/contexts/CascadeRunContext";

const queryClient = new QueryClient();

const App = () => (
  <ErrorBoundary message="The application encountered an error. Please refresh the page.">
    <QueryClientProvider client={queryClient}>
      <ToastHistoryProvider>
        <CreatePromptProvider>
          <TooltipSettingsProvider>
            <TooltipProvider>
              <CascadeRunProvider>
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
                                <MainLayout />
                              </ProtectedRoute>
                            }
                          />
                        </Routes>
                      </ErrorBoundary>
                    </AuthProvider>
                  </ApiCallProvider>
                </BrowserRouter>
              </CascadeRunProvider>
            </TooltipProvider>
          </TooltipSettingsProvider>
        </CreatePromptProvider>
      </ToastHistoryProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
