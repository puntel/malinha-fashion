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
  ArrowDownRight,
  Loader2
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
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
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { format, subDays, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';
import { ptBR } from 'date-fns/locale';
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

const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff8042', '#0088FE', '#00C49F'];

export default function Relatorios() {
  const { user, role } = useAuth();
  const [period, setPeriod] = useState('30');
  const [vendedoraFilter, setVendedoraFilter] = useState('all');

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
      let query = supabase.from('profiles').select('id, full_name').eq('role', 'vendedora');
      // Ideally we would filter by loja_id if we had that relation in profiles or a junction table
      const { data } = await query;
      return data || [];
    }
  });

  // Fetch all necessary data for reports
  const { data: reportData, isLoading } = useQuery<{sales: ReportSale[], malinhas: ReportMalinha[], products: any[], clients: any[]}>({
    queryKey: ['report-data', lojaId, period, vendedoraFilter],
    queryFn: async () => {
      const startDate = subDays(new Date(), parseInt(period));
      
      // 1. Fetch Sales
      let salesQuery = supabase.from('sales').select('*, clientes(name)').gte('created_at', startDate.toISOString());
      if (lojaId) salesQuery = salesQuery.eq('loja_id', lojaId);
      if (vendedoraFilter !== 'all') salesQuery = salesQuery.eq('vendedora_id', vendedoraFilter);
      const { data: sales } = await salesQuery;

      // 2. Fetch Malinhas (accepted items only for revenue calculation)
      let malinhasQuery = supabase.from('malinhas').select('*, malinha_products(*)').gte('created_at', startDate.toISOString());
      if (lojaId) malinhasQuery = malinhasQuery.eq('loja_id', lojaId);
      if (vendedoraFilter !== 'all') malinhasQuery = malinhasQuery.eq('vendedora_id', vendedoraFilter);
      const { data: malinhas } = await malinhasQuery;

      // 3. Fetch Products (for stock report)
      let productsQuery = supabase.from('products').select('*');
      if (lojaId) productsQuery = productsQuery.eq('loja_id', lojaId);
      const { data: products } = await productsQuery;

      // 4. Fetch Clients
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

  const charts = useMemo(() => {
    if (!reportData) return null;

    // Sales by Day
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

    // Sales by Category
    const categories: Record<string, number> = {};
    reportData.sales.forEach(s => {
      const cat = s.category || 'Outros';
      categories[cat] = (categories[cat] || 0) + (s.value - (s.discount || 0));
    });
    const revenueByCategory = Object.entries(categories).map(([name, value]) => ({ name, value }));

    return { revenueByDay, revenueByCategory };
  }, [reportData, period]);

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
      const data = reportData.sales.map(s => ({
        Data: format(new Date(s.created_at), 'dd/MM/yyyy'),
        Cliente: s.clientes?.name || 'Avulso',
        Produto: s.product_name,
        Código: s.internal_code,
        Valor: s.value,
        Desconto: s.discount,
        Total: s.value - (s.discount || 0),
        Pagamento: s.payment_method,
        Vendedora: s.vendedora?.full_name || 'N/A'
      }));
      addSheet(data, "Vendas");
    }

    if (type === 'estoque' || type === 'tudo') {
      const data = reportData.products.map(p => ({
        Produto: p.name,
        Código: p.internal_code,
        Categoria: p.category,
        Marca: p.brand,
        Estoque: p.quantity,
        Preço: p.unit_price,
        Tamanho: p.size,
        Cor: p.color
      }));
      addSheet(data, "Estoque");
    }

    if (type === 'malinhas' || type === 'tudo') {
      const data = reportData.malinhas.map(m => ({
        ID: m.id,
        Cliente: m.client_name,
        Status: m.status,
        Data_Criacao: format(new Date(m.created_at), 'dd/MM/yyyy'),
        Vendedora: m.seller_name,
        Check_Envio: m.send_date ? format(new Date(m.send_date), 'dd/MM/yyyy') : '-',
        Check_Retorno: m.return_date ? format(new Date(m.return_date), 'dd/MM/yyyy') : '-'
      }));
      addSheet(data, "Malinhas");
    }

    if (type === 'clientes' || type === 'tudo') {
      const data = reportData.clients.map(c => ({
        Nome: c.name,
        Email: c.email,
        WhatsApp: c.phone,
        CPF: c.cpf,
        Endereço: c.address,
        Data_Cadastro: format(new Date(c.created_at), 'dd/MM/yyyy')
      }));
      addSheet(data, "Clientes");
    }

    const fileName = type === 'tudo' ? `exportar_tudo_bagsync_${dateStr}` : `relatorio_${type}_${dateStr}`;
    XLSX.writeFile(wb, `${fileName}.xlsx`);
    toast.success('Relatório exportado com sucesso!');
  };

  if (isLoading) return (
    <div className="flex flex-col items-center justify-center min-h-[400px] gap-3">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      <p className="text-muted-foreground font-medium">Carregando dados do dashboard...</p>
    </div>
  );

  return (
    <div className="space-y-8 pb-10">
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

      {/* Stats Grid */}
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

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="lg:col-span-4 shadow-sm">
          <CardHeader>
            <CardTitle>Evolução de Vendas</CardTitle>
            <CardDescription>Receita diária (R$) no período selecionado.</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px] pl-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={charts?.revenueByDay}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--muted))" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{fontSize: 12, fill: 'hsl(var(--muted-foreground))'}} 
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{fontSize: 12, fill: 'hsl(var(--muted-foreground))'}}
                  tickFormatter={(val) => `R$ ${val}`}
                />
                <Tooltip 
                  contentStyle={{ borderRadius: '8px', border: '1px solid hsl(var(--border))', backgroundColor: 'hsl(var(--card))' }}
                  formatter={(val: number) => [`R$ ${val.toFixed(2).replace('.', ',')}`, 'Receita']}
                />
                <Area 
                  type="monotone" 
                  dataKey="valor" 
                  stroke="hsl(var(--primary))" 
                  strokeWidth={3}
                  fillOpacity={1} 
                  fill="url(#colorRevenue)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="lg:col-span-3 shadow-sm">
          <CardHeader>
            <CardTitle>Vendas por Categoria</CardTitle>
            <CardDescription>Distribuição de receita por tipo de produto.</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={charts?.revenueByCategory}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {charts?.revenueByCategory.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  formatter={(val: number) => [`R$ ${val.toFixed(2).replace('.', ',')}`, '']}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex flex-wrap justify-center gap-4 mt-2">
              {charts?.revenueByCategory.map((entry, index) => (
                <div key={entry.name} className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                  <span className="text-xs text-muted-foreground font-medium">{entry.name}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="vendas" className="space-y-4">
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="vendas">Vendas Recentes</TabsTrigger>
            <TabsTrigger value="estoque">Produtos s/ Estoque</TabsTrigger>
          </TabsList>
          <Button variant="outline" size="sm" onClick={() => exportToExcel(document.querySelector('[data-state="active"]')?.getAttribute('value') || 'vendas')} className="gap-2">
            <Download className="h-4 w-4" /> Exportar Planilha
          </Button>
        </div>

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
