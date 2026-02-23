import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import Dashboard from "./pages/Dashboard";
import NovaMalinhaCliente from "./pages/NovaMalinhaCliente";
import NovaMalinhaProdutos from "./pages/NovaMalinhaProdutos";
import MalinhaResumo from "./pages/MalinhaResumo";
import ClienteView from "./pages/ClienteView";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/nova-malinha" element={<NovaMalinhaCliente />} />
          <Route path="/nova-malinha/produtos" element={<NovaMalinhaProdutos />} />
          <Route path="/malinha/:id/resumo" element={<MalinhaResumo />} />
          <Route path="/malinha/:id" element={<ClienteView />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
