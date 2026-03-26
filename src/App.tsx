import { useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation, useNavigate } from "react-router-dom";
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
import Vendas from "./pages/Vendas";
import Produtos from "./pages/Produtos";
import Relatorios from "./pages/Relatorios";
import Templates from './pages/Templates';
import MainLayout from "@/components/MainLayout";

const queryClient = new QueryClient();

function AuthHashHandler() {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const hash = window.location.hash;

    // Handle recovery password
    if (location.pathname === "/" && hash.includes("type=recovery")) {
      navigate(`/reset-password${hash}`, { replace: true });
      return;
    }

    // Handle magic link callback errors
    if (hash.includes("error=access_denied") || hash.includes("error_code=otp_expired")) {
      console.error("Auth error in URL:", hash);
      // Clear the hash and show error message
      window.history.replaceState(null, "", window.location.pathname);
      navigate("/login", { replace: true });
      return;
    }
  }, [location.pathname, navigate]);

  return null;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <AuthHashHandler />
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/login" element={<Login />} />
            <Route path="/reset-password" element={<ResetPassword />} />

            {/* Role-based redirect */}
            <Route path="/dashboard" element={<RoleDashboardRedirect />} />

            {/* Master */}
            <Route path="/master" element={
              <ProtectedRoute allowedRoles={['master']}>
                <MainLayout>
                  <MasterDashboard />
                </MainLayout>
              </ProtectedRoute>
            } />

            {/* Loja */}
            <Route path="/loja" element={
              <ProtectedRoute allowedRoles={['loja']}>
                <MainLayout>
                  <LojaDashboard />
                </MainLayout>
              </ProtectedRoute>
            } />

            {/* Vendedora */}
            <Route path="/vendedora" element={
              <ProtectedRoute allowedRoles={['vendedora']}>
                <MainLayout>
                  <Dashboard />
                </MainLayout>
              </ProtectedRoute>
            } />

            {/* New Features */}
            <Route path="/vendas" element={<ProtectedRoute allowedRoles={['master', 'loja', 'vendedora']}><MainLayout><Vendas /></MainLayout></ProtectedRoute>} />
            <Route path="/produtos" element={
              <ProtectedRoute>
                <MainLayout>
                  <Produtos />
                </MainLayout>
              </ProtectedRoute>
            } />
            <Route path="/relatorios" element={<ProtectedRoute allowedRoles={['master', 'loja', 'vendedora']}><MainLayout><Relatorios /></MainLayout></ProtectedRoute>} />
            <Route path="/modelos" element={<ProtectedRoute allowedRoles={['master', 'loja', 'vendedora']}><MainLayout><Templates /></MainLayout></ProtectedRoute>} />

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
