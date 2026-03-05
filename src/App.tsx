import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import ProtectedRoute from "@/components/ProtectedRoute";
import Index from "./pages/Index";
import Login from "./pages/Login";
import RoleDashboardRedirect from "./pages/RoleDashboardRedirect";
import MasterDashboard from "./pages/MasterDashboard";
import LojaDashboard from "./pages/LojaDashboard";
import Dashboard from "./pages/Dashboard";
import NovaMalinhaCliente from "./pages/NovaMalinhaCliente";
import NovaMalinhaProdutos from "./pages/NovaMalinhaProdutos";
import MalinhaResumo from "./pages/MalinhaResumo";
import ClienteView from "./pages/ClienteView";
import ResetPassword from "./pages/ResetPassword";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/login" element={<Login />} />

            {/* Role-based redirect */}
            <Route path="/dashboard" element={<RoleDashboardRedirect />} />

            {/* Master */}
            <Route path="/master" element={
              <ProtectedRoute allowedRoles={['master']}>
                <MasterDashboard />
              </ProtectedRoute>
            } />

            {/* Loja */}
            <Route path="/loja" element={
              <ProtectedRoute allowedRoles={['loja']}>
                <LojaDashboard />
              </ProtectedRoute>
            } />

            {/* Vendedora */}
            <Route path="/vendedora" element={
              <ProtectedRoute allowedRoles={['vendedora']}>
                <Dashboard />
              </ProtectedRoute>
            } />

            {/* Shared authenticated routes */}
            <Route path="/nova-malinha" element={
              <ProtectedRoute allowedRoles={['loja', 'vendedora']}>
                <NovaMalinhaCliente />
              </ProtectedRoute>
            } />
            <Route path="/nova-malinha/produtos" element={
              <ProtectedRoute allowedRoles={['loja', 'vendedora']}>
                <NovaMalinhaProdutos />
              </ProtectedRoute>
            } />
            <Route path="/malinha/:id/resumo" element={
              <ProtectedRoute>
                <MalinhaResumo />
              </ProtectedRoute>
            } />

            {/* Public client view */}
            <Route path="/malinha/:id" element={<ClienteView />} />

            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
