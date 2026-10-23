import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import { AppShell } from "@/components/layout/AppShell";
import { AnalyticsPage } from "@/pages/AnalyticsPage";
import { BoardPage } from "@/pages/BoardPage";
import { DashboardPage } from "@/pages/DashboardPage";
import { LoginPage } from "@/pages/LoginPage";
import { ModelMonitoringPage } from "@/pages/ModelMonitoringPage";
import { NewTicketPage } from "@/pages/NewTicketPage";
import { NotFoundPage } from "@/pages/NotFoundPage";
import { ProfilePage } from "@/pages/ProfilePage";
import { RegisterPage } from "@/pages/RegisterPage";
import { TicketDetailPage } from "@/pages/TicketDetailPage";
import { TicketsPage } from "@/pages/TicketsPage";
import { ProtectedRoute } from "@/routes/ProtectedRoute";
import { useAuthStore } from "@/stores/auth";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 10_000,
    },
  },
});

function RootRedirect() {
  const user = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);
  if (!accessToken || !user) return <Navigate to="/login" replace />;
  return <Navigate to="/" replace />;
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/auth" element={<RootRedirect />} />

          <Route
            element={
              <ProtectedRoute>
                <AppShell />
              </ProtectedRoute>
            }
          >
            <Route index element={<DashboardPage />} />
            <Route path="/board" element={<BoardPage />} />
            <Route path="/tickets" element={<TicketsPage />} />
            <Route path="/tickets/new" element={<NewTicketPage />} />
            <Route path="/tickets/:id" element={<TicketDetailPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route
              path="/analytics"
              element={
                <ProtectedRoute roles={["AGENT", "TEAM_LEAD", "ADMIN"]}>
                  <AnalyticsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/model"
              element={
                <ProtectedRoute roles={["TEAM_LEAD", "ADMIN"]}>
                  <ModelMonitoringPage />
                </ProtectedRoute>
              }
            />
          </Route>

          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
