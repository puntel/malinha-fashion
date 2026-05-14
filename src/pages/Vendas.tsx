import { useState, useMemo } from 'react';
import { 
  Plus, 
  Search, 
  Trash2, 
  Loader2, 
  Filter,
  CreditCard,
  Printer
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import type { Sale } from '@/lib/types';
import { SaleReceipt, buildReceiptFromSale } from '@/components/SaleReceipt';

export default function Vendas() {
  const { user, role, profile } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [receiptSale, setReceiptSale] = useState<Sale | null>(null);
  
  // Form state
  const [form, setForm] = useState({
    cliente_id: '',
    product_name: '',
    internal_code: '',
    quantity: '1',
    value: '',
    discount: '0',
    payment_method: 'Pix'
  });

  // Fetch loja_id
  const { data: userData } = useQuery({
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

  // Fetch loja details for receipt
  const { data: lojaData } = useQuery({
    queryKey: ['loja-details', lojaId],
    queryFn: async () => {
      if (!lojaId) return null;
      const { data } = await supabase.from('lojas').select('name, phone, cnpj').eq('id', lojaId).single();
      return data;
    },
    enabled: !!lojaId
  });

  // Fetch clients for the dropdown
  const { data: clientes = [] } = useQuery({
    queryKey: ['clientes-vendas', lojaId],
    queryFn: async () => {
      let query = supabase.from('clientes').select('id, name');
      if (lojaId) query = query.eq('loja_id', lojaId);
      const { data } = await query.order('name');
      return data || [];
    },
    enabled: !!lojaId || role === 'master'
  });

  // Fetch sales
  const { data: sales = [], isLoading } = useQuery({
    queryKey: ['sales', lojaId],
    queryFn: async () => {
      let query = supabase.from('sales').select(`
        *,
        cliente:clientes(name),
        vendedora:profiles!sales_vendedora_id_fkey(full_name)
      `);
      if (lojaId) query = query.eq('loja_id', lojaId);
      const { data, error } = await query.order('created_at', { ascending: false });
      if (error) throw error;
      return data as unknown as Sale[];
    },
    enabled: !!lojaId || role === 'master'
  });

  const filteredSales = useMemo(() => {
    return sales.filter(s => 
      s.product_name.toLowerCase().includes(search.toLowerCase()) || 
      s.cliente?.name.toLowerCase().includes(search.toLowerCase()) ||
      s.internal_code?.toLowerCase().includes(search.toLowerCase())
    );
  }, [sales, search]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);
    try {
      const { error } = await supabase.from('sales').insert({
        cliente_id: form.cliente_id || null,
        product_name: form.product_name,
        internal_code: form.internal_code,
        quantity: parseInt(form.quantity),
        value: parseFloat(form.value.replace(',', '.')),
        discount: parseFloat(form.discount.replace(',', '.')),
        payment_method: form.payment_method,
        vendedora_id: user.id,
        loja_id: lojaId
      });

      if (error) throw error;
      toast.success('Venda registrada!');
      setIsAddOpen(false);
      setForm({
        cliente_id: '',
        product_name: '',
        internal_code: '',
        quantity: '1',
        value: '',
        discount: '0',
        payment_method: 'Pix'
      });
      queryClient.invalidateQueries({ queryKey: ['sales'] });
    } catch (err: any) {
      toast.error(err.message || 'Erro ao registrar venda');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir este registro de venda?')) return;
    try {
      const { error } = await supabase.from('sales').delete().eq('id', id);
      if (error) throw error;
      toast.success('Venda removida');
      queryClient.invalidateQueries({ queryKey: ['sales'] });
    } catch (err: any) {
      toast.error('Erro ao excluir');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Vendas</h1>
          <p className="text-muted-foreground font-medium">Registro e histórico de vendas diretas.</p>
        </div>
        <Button onClick={() => setIsAddOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" /> Nova Venda
        </Button>
      </div>

      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Buscar por cliente, produto ou código..." 
            className="pl-9" 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Button variant="outline" size="icon">
          <Filter className="h-4 w-4" />
        </Button>
      </div>

      <div className="border rounded-xl bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Data</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Produto</TableHead>
              <TableHead className="text-right">Qtd</TableHead>
              <TableHead className="text-right">Valor Final</TableHead>
              <TableHead>Pagamento</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="h-32 text-center">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                </TableCell>
              </TableRow>
            ) : filteredSales.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-32 text-center text-muted-foreground font-medium">
                  Nenhuma venda encontrada.
                </TableCell>
              </TableRow>
            ) : (
              filteredSales.map((sale) => (
                <TableRow key={sale.id}>
                  <TableCell className="text-muted-foreground">
                    {new Date(sale.created_at).toLocaleDateString('pt-BR')}
                  </TableCell>
                  <TableCell className="font-medium">{sale.cliente?.name || 'Cliente Avulso'}</TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span>{sale.product_name}</span>
                      <span className="text-xs text-muted-foreground">{sale.internal_code}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">{sale.quantity}</TableCell>
                  <TableCell className="text-right font-semibold text-success">
                    R$ {(sale.value - (sale.discount || 0)).toFixed(2).replace('.', ',')}
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-muted font-medium">
                      <CreditCard className="h-3 w-3" />
                      {sale.payment_method}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-primary"
                        title="Imprimir recibo"
                        onClick={() => setReceiptSale(sale)}
                      >
                        <Printer className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => handleDelete(sale.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Add Dialog */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Registrar Venda</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label>Cliente</Label>
              <Select value={form.cliente_id} onValueChange={(v) => setForm({...form, cliente_id: v})}>
                <SelectTrigger><SelectValue placeholder="Selecione o cliente" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="avulso">Cliente Avulso</SelectItem>
                  {clientes.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Produto *</Label>
              <Input 
                value={form.product_name} 
                onChange={(e) => setForm({...form, product_name: e.target.value})} 
                placeholder="Nome do produto" 
                required 
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Código</Label>
                <Input 
                  value={form.internal_code} 
                  onChange={(e) => setForm({...form, internal_code: e.target.value})} 
                  placeholder="REF-000" 
                />
              </div>
              <div className="space-y-2">
                <Label>Quantidade *</Label>
                <Input 
                  type="number" 
                  min="1" 
                  value={form.quantity} 
                  onChange={(e) => setForm({...form, quantity: e.target.value})} 
                  required 
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Valor Unitário (R$) *</Label>
                <Input 
                  value={form.value} 
                  onChange={(e) => setForm({...form, value: e.target.value})} 
                  placeholder="0,00" 
                  required 
                />
              </div>
              <div className="space-y-2">
                <Label>Desconto Total (R$)</Label>
                <Input 
                  value={form.discount} 
                  onChange={(e) => setForm({...form, discount: e.target.value})} 
                  placeholder="0,00" 
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Forma de Pagamento</Label>
              <Select value={form.payment_method} onValueChange={(v) => setForm({...form, payment_method: v})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Pix">Pix</SelectItem>
                  <SelectItem value="Cartão de Crédito">Cartão de Crédito</SelectItem>
                  <SelectItem value="Cartão de Débito">Cartão de Débito</SelectItem>
                  <SelectItem value="Dinheiro">Dinheiro</SelectItem>
                  <SelectItem value="Transferência">Transferência</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <DialogFooter className="pt-4">
              <Button type="button" variant="ghost" onClick={() => setIsAddOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={loading} className="min-w-[120px]">
                {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Registrar Venda
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ─── Sale Receipt Modal ─── */}
      {receiptSale && (
        <SaleReceipt
          open={!!receiptSale}
          onClose={() => setReceiptSale(null)}
          data={buildReceiptFromSale({
            sale: receiptSale,
            storeName: lojaData?.name ?? profile?.full_name ?? 'Malinha Fashion',
            storeCnpj: lojaData?.cnpj ?? undefined,
            storePhone: lojaData?.phone ?? undefined,
          })}
        />
      )}
    </div>
  );
}
