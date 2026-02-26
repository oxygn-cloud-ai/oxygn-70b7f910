import { TooltipProvider } from "@/components/ui/tooltip"; // App entry
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import Auth from "./pages/Auth";
import MainLayout from "./pages/MainLayout";
import { ApiCallProvider } from "@/contexts/ApiCallContext";
import NavigationGuard from "@/components/NavigationGuard";
import { LiveApiDashboardProvider } from "@/contexts/LiveApiDashboardContext";
import { CreatePromptProvider } from "@/contexts/CreatePromptContext";
import { TooltipSettingsProvider } from "@/contexts/TooltipContext";
import { ToastHistoryProvider } from "@/contexts/ToastHistoryContext";
import ErrorBoundary from "@/components/ErrorBoundary";
import { CascadeRunProvider } from "@/contexts/CascadeRunContext";
import { UndoProvider } from "@/contexts/UndoContext";
import { PendingSaveProvider } from "@/contexts/PendingSaveContext";
import PostHogPageView from "@/components/PostHogPageView";

const queryClient = new QueryClient();

const App = () => (
  <ErrorBoundary message="The application encountered an error. Please refresh the page.">
    <QueryClientProvider client={queryClient}>
      <ToastHistoryProvider>
        <UndoProvider>
          <PendingSaveProvider>
            <CreatePromptProvider>
              <TooltipSettingsProvider>
                <TooltipProvider>
                  <CascadeRunProvider>
                    <BrowserRouter>
                    <PostHogPageView />
                    <ApiCallProvider>
                      <LiveApiDashboardProvider>
                        <AuthProvider>
                          <NavigationGuard />
                          <ErrorBoundary message="This page encountered an error.">
                            <Routes>
                              <Route path="/auth" element={<Auth />} />
                              <Route path="/~oauth/*" element={<div />} />
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
                      </LiveApiDashboardProvider>
                    </ApiCallProvider>
                    </BrowserRouter>
                  </CascadeRunProvider>
                </TooltipProvider>
              </TooltipSettingsProvider>
            </CreatePromptProvider>
          </PendingSaveProvider>
        </UndoProvider>
      </ToastHistoryProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
