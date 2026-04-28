import { BrowserRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Layout } from "./components/layout/Layout";
import { MapView } from "./pages/MapView";
import { Dashboard } from "./pages/Dashboard";
import { HubDetail } from "./pages/HubDetail";
import { SpokeDetail } from "./pages/SpokeDetail";
import { HubsList } from "./pages/HubsList";
import { SpokesList } from "./pages/SpokesList";
import { Upload } from "./pages/Upload";
import { SupplyDemand } from "./pages/SupplyDemand";
import { InventoryMarket } from "./pages/InventoryMarket";
import { InventoryDetail } from "./pages/InventoryDetail";
import { NetworkTopology } from "./pages/NetworkTopology";
import { Explainability } from "./pages/Explainability";
import { AppErrorBoundary } from "./components/ui/AppErrorBoundary";

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
});

export default function App() {
  return (
    <AppErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <Routes>
            <Route element={<Layout />}>
              <Route path="/" element={<MapView />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/hubs" element={<HubsList />} />
              <Route path="/hubs/:id" element={<HubDetail />} />
              <Route path="/spokes" element={<SpokesList />} />
              <Route path="/spokes/:id" element={<SpokeDetail />} />
              <Route path="/inventory" element={<InventoryMarket />} />
              <Route path="/inventory/item" element={<InventoryDetail />} />
              <Route path="/supply-demand" element={<SupplyDemand />} />
              <Route path="/topology" element={<NetworkTopology />} />
              <Route path="/explainability" element={<Explainability />} />
              <Route path="/upload" element={<Upload />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </QueryClientProvider>
    </AppErrorBoundary>
  );
}
