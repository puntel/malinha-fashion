import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { LogOut, Search, Plus, Loader2, Users, UserPlus, MoreVertical, Pencil, Archive, ArchiveRestore, Trash2, UserRound } from 'lucide-react';
import { toast } from 'sonner';
import type { Malinha } from '@/lib/types';
import MalinhaActions from '@/components/MalinhaActions';
import ClientesTab from '@/components/ClientesTab';

const statusColors: Record<string, string> = {
  'Enviada': 'bg-accent text-accent-foreground',
  'Em aberto': 'bg-primary/15 text-primary',
  'Pedido realizado': 'bg-secondary text-secondary-foreground',
  'Finalizada': 'bg-success text-success-foreground',
};

type Tab = 'malinhas' | 'vendedoras' | 'clientes';

export default function LojaDashboard() {
  const navigate = useNavigate();
  const { profile, signOut } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<Tab>('malinhas');
  const [showArchivedVendedoras, setShowArchivedVendedoras] = useState(false);
  const [showAddVendedora, setShowAddVendedora] = useState(false);
  const [vendedoraForm, setVendedoraForm] = useState({ full_name: '', email: '', phone: '' });
  const [creating, setCreating] = useState(false);
  const [editVendedora, setEditVendedora] = useState<any | null>(null);
  const [editVendedoraForm, setEditVendedoraForm] = useState({ full_name: '', phone: '' });
  const [deleteVendedora, setDeleteVendedora] = useState<any | null>(null);

  const { data: lojaId } = useQuery({
    queryKey: ['my-loja-id'],
    queryFn: async () => {
      const { data } = await supabase.from('loja_members').select('loja_id').single();
      return data?.loja_id || null;
    },
  });

  const { data: malinhas = [], isLoading } = useQuery({
    queryKey: ['loja-malinhas'],
    queryFn: async () => {
      const { data, error } = await supabase.from('malinhas').select('*, malinha_products(*)').order('created_at', { ascending: false });
      if (error) throw error;
      return (data as unknown as Malinha[]) || [];
    },
  });

  const { data: vendedoras = [] } = useQuery({
    queryKey: ['loja-vendedoras'],
    queryFn: async () => {
      const { data: vendedorasData, error } = await supabase.from('vendedoras').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      const userIds = [...new Set((vendedorasData || []).map(v => v.user_id))];
      if (userIds.length === 0) return [];
      const { data: profilesData } = await supabase.from('profiles').select('user_id, full_name, email, phone').in('user_id', userIds);
      const profileByUserId = new Map((profilesData || []).map(p => [p.user_id, p]));
      return (vendedorasData || []).map(v => ({ ...v, profile: profileByUserId.get(v.user_id) || null }));
    },
  });

  const filtered = malinhas.filter(m => {
    if (!search) return true;
    const q = search.toLowerCase();
    return m.client_name.toLowerCase().includes(q) || m.client_phone.includes(q);
  });

  const vendedorasVisible = vendedoras.filter((v: any) => !!v.archived === showArchivedVendedoras);
  const formatDate = (d: string) => new Date(d).toLocaleDateString('pt-BR');

  const handleCreateVendedora = async () => {
    if (!vendedoraForm.full_name.trim() || !vendedoraForm.email.trim()) { toast.error('Preencha nome e e-mail'); return; }
    if (!lojaId) { toast.error('Loja não encontrada'); return; }
    setCreating(true);
    try {
      const { data, error } = await supabase.functions.invoke('manage-users', {
        body: { action: 'create_vendedora', email: vendedoraForm.email.trim(), full_name: vendedoraForm.full_name.trim(), phone: vendedoraForm.phone.trim() || null, loja_id: lojaId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success('Vendedora criada com sucesso!');
      setVendedoraForm({ full_name: '', email: '', phone: '' });
      setShowAddVendedora(false);
      queryClient.invalidateQueries({ queryKey: ['loja-vendedoras'] });
    } catch (err: any) {
      toast.error(err.message || 'Erro ao criar vendedora');
    } finally {
      setCreating(false);
    }
  };

  const openEditVendedora = (v: any) => {
    setEditVendedora(v);
    setEditVendedoraForm({ full_name: v.profile?.full_name || '', phone: v.profile?.phone || '' });
  };

  const handleEditVendedora = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editVendedora) return;
    const { error } = await supabase.from('profiles').update({ full_name: editVendedoraForm.full_name, phone: editVendedoraForm.phone || null }).eq('user_id', editVendedora.user_id);
    if (error) { toast.error('Erro ao editar vendedora'); return; }
    toast.success('Vendedora atualizada!');
    setEditVendedora(null);
    queryClient.invalidateQueries({ queryKey: ['loja-vendedoras'] });
  };

  const handleArchiveVendedora = async (v: any) => {
    const { error } = await supabase.from('vendedoras').update({ archived: !v.archived }).eq('id', v.id);
    if (error) { toast.error('Erro ao arquivar vendedora'); return; }
    toast.success(v.archived ? 'Vendedora reativada!' : 'Vendedora arquivada!');
    queryClient.invalidateQueries({ queryKey: ['loja-vendedoras'] });
  };

  const handleDeleteVendedora = async () => {
    if (!deleteVendedora) return;
    await supabase.from('user_roles').delete().eq('user_id', deleteVendedora.user_id);
    const { error } = await supabase.from('vendedoras').delete().eq('id', deleteVendedora.id);
    if (error) { toast.error('Erro ao excluir vendedora'); return; }
    toast.success('Vendedora removida!');
    setDeleteVendedora(null);
    queryClient.invalidateQueries({ queryKey: ['loja-vendedoras'] });
  };

  const vendedorasForClientes = vendedoras
    .filter((v: any) => !v.archived)
    .map((v: any) => ({ user_id: v.user_id, name: v.profile?.full_name || v.profile?.email || 'Vendedora', loja_id: v.loja_id || lojaId || '' }));

  const tabs: { key: Tab; label: string; icon?: React.ReactNode }[] = [
    { key: 'malinhas', label: 'Malinhas' },
    { key: 'vendedoras', label: 'Vendedoras', icon: <Users className="h-4 w-4" /> },
    { key: 'clientes', label: 'Clientes', icon: <UserRound className="h-4 w-4" /> },
  ];

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b bg-card/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-4">
          <div>
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Loja</p>
            <h1 className="font-display text-xl font-semibold text-foreground">Olá, {profile?.full_name || 'Loja'}</h1>
          </div>
          <Button variant="ghost" size="icon" onClick={signOut}><LogOut className="h-5 w-5" /></Button>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 pb-24 pt-4">
        <div className="flex gap-2 mb-4 flex-wrap">
          {tabs.map(t => (
            <Button key={t.key} variant={tab === t.key ? 'default' : 'outline'} size="sm" onClick={() => setTab(t.key)} className="gap-1.5">
              {t.icon}{t.label}
            </Button>
          ))}
        </div>

        {/* ─── Malinhas Tab ─── */}
        {tab === 'malinhas' && (
          <>
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar por nome ou telefone..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
            </div>
            {isLoading ? (
              <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
            ) : filtered.length === 0 ? (
              <p className="text-center text-muted-foreground py-20">Nenhuma malinha encontrada.</p>
            ) : (
              <div className="space-y-3">
                {filtered.map(m => (
                  <div key={m.id} className="relative w-full rounded-xl border bg-card p-4 text-left transition-all hover:shadow-md">
                    <button onClick={() => navigate(`/malinha/${m.id}/resumo`)} className="w-full text-left active:scale-[0.98]">
                      <div className="flex items-start justify-between gap-2 pr-8">
                        <div className="min-w-0">
                          <p className="font-medium text-foreground truncate">{m.client_name}</p>
                          <p className="text-xs text-muted-foreground">Vendedora: {m.seller_name}</p>
                          <p className="text-sm text-muted-foreground mt-0.5">{formatDate(m.created_at)} · {m.malinha_products?.length || 0} peças</p>
                        </div>
                        <Badge className={`shrink-0 text-xs font-medium ${statusColors[m.status]}`}>{m.status}</Badge>
                      </div>
                    </button>
                    <div className="absolute top-3 right-3"><MalinhaActions malinha={m} /></div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ─── Vendedoras Tab ─── */}
        {tab === 'vendedoras' && (
          <div className="space-y-3">
            <div className="flex gap-2">
              <Dialog open={showAddVendedora} onOpenChange={setShowAddVendedora}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="flex-1 gap-2"><UserPlus className="h-4 w-4" /> Adicionar Vendedora</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Nova Vendedora</DialogTitle></DialogHeader>
                  <div className="space-y-4 pt-2">
                    <div className="space-y-2"><Label>Nome completo *</Label><Input value={vendedoraForm.full_name} onChange={e => setVendedoraForm(f => ({ ...f, full_name: e.target.value }))} placeholder="Nome da vendedora" /></div>
                    <div className="space-y-2"><Label>E-mail *</Label><Input type="email" value={vendedoraForm.email} onChange={e => setVendedoraForm(f => ({ ...f, email: e.target.value }))} placeholder="email@exemplo.com" /></div>
                    <div className="space-y-2"><Label>Telefone</Label><Input value={vendedoraForm.phone} onChange={e => setVendedoraForm(f => ({ ...f, phone: e.target.value }))} placeholder="(00) 00000-0000" /></div>
                    <Button onClick={handleCreateVendedora} disabled={creating} className="w-full">
                      {creating && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Criar Vendedora
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
              <Button variant={showArchivedVendedoras ? 'default' : 'outline'} size="sm" onClick={() => setShowArchivedVendedoras(s => !s)} className="gap-1.5">
                <Archive className="h-4 w-4" />{showArchivedVendedoras ? 'Ativas' : 'Arquivadas'}
              </Button>
            </div>

            {vendedorasVisible.length === 0 ? (
              <p className="text-center text-muted-foreground py-16">{showArchivedVendedoras ? 'Nenhuma vendedora arquivada.' : 'Nenhuma vendedora cadastrada.'}</p>
            ) : (
              vendedorasVisible.map((v: any) => (
                <div key={v.id} className={`rounded-xl border bg-card p-4 flex items-start gap-3 ${v.archived ? 'opacity-60' : ''}`}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-foreground truncate">{v.profile?.full_name || 'Sem nome'}</p>
                      {v.archived && <Badge variant="outline" className="text-xs shrink-0">Arquivada</Badge>}
                    </div>
                    <p className="text-sm text-muted-foreground">{v.profile?.email || ''}</p>
                    {v.profile?.phone && <p className="text-xs text-muted-foreground">Tel: {v.profile.phone}</p>}
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0"><MoreVertical className="h-4 w-4" /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => openEditVendedora(v)}><Pencil className="h-4 w-4 mr-2" /> Editar</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleArchiveVendedora(v)}>
                        {v.archived ? <><ArchiveRestore className="h-4 w-4 mr-2" /> Reativar</> : <><Archive className="h-4 w-4 mr-2" /> Arquivar</>}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setDeleteVendedora(v)} className="text-destructive focus:text-destructive"><Trash2 className="h-4 w-4 mr-2" /> Excluir</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ))
            )}
          </div>
        )}

        {/* ─── Clientes Tab ─── */}
        {tab === 'clientes' && (
          <ClientesTab
            role="loja"
            filterLojaId={lojaId || undefined}
            defaultLojaId={lojaId || undefined}
            canCreate={true}
            availableVendedoras={vendedorasForClientes}
          />
        )}
      </main>

      <div className="fixed bottom-6 left-0 right-0 flex justify-center">
        <Button onClick={() => navigate('/nova-malinha')} size="lg" className="rounded-full shadow-lg px-6 gap-2">
          <Plus className="h-5 w-5" /> Nova Malinha
        </Button>
      </div>

      {/* Edit Vendedora Dialog */}
      <Dialog open={!!editVendedora} onOpenChange={open => { if (!open) setEditVendedora(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar Vendedora</DialogTitle></DialogHeader>
          <form onSubmit={handleEditVendedora} className="space-y-3">
            <div className="space-y-1"><Label>Nome completo *</Label><Input value={editVendedoraForm.full_name} onChange={e => setEditVendedoraForm(f => ({ ...f, full_name: e.target.value }))} required /></div>
            <div className="space-y-1"><Label>Telefone</Label><Input value={editVendedoraForm.phone} onChange={e => setEditVendedoraForm(f => ({ ...f, phone: e.target.value }))} /></div>
            <Button type="submit" className="w-full">Salvar</Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Vendedora Confirmation */}
      <Dialog open={!!deleteVendedora} onOpenChange={open => { if (!open) setDeleteVendedora(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir Vendedora</DialogTitle>
            <DialogDescription>Tem certeza que deseja remover <strong>{deleteVendedora?.profile?.full_name}</strong>? A conta de login será mantida, mas o acesso será revogado.</DialogDescription>
          </DialogHeader>
          <div className="flex gap-2 justify-end pt-2">
            <Button variant="outline" onClick={() => setDeleteVendedora(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDeleteVendedora}>Excluir</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
