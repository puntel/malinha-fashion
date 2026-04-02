import { useState, useMemo } from 'react';
import { 
  BarChart3, 
  TrendingUp, 
  Users, 
  Package, 
  ShoppingCart, 
  Download,
  Calendar as CalendarIcon,
  Filter,
  ArrowUpRight,
  Loader2,
  ClipboardCheck,
  History,
  CheckCircle2,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Trophy,
  UserCheck,
  Circle,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { fetchInventoryChecks, createInventoryCheck } from '@/lib/api';
import type { InventoryCheck, InventoryCheckItem } from '@/lib/types';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  AreaChart, 
  Area,
} from 'recharts';
import { format, subDays } from 'date-fns';
import * as XLSX from 'xlsx';

interface ReportSale {
  id: string;
  created_at: string;
  product_name: string;
  internal_code: string | null;
  category: string | null;
  value: number;
  discount: number;
  payment_method: string;
  quantity: number;
  clientes: { name: string } | null;
  vendedora: { full_name: string } | null;
}

interface ReportMalinha {
  id: string;
  created_at: string;
  client_name: string;
  status: string;
  seller_name: string;
  send_date?: string | null;
  return_date?: string | null;
  malinha_products: any[];
}

export default function Relatorios() {
  const { user, role } = useAuth();
  const [period, setPeriod] = useState('30');
  const [vendedoraFilter, setVendedoraFilter] = useState('all');
  const [isVerifying, setIsVerifying] = useState(false);
  const [checkObservations, setCheckObservations] = useState<Record<string, string>>({});
  const [checkedProducts, setCheckedProducts] = useState<Record<string, boolean>>({});
  const [physicalQty, setPhysicalQty] = useState<Record<string, string>>({});
  const [expandedCheck, setExpandedCheck] = useState<string | null>(null);

  // Fetch loja_id for the current user
  const { data: userData } = useQuery<{ loja_id: string | null | undefined }>({
    queryKey: ['user-loja', user?.id],
    queryFn: async () => {
      if (role === 'master') return { loja_id: null };
      if (role === 'loja') {
        const { data } = await supabase.from('lojas').select('id').eq('created_by', user?.id).single();
        return { loja_id: data?.id };
      }
      const { data } = await supabase.from('vendedoras').select('loja_id').eq('user_id', user?.id).single();
      return { loja_id: data?.loja_id };
    },
    enabled: !!user
  });

  const lojaId = userData?.loja_id;

  // Fetch Vendedoras for filter
  const { data: vendedoras = [] } = useQuery<{ id: string, full_name: string }[]>({
    queryKey: ['vendedoras-filter', lojaId],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('id, full_name').eq('role', 'vendedora');
      return data || [];
    }
  });

  // Fetch all necessary data for reports
  const { data: reportData, isLoading } = useQuery<{sales: ReportSale[], malinhas: ReportMalinha[], products: any[], clients: any[]}>({
    queryKey: ['report-data', lojaId, period, vendedoraFilter],
    queryFn: async () => {
      const startDate = subDays(new Date(), parseInt(period));
      
      let salesQuery = supabase.from('sales').select('*, clientes(name)').gte('created_at', startDate.toISOString());
      if (lojaId) salesQuery = salesQuery.eq('loja_id', lojaId);
      if (vendedoraFilter !== 'all') salesQuery = salesQuery.eq('vendedora_id', vendedoraFilter);
      const { data: sales } = await salesQuery;

      let malinhasQuery = supabase.from('malinhas').select('*, malinha_products(*)').gte('created_at', startDate.toISOString());
      if (lojaId) malinhasQuery = malinhasQuery.eq('loja_id', lojaId);
      if (vendedoraFilter !== 'all') malinhasQuery = malinhasQuery.eq('vendedora_id', vendedoraFilter);
      const { data: malinhas } = await malinhasQuery;

      let productsQuery = supabase.from('products').select('*');
      if (lojaId) productsQuery = productsQuery.eq('loja_id', lojaId);
      const { data: products } = await productsQuery;

      let clientsQuery = supabase.from('clientes').select('*');
      if (lojaId) clientsQuery = clientsQuery.eq('loja_id', lojaId);
      const { data: clients } = await clientsQuery;

      return {
        sales: (sales as any[] || []) as ReportSale[],
        malinhas: (malinhas as any[] || []) as ReportMalinha[],
        products: products || [] as any[],
        clients: clients || [] as any[]
      };
    },
    enabled: !!lojaId || role === 'master'
  });

  const { data: inventoryChecks = [], isLoading: isLoadingChecks, refetch: refetchChecks } = useQuery({
    queryKey: ['inventory-checks', lojaId],
    queryFn: () => fetchInventoryChecks(lojaId!),
    enabled: !!lojaId
  });

  const { data: currentProfile } = useQuery({
    queryKey: ['current-profile', user?.id],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('*').eq('user_id', user?.id).single();
      return data;
    },
    enabled: !!user?.id
  });

  // ── Stats ────────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    if (!reportData) return null;
    
    const totalSalesValue = reportData.sales.reduce((sum, s) => sum + (s.value - (s.discount || 0)), 0);
    const malinhaSalesValue = reportData.malinhas.reduce((sum, m) => {
      const accepted = m.malinha_products?.filter((p: any) => p.status === 'accepted' || p.status === 'edited') || [];
      return sum + accepted.reduce((s: number, p: any) => s + (Number(p.price) * p.quantity), 0);
    }, 0);

    const totalRevenue = totalSalesValue + malinhaSalesValue;
    const totalOrders = reportData.sales.length + reportData.malinhas.length;
    const lowStockCount = reportData.products.filter(p => p.quantity <= 3).length;

    return {
      totalRevenue,
      totalOrders,
      lowStockCount,
      newClients: reportData.clients.length,
      salesCount: reportData.sales.length,
      malinhaCount: reportData.malinhas.length
    };
  }, [reportData]);

  // ── Charts + Rankings ────────────────────────────────────────────────────
  const charts = useMemo(() => {
    if (!reportData) return null;

    // Revenue by Day
    const days: Record<string, number> = {};
    const last30Days = Array.from({length: parseInt(period)}, (_, i) => {
      const d = format(subDays(new Date(), i), 'dd/MM');
      days[d] = 0;
      return d;
    }).reverse();

    reportData.sales.forEach(s => {
      const d = format(new Date(s.created_at), 'dd/MM');
      if (days[d] !== undefined) days[d] += (s.value - (s.discount || 0));
    });

    const revenueByDay = last30Days.map(d => ({ name: d, valor: days[d] }));

    // Top products (by quantity sold)
    const productQty: Record<string, { name: string; qty: number; revenue: number; code: string | null }> = {};
    reportData.sales.forEach(s => {
      const key = s.product_name;
      if (!productQty[key]) productQty[key] = { name: s.product_name, qty: 0, revenue: 0, code: s.internal_code };
      productQty[key].qty += (s.quantity || 1);
      productQty[key].revenue += (s.value - (s.discount || 0));
    });
    // Also from malinhas
    reportData.malinhas.forEach(m => {
      m.malinha_products?.filter((p: any) => p.status === 'accepted' || p.status === 'edited').forEach((p: any) => {
        const key = p.code || 'Produto malinha';
        if (!productQty[key]) productQty[key] = { name: p.code || 'Produto malinha', qty: 0, revenue: 0, code: p.code };
        productQty[key].qty += (p.quantity || 1);
        productQty[key].revenue += (Number(p.price) * p.quantity);
      });
    });
    const topProducts = Object.values(productQty).sort((a, b) => b.qty - a.qty).slice(0, 10);

    // Top clients (by total spent)
    const clientSpend: Record<string, { name: string; total: number; orders: number }> = {};
    reportData.sales.forEach(s => {
      if (!s.clientes?.name) return;
      const key = s.clientes.name;
      if (!clientSpend[key]) clientSpend[key] = { name: key, total: 0, orders: 0 };
      clientSpend[key].total += (s.value - (s.discount || 0));
      clientSpend[key].orders += 1;
    });
    reportData.malinhas.forEach(m => {
      const accepted = m.malinha_products?.filter((p: any) => p.status === 'accepted' || p.status === 'edited') || [];
      if (accepted.length === 0) return;
      const key = m.client_name;
      if (!clientSpend[key]) clientSpend[key] = { name: key, total: 0, orders: 0 };
      clientSpend[key].total += accepted.reduce((s: number, p: any) => s + (Number(p.price) * p.quantity), 0);
      clientSpend[key].orders += 1;
    });
    const topClients = Object.values(clientSpend).sort((a, b) => b.total - a.total).slice(0, 10);

    return { revenueByDay, topProducts, topClients };
  }, [reportData, period]);

  // ── Export helpers ──────────────────────────────────────────────────────
  const exportToExcel = (type: string) => {
    if (!reportData) return;
    const wb = XLSX.utils.book_new();
    const dateStr = format(new Date(), 'ddMMyyyy');

    const addSheet = (data: any[], sheetName: string) => {
      if (data.length === 0) return;
      const ws = XLSX.utils.json_to_sheet(data);
      XLSX.utils.book_append_sheet(wb, ws, sheetName);
    };

    if (type === 'vendas' || type === 'tudo') {
      addSheet(reportData.sales.map(s => ({
        Data: format(new Date(s.created_at), 'dd/MM/yyyy'),
        Cliente: s.clientes?.name || 'Avulso',
        Produto: s.product_name,
        Código: s.internal_code,
        Valor: s.value,
        Desconto: s.discount,
        Total: s.value - (s.discount || 0),
        Pagamento: s.payment_method,
        Vendedora: s.vendedora?.full_name || 'N/A'
      })), "Vendas");
    }

    if (type === 'estoque' || type === 'tudo') {
      addSheet(reportData.products.map(p => ({
        Produto: p.name,
        Código: p.internal_code,
        Categoria: p.category,
        Marca: p.brand,
        Estoque: p.quantity,
        Preço: p.unit_price,
        Tamanho: p.size,
        Cor: p.color
      })), "Estoque");
    }

    if (type === 'malinhas' || type === 'tudo') {
      addSheet(reportData.malinhas.map(m => ({
        ID: m.id,
        Cliente: m.client_name,
        Status: m.status,
        Data_Criacao: format(new Date(m.created_at), 'dd/MM/yyyy'),
        Vendedora: m.seller_name,
        Envio: m.send_date ? format(new Date(m.send_date), 'dd/MM/yyyy') : '-',
        Retorno: m.return_date ? format(new Date(m.return_date), 'dd/MM/yyyy') : '-'
      })), "Malinhas");
    }

    if (type === 'clientes' || type === 'tudo') {
      addSheet(reportData.clients.map(c => ({
        Nome: c.name,
        Email: c.email,
        WhatsApp: c.phone,
        CPF: c.cpf,
        Endereço: c.address,
        Data_Cadastro: format(new Date(c.created_at), 'dd/MM/yyyy')
      })), "Clientes");
    }

    const fileName = type === 'tudo' ? `exportar_tudo_bagsync_${dateStr}` : `relatorio_${type}_${dateStr}`;
    XLSX.writeFile(wb, `${fileName}.xlsx`);
    toast.success('Relatório exportado com sucesso!');
  };

  // Export divergences from a specific inventory check
  const exportDivergencias = (check: InventoryCheck) => {
    const divergencias = (check.items || []).filter(item => {
      const physical = physicalQty[`${check.id}-${item.product_id}`];
      return physical !== undefined && parseInt(physical) !== item.expected_quantity;
    });

    if (divergencias.length === 0) {
      toast.info('Nenhuma divergência registrada nesta conferência.');
      return;
    }

    const data = divergencias.map(item => ({
      Produto: item.product_name,
      Código: item.internal_code || '-',
      Estoque_Sistema: item.expected_quantity,
      Estoque_Físico: physicalQty[`${check.id}-${item.product_id}`] ?? '-',
      Diferença: (parseInt(physicalQty[`${check.id}-${item.product_id}`] ?? '0') - item.expected_quantity),
      Observação: item.observation || ''
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, 'Divergências');
    const dateStr = format(new Date(check.created_at), 'ddMMyyyy_HHmm');
    XLSX.writeFile(wb, `divergencias_estoque_${dateStr}.xlsx`);
    toast.success('Divergências exportadas com sucesso!');
  };

  // ── Medal colors ─────────────────────────────────────────────────────────
  const medal = (i: number) =>
    i === 0 ? 'text-yellow-500' : i === 1 ? 'text-slate-400' : i === 2 ? 'text-amber-700' : 'text-muted-foreground';

  if (isLoading) return (
    <div className="flex flex-col items-center justify-center min-h-[400px] gap-3">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      <p className="text-muted-foreground font-medium">Carregando dados do dashboard...</p>
    </div>
  );

  return (
    <div className="space-y-8 pb-10">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Relatórios & Insights</h1>
          <p className="text-muted-foreground font-medium">Acompanhe o desempenho da sua loja em tempo real.</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={() => exportToExcel('tudo')} className="gap-2 bg-primary/5 border-primary/20 text-primary hover:bg-primary/10">
            <Download className="h-4 w-4" /> Exportar Tudo
          </Button>
          
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-[180px]">
              <CalendarIcon className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Período" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Últimos 7 dias</SelectItem>
              <SelectItem value="15">Últimos 15 dias</SelectItem>
              <SelectItem value="30">Últimos 30 dias</SelectItem>
              <SelectItem value="90">Últimos 90 dias</SelectItem>
            </SelectContent>
          </Select>
          
          <Select value={vendedoraFilter} onValueChange={setVendedoraFilter}>
            <SelectTrigger className="w-[180px]">
              <Users className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Vendedora" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas Vendedoras</SelectItem>
              {vendedoras.map(v => <SelectItem key={v.id} value={v.id}>{v.full_name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* ── Stats Grid ─────────────────────────────────────────────────── */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="overflow-hidden border-none shadow-sm bg-gradient-to-br from-primary/10 via-primary/5 to-background">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Receita Total</CardTitle>
            <TrendingUp className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">R$ {stats?.totalRevenue.toFixed(2).replace('.', ',')}</div>
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
              <span className="text-success inline-flex items-center"><ArrowUpRight className="h-2 w-2 mr-0.5" /> 12%</span> em relação ao mês anterior
            </p>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Vendas Diretas</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.salesCount}</div>
            <p className="text-xs text-muted-foreground mt-1">Registradas no período</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Malinhas Ativas</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.malinhaCount}</div>
            <p className="text-xs text-muted-foreground mt-1">Consignados em andamento</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Estoque Baixo</CardTitle>
            <Package className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.lowStockCount}</div>
            <p className="text-xs text-destructive mt-1 font-medium">Produtos precisam de reposição</p>
          </CardContent>
        </Card>
      </div>

      {/* ── Gráfico de evolução ─────────────────────────────────────────── */}
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>Evolução de Vendas</CardTitle>
          <CardDescription>Receita diária (R$) no período selecionado.</CardDescription>
        </CardHeader>
        <CardContent className="h-[260px] pl-2">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={charts?.revenueByDay}>
              <defs>
                <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--muted))" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 12, fill: 'hsl(var(--muted-foreground))'}} />
              <YAxis axisLine={false} tickLine={false} tick={{fontSize: 12, fill: 'hsl(var(--muted-foreground))'}} tickFormatter={(val) => `R$ ${val}`} />
              <Tooltip
                contentStyle={{ borderRadius: '8px', border: '1px solid hsl(var(--border))', backgroundColor: 'hsl(var(--card))' }}
                formatter={(val: number) => [`R$ ${val.toFixed(2).replace('.', ',')}`, 'Receita']}
              />
              <Area type="monotone" dataKey="valor" stroke="hsl(var(--primary))" strokeWidth={3} fillOpacity={1} fill="url(#colorRevenue)" />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* ── Rankings ─────────────────────────────────────────────────────── */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Produtos mais vendidos */}
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="h-4 w-4 text-yellow-500" />
                Produtos Mais Vendidos
              </CardTitle>
              <CardDescription>Por quantidade no período selecionado.</CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={() => exportToExcel('vendas')} className="gap-1 text-xs">
              <Download className="h-3 w-3" /> Exportar
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            {!charts?.topProducts.length ? (
              <p className="text-sm text-muted-foreground italic text-center py-8">Nenhuma venda no período.</p>
            ) : (
              <div className="divide-y">
                {charts.topProducts.map((p, i) => (
                  <div key={p.name} className="flex items-center gap-3 px-6 py-3 hover:bg-muted/30 transition-colors">
                    <span className={`text-sm font-bold w-5 shrink-0 ${medal(i)}`}>
                      {i < 3 ? ['🥇','🥈','🥉'][i] : `${i+1}.`}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{p.name}</p>
                      {p.code && <p className="text-xs text-muted-foreground">{p.code}</p>}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold">{p.qty} un.</p>
                      <p className="text-xs text-muted-foreground">R$ {p.revenue.toFixed(2).replace('.', ',')}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Clientes que mais compraram */}
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <UserCheck className="h-4 w-4 text-primary" />
                Clientes que Mais Compraram
              </CardTitle>
              <CardDescription>Por valor total gasto no período.</CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={() => exportToExcel('clientes')} className="gap-1 text-xs">
              <Download className="h-3 w-3" /> Exportar
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            {!charts?.topClients.length ? (
              <p className="text-sm text-muted-foreground italic text-center py-8">Nenhuma compra registrada no período.</p>
            ) : (
              <div className="divide-y">
                {charts.topClients.map((c, i) => (
                  <div key={c.name} className="flex items-center gap-3 px-6 py-3 hover:bg-muted/30 transition-colors">
                    <span className={`text-sm font-bold w-5 shrink-0 ${medal(i)}`}>
                      {i < 3 ? ['🥇','🥈','🥉'][i] : `${i+1}.`}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{c.name}</p>
                      <p className="text-xs text-muted-foreground">{c.orders} {c.orders === 1 ? 'pedido' : 'pedidos'}</p>
                    </div>
                    <p className="text-sm font-bold text-success shrink-0">R$ {c.total.toFixed(2).replace('.', ',')}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Tabs ─────────────────────────────────────────────────────────── */}
      <Tabs defaultValue="vendas" className="space-y-4">
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="vendas">Vendas Recentes</TabsTrigger>
            <TabsTrigger value="verificacao">Verificação de Estoque</TabsTrigger>
            <TabsTrigger value="estoque">Estoque Baixo</TabsTrigger>
          </TabsList>
          <div className="flex gap-2">
            {isVerifying ? (
              <>
                <Button variant="outline" size="sm" onClick={() => setIsVerifying(false)}>Cancelar</Button>
                <Button size="sm" onClick={async () => {
                  if (!lojaId || !user) return;
                  try {
                    const items = reportData?.products.map(p => ({
                      product_id: p.id,
                      product_name: p.name,
                      internal_code: p.internal_code,
                      expected_quantity: p.quantity,
                      checked: !!checkedProducts[p.id],
                      observation: checkObservations[p.id] || ''
                    })) || [];
                    await createInventoryCheck(lojaId, user.id, currentProfile?.full_name || 'Usuário', items);
                    toast.success('Verificação de estoque salva!');
                    setIsVerifying(false);
                    setCheckObservations({});
                    setCheckedProducts({});
                    refetchChecks();
                  } catch (err) {
                    toast.error('Erro ao salvar verificação');
                  }
                }}>Salvar Verificação</Button>
              </>
            ) : (
              <Button variant="outline" size="sm" onClick={() => exportToExcel('estoque')} className="gap-2">
                <Download className="h-4 w-4" /> Exportar Planilha
              </Button>
            )}
          </div>
        </div>

        {/* ── Vendas Recentes ─────────────────────────────────────────── */}
        <TabsContent value="vendas" className="border rounded-xl bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b">
                <tr>
                  <th className="text-left p-4 font-medium">Data</th>
                  <th className="text-left p-4 font-medium">Cliente</th>
                  <th className="text-left p-4 font-medium">Produto</th>
                  <th className="text-right p-4 font-medium">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {reportData?.sales.slice(0, 10).map((sale) => (
                  <tr key={sale.id} className="hover:bg-muted/30 transition-colors">
                    <td className="p-4 text-muted-foreground">{format(new Date(sale.created_at), 'dd/MM/yyyy')}</td>
                    <td className="p-4 font-medium">{sale.clientes?.name || 'Avulso'}</td>
                    <td className="p-4">{sale.product_name}</td>
                    <td className="p-4 text-right font-semibold text-success">R$ {(sale.value - (sale.discount || 0)).toFixed(2).replace('.', ',')}</td>
                  </tr>
                ))}
                {reportData?.sales.length === 0 && (
                  <tr>
                    <td colSpan={4} className="p-8 text-center text-muted-foreground italic">Nenhuma venda encontrada no período.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>

        {/* ── Verificação de Estoque ──────────────────────────────────── */}
        <TabsContent value="verificacao" className="space-y-4">
          {isVerifying ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Nova Verificação de Estoque</CardTitle>
                <CardDescription>Marque os itens conferidos. Informe a quantidade física e adicione observações se necessário.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="p-2 text-left w-10">Conf.</th>
                        <th className="p-2 text-left">Produto</th>
                        <th className="p-2 text-left">Cód.</th>
                        <th className="p-2 text-center w-24">Est. Sistema</th>
                        <th className="p-2 text-center w-24">Qtd. Física</th>
                        <th className="p-2 text-left">Observação</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {reportData?.products.map((p) => {
                        const phys = physicalQty[`new-${p.id}`];
                        const hasDivergence = phys !== undefined && parseInt(phys) !== p.quantity;
                        return (
                          <tr key={p.id} className={`hover:bg-muted/30 ${hasDivergence ? 'bg-destructive/5' : ''}`}>
                            <td className="p-2">
                              <Checkbox
                                checked={checkedProducts[p.id] || false}
                                onCheckedChange={(checked) => setCheckedProducts(prev => ({ ...prev, [p.id]: !!checked }))}
                              />
                            </td>
                            <td className="p-2 font-medium">{p.name}</td>
                            <td className="p-2 text-muted-foreground">{p.internal_code || '-'}</td>
                            <td className="p-2 text-center font-medium">{p.quantity}</td>
                            <td className="p-2">
                              <Input
                                type="number"
                                min="0"
                                className={`h-8 text-xs text-center w-20 mx-auto ${hasDivergence ? 'border-destructive text-destructive' : ''}`}
                                placeholder="—"
                                value={physicalQty[`new-${p.id}`] ?? ''}
                                onChange={e => setPhysicalQty(prev => ({ ...prev, [`new-${p.id}`]: e.target.value }))}
                              />
                            </td>
                            <td className="p-2">
                              <Input
                                placeholder="Obs..."
                                className="h-8 text-xs"
                                value={checkObservations[p.id] || ''}
                                onChange={(e) => setCheckObservations(prev => ({ ...prev, [p.id]: e.target.value }))}
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              <div className="flex justify-between items-center bg-muted/30 p-4 rounded-lg border border-dashed">
                <div>
                  <h3 className="font-medium">Realizar nova conferência</h3>
                  <p className="text-sm text-muted-foreground">Inicie uma verificação manual do estoque físico.</p>
                </div>
                <Button onClick={() => setIsVerifying(true)} className="gap-2">
                  <ClipboardCheck className="h-4 w-4" /> Iniciar Verificação
                </Button>
              </div>

              {/* ── Histórico de conferências ──────────────────────────── */}
              <div className="grid gap-4">
                {isLoadingChecks ? (
                  <div className="flex justify-center py-10"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
                ) : inventoryChecks.length === 0 ? (
                  <p className="text-center py-10 text-muted-foreground italic">Nenhuma verificação realizada anteriormente.</p>
                ) : (
                  inventoryChecks.map((check) => {
                    const isExpanded = expandedCheck === check.id;
                    const checkedCount = check.items?.filter(i => i.checked).length || 0;
                    const totalCount = check.items?.length || 0;

                    // Compute divergences for already-saved checks using physicalQty state
                    const divergenceItems = (check.items || []).filter(item => {
                      const key = `${check.id}-${item.product_id}`;
                      const phys = physicalQty[key];
                      return phys !== undefined && parseInt(phys) !== item.expected_quantity;
                    });

                    return (
                      <Card key={check.id} className="overflow-hidden border-l-4 border-l-primary">
                        {/* Header */}
                        <div
                          className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/30 transition-colors"
                          onClick={() => setExpandedCheck(isExpanded ? null : check.id)}
                        >
                          <div className="flex items-center gap-3">
                            <History className="h-4 w-4 text-muted-foreground shrink-0" />
                            <div>
                              <p className="text-sm font-semibold">
                                Conferência em {format(new Date(check.created_at), "dd/MM/yyyy 'às' HH:mm")}
                              </p>
                              <p className="text-xs text-muted-foreground">Por {check.vendedora_name}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <Badge variant="outline" className="bg-primary/5 text-xs">
                              {checkedCount}/{totalCount} conf.
                            </Badge>
                            {divergenceItems.length > 0 && (
                              <Badge variant="destructive" className="text-xs gap-1">
                                <AlertTriangle className="h-3 w-3" /> {divergenceItems.length} div.
                              </Badge>
                            )}
                            {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                          </div>
                        </div>

                        {/* Expanded checklist */}
                        {isExpanded && (
                          <div className="border-t">
                            <div className="flex justify-between items-center px-4 py-2 bg-muted/20">
                              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Itens da Conferência</p>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 gap-1 text-xs"
                                onClick={() => exportDivergencias(check)}
                              >
                                <Download className="h-3 w-3" /> Exportar Divergências
                              </Button>
                            </div>
                            <div className="overflow-x-auto">
                              <table className="w-full text-sm">
                                <thead>
                                  <tr className="border-b bg-muted/10">
                                    <th className="p-2 text-left w-8">✓</th>
                                    <th className="p-2 text-left">Produto</th>
                                    <th className="p-2 text-left text-xs">Código</th>
                                    <th className="p-2 text-center text-xs">Est. Sistema</th>
                                    <th className="p-2 text-center text-xs">Qtd. Física</th>
                                    <th className="p-2 text-left text-xs">Observação</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y">
                                  {(check.items || []).map(item => {
                                    const key = `${check.id}-${item.product_id}`;
                                    const phys = physicalQty[key];
                                    const hasDivergence = phys !== undefined && parseInt(phys) !== item.expected_quantity;
                                    return (
                                      <tr key={item.id} className={`hover:bg-muted/20 ${hasDivergence ? 'bg-destructive/5' : ''}`}>
                                        <td className="p-2 pl-4">
                                          {item.checked
                                            ? <CheckCircle2 className="h-4 w-4 text-success" />
                                            : <Circle className="h-4 w-4 text-muted-foreground/40" />}
                                        </td>
                                        <td className="p-2 font-medium">{item.product_name}</td>
                                        <td className="p-2 text-muted-foreground text-xs">{item.internal_code || '-'}</td>
                                        <td className="p-2 text-center font-medium">{item.expected_quantity}</td>
                                        <td className="p-2 text-center">
                                          <Input
                                            type="number"
                                            min="0"
                                            className={`h-7 text-xs text-center w-16 mx-auto ${hasDivergence ? 'border-destructive text-destructive' : ''}`}
                                            placeholder="—"
                                            value={phys ?? ''}
                                            onChange={e => setPhysicalQty(prev => ({ ...prev, [key]: e.target.value }))}
                                          />
                                        </td>
                                        <td className="p-2 text-xs text-muted-foreground italic">{item.observation || '—'}</td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}
                      </Card>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </TabsContent>

        {/* ── Estoque Baixo ────────────────────────────────────────────── */}
        <TabsContent value="estoque" className="border rounded-xl bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b">
                <tr>
                  <th className="text-left p-4 font-medium">Produto</th>
                  <th className="text-left p-4 font-medium">Código</th>
                  <th className="text-left p-4 font-medium">Categoria</th>
                  <th className="text-right p-4 font-medium">Qtd Atual</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {reportData?.products.filter(p => p.quantity <= 3).map((product) => (
                  <tr key={product.id} className="hover:bg-muted/30 transition-colors">
                    <td className="p-4 font-medium">{product.name}</td>
                    <td className="p-4 text-muted-foreground">{product.internal_code || '-'}</td>
                    <td className="p-4">{product.category || '-'}</td>
                    <td className="p-4 text-right font-bold text-destructive">{product.quantity}</td>
                  </tr>
                ))}
                {reportData?.products.filter(p => p.quantity <= 3).length === 0 && (
                  <tr>
                    <td colSpan={4} className="p-8 text-center text-muted-foreground italic">Todo o estoque está regular.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
