import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { queryClient } from "../lib/query-client";
import { ThemeProvider } from "../features/theme/contexts/ThemeContext";
import { MissionControl } from "../features/dashboard/components/MissionControl";
import { PreferencesPage } from "../features/settings/pages/PreferencesPage";
import { ErrorBoundary } from "../components/ui/error-boundary";

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <BrowserRouter>
          <ErrorBoundary>
            <Routes>
              <Route path="/" element={<ErrorBoundary><MissionControl /></ErrorBoundary>} />
              <Route path="/preferences" element={<ErrorBoundary><PreferencesPage /></ErrorBoundary>} />
            </Routes>
          </ErrorBoundary>
        </BrowserRouter>
      </ThemeProvider>
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}
