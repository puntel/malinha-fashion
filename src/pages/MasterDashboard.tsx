import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LogOut, Search, Store, Loader2, Plus, Users, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import type { Malinha } from '@/lib/types';

const statusColors: Record<string, string> = {
  'Enviada': 'bg-accent text-accent-foreground',
  'Em aberto': 'bg-primary/15 text-primary',
  'Pedido realizado': 'bg-secondary text-secondary-foreground',
  'Finalizada': 'bg-success text-success-foreground',
};

export default function MasterDashboard() {
  const navigate = useNavigate();
  const { profile, signOut } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<'malinhas' | 'lojas' | 'vendedoras'>('malinhas');
  const [lojaDialogOpen, setLojaDialogOpen] = useState(false);
  const [vendedoraDialogOpen, setVendedoraDialogOpen] = useState(false);

  // Loja form
  const [lojaForm, setLojaForm] = useState({ loja_name: '', loja_phone: '', loja_cnpj: '', owner_name: '', owner_email: '' });

  // Vendedora form
  const [vendedoraForm, setVendedoraForm] = useState({ full_name: '', email: '', phone: '', loja_id: '' });

  const { data: malinhas = [], isLoading } = useQuery({
    queryKey: ['master-malinhas'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('malinhas')
        .select('*, malinha_products(*)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data as unknown as Malinha[]) || [];
    },
  });

  const { data: lojas = [] } = useQuery({
    queryKey: ['lojas'],
    queryFn: async () => {
      const { data, error } = await supabase.from('lojas').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: vendedoras = [] } = useQuery({
    queryKey: ['master-vendedoras'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vendedoras')
        .select('*, profiles:user_id(full_name, email, phone), lojas:loja_id(name)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const createLojaMutation = useMutation({
    mutationFn: async () => {
      const res = await supabase.functions.invoke('manage-users', {
        body: { action: 'create_loja', ...lojaForm },
      });
      if (res.error) throw new Error(res.error.message);
      if (res.data?.error) throw new Error(res.data.error);
      return res.data;
    },
    onSuccess: (data) => {
      toast.success(`Loja criada! Senha temporária: ${data?.temporary_password || 'A1b2c3'}`);
      setLojaDialogOpen(false);
      setLojaForm({ loja_name: '', loja_phone: '', loja_cnpj: '', owner_name: '', owner_email: '' });
      queryClient.invalidateQueries({ queryKey: ['lojas'] });
    },
    onError: (err: Error) => {
      toast.error(`Erro ao criar loja: ${err.message}`);
    },
  });

  const createVendedoraMutation = useMutation({
    mutationFn: async () => {
      const res = await supabase.functions.invoke('manage-users', {
        body: { action: 'create_vendedora', ...vendedoraForm },
      });
      if (res.error) throw new Error(res.error.message);
      if (res.data?.error) throw new Error(res.data.error);
      return res.data;
    },
    onSuccess: (data) => {
      toast.success(`Vendedora criada! Senha temporária: ${data?.temporary_password || 'A1b2c3'}`);
      setVendedoraDialogOpen(false);
      setVendedoraForm({ full_name: '', email: '', phone: '', loja_id: '' });
      queryClient.invalidateQueries({ queryKey: ['master-vendedoras'] });
    },
    onError: (err: Error) => {
      toast.error(`Erro ao criar vendedora: ${err.message}`);
    },
  });

  const filtered = malinhas.filter((m) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return m.client_name.toLowerCase().includes(q) || m.client_phone.includes(q);
  });

  const formatDate = (d: string) => new Date(d).toLocaleDateString('pt-BR');

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b bg-card/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-4">
          <div>
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Master</p>
            <h1 className="font-display text-xl font-semibold text-foreground">
              Olá, {profile?.full_name || 'Admin'}
            </h1>
          </div>
          <Button variant="ghost" size="icon" onClick={signOut}>
            <LogOut className="h-5 w-5" />
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 pb-24 pt-4">
        {/* Tabs */}
        <div className="flex gap-2 mb-4">
          <Button variant={tab === 'malinhas' ? 'default' : 'outline'} size="sm" onClick={() => setTab('malinhas')}>
            Malinhas
          </Button>
          <Button variant={tab === 'lojas' ? 'default' : 'outline'} size="sm" onClick={() => setTab('lojas')}>
            <Store className="h-4 w-4 mr-1" /> Lojas
          </Button>
          <Button variant={tab === 'vendedoras' ? 'default' : 'outline'} size="sm" onClick={() => setTab('vendedoras')}>
            <Users className="h-4 w-4 mr-1" /> Vendedoras
          </Button>
        </div>

        {/* ─── Malinhas Tab ─── */}
        {tab === 'malinhas' && (
          <>
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar por nome ou telefone..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
            </div>
            {isLoading ? (
              <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
            ) : filtered.length === 0 ? (
              <p className="text-center text-muted-foreground py-20">Nenhuma malinha encontrada.</p>
            ) : (
              <div className="space-y-3">
                {filtered.map((m) => (
                  <button key={m.id} onClick={() => navigate(`/malinha/${m.id}/resumo`)} className="w-full rounded-xl border bg-card p-4 text-left transition-all hover:shadow-md active:scale-[0.98]">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-medium text-foreground truncate">{m.client_name}</p>
                        <p className="text-xs text-muted-foreground">Vendedora: {m.seller_name}</p>
                        <p className="text-sm text-muted-foreground mt-0.5">{formatDate(m.created_at)} · {m.malinha_products?.length || 0} peças</p>
                      </div>
                      <Badge className={`shrink-0 text-xs font-medium ${statusColors[m.status]}`}>{m.status}</Badge>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        {/* ─── Lojas Tab ─── */}
        {tab === 'lojas' && (
          <div className="space-y-3">
            <Dialog open={lojaDialogOpen} onOpenChange={setLojaDialogOpen}>
              <DialogTrigger asChild>
                <Button className="w-full gap-2" variant="outline">
                  <Plus className="h-4 w-4" /> Adicionar Loja
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Nova Loja</DialogTitle></DialogHeader>
                <form onSubmit={(e) => { e.preventDefault(); createLojaMutation.mutate(); }} className="space-y-3">
                  <div className="space-y-1">
                    <Label>Nome da Loja *</Label>
                    <Input value={lojaForm.loja_name} onChange={(e) => setLojaForm(f => ({ ...f, loja_name: e.target.value }))} required />
                  </div>
                  <div className="space-y-1">
                    <Label>Telefone da Loja</Label>
                    <Input value={lojaForm.loja_phone} onChange={(e) => setLojaForm(f => ({ ...f, loja_phone: e.target.value }))} />
                  </div>
                  <div className="space-y-1">
                    <Label>CNPJ</Label>
                    <Input value={lojaForm.loja_cnpj} onChange={(e) => setLojaForm(f => ({ ...f, loja_cnpj: e.target.value }))} />
                  </div>
                  <hr className="border-border" />
                  <p className="text-sm font-medium text-foreground">Usuário dono da loja</p>
                  <div className="space-y-1">
                    <Label>Nome completo *</Label>
                    <Input value={lojaForm.owner_name} onChange={(e) => setLojaForm(f => ({ ...f, owner_name: e.target.value }))} required />
                  </div>
                  <div className="space-y-1">
                    <Label>E-mail *</Label>
                    <Input type="email" value={lojaForm.owner_email} onChange={(e) => setLojaForm(f => ({ ...f, owner_email: e.target.value }))} required />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    A senha é gerada automaticamente e exibida após criar a loja.
                  </p>
                  <Button type="submit" className="w-full" disabled={createLojaMutation.isPending}>
                    {createLojaMutation.isPending ? 'Criando...' : 'Criar Loja'}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>

            {lojas.length === 0 ? (
              <p className="text-center text-muted-foreground py-20">Nenhuma loja cadastrada.</p>
            ) : (
              lojas.map((l: any) => (
                <div key={l.id} className="rounded-xl border bg-card p-4">
                  <p className="font-medium text-foreground">{l.name}</p>
                  {l.phone && <p className="text-sm text-muted-foreground">{l.phone}</p>}
                  {l.cnpj && <p className="text-xs text-muted-foreground">CNPJ: {l.cnpj}</p>}
                </div>
              ))
            )}
          </div>
        )}

        {/* ─── Vendedoras Tab ─── */}
        {tab === 'vendedoras' && (
          <div className="space-y-3">
            <Dialog open={vendedoraDialogOpen} onOpenChange={setVendedoraDialogOpen}>
              <DialogTrigger asChild>
                <Button className="w-full gap-2" variant="outline">
                  <UserPlus className="h-4 w-4" /> Adicionar Vendedora
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Nova Vendedora</DialogTitle></DialogHeader>
                <form onSubmit={(e) => { e.preventDefault(); createVendedoraMutation.mutate(); }} className="space-y-3">
                  <div className="space-y-1">
                    <Label>Nome completo *</Label>
                    <Input value={vendedoraForm.full_name} onChange={(e) => setVendedoraForm(f => ({ ...f, full_name: e.target.value }))} required />
                  </div>
                  <div className="space-y-1">
                    <Label>E-mail *</Label>
                    <Input type="email" value={vendedoraForm.email} onChange={(e) => setVendedoraForm(f => ({ ...f, email: e.target.value }))} required />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    A senha é gerada automaticamente e exibida após criar a vendedora.
                  </p>
                  <div className="space-y-1">
                    <Label>Celular</Label>
                    <Input value={vendedoraForm.phone} onChange={(e) => setVendedoraForm(f => ({ ...f, phone: e.target.value }))} placeholder="(31) 99999-9999" />
                  </div>
                  <div className="space-y-1">
                    <Label>Loja *</Label>
                    <Select value={vendedoraForm.loja_id} onValueChange={(v) => setVendedoraForm(f => ({ ...f, loja_id: v }))}>
                      <SelectTrigger><SelectValue placeholder="Selecione a loja" /></SelectTrigger>
                      <SelectContent>
                        {lojas.map((l: any) => (
                          <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button type="submit" className="w-full" disabled={createVendedoraMutation.isPending || !vendedoraForm.loja_id}>
                    {createVendedoraMutation.isPending ? 'Criando...' : 'Criar Vendedora'}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>

            {vendedoras.length === 0 ? (
              <p className="text-center text-muted-foreground py-20">Nenhuma vendedora cadastrada.</p>
            ) : (
              vendedoras.map((v: any) => (
                <div key={v.id} className="rounded-xl border bg-card p-4">
                  <p className="font-medium text-foreground">{v.profiles?.full_name || 'Sem nome'}</p>
                  <p className="text-sm text-muted-foreground">{v.profiles?.email || ''}</p>
                  {v.profiles?.phone && <p className="text-xs text-muted-foreground">Tel: {v.profiles.phone}</p>}
                  <p className="text-xs text-muted-foreground mt-1">Loja: {v.lojas?.name || '—'}</p>
                </div>
              ))
            )}
          </div>
        )}
      </main>
    </div>
  );
}
