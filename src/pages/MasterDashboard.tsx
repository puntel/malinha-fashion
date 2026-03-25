import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { LogOut, Search, Store, Loader2, Plus, Users, UserPlus, MoreVertical, Pencil, Archive, ArchiveRestore, Trash2, UserRound, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import type { Malinha, Loja, Vendedora, Profile } from '@/lib/types';
import MalinhaActions from '@/components/MalinhaActions';
import ClientesTab from '@/components/ClientesTab';

const statusColors: Record<string, string> = {
  'Enviada': 'bg-accent text-accent-foreground',
  'Em aberto': 'bg-primary/15 text-primary',
  'Pedido realizado': 'bg-secondary text-secondary-foreground',
  'Finalizada': 'bg-success text-success-foreground',
};

type Tab = 'malinhas' | 'lojas' | 'vendedoras' | 'clientes' | 'admins';

export default function MasterDashboard() {
  const navigate = useNavigate();
  const { user, profile, signOut } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<Tab>('malinhas');
  const [showArchivedLojas, setShowArchivedLojas] = useState(false);
  const [showArchivedVendedoras, setShowArchivedVendedoras] = useState(false);

  // Dialogs
  const [lojaDialogOpen, setLojaDialogOpen] = useState(false);
  const [vendedoraDialogOpen, setVendedoraDialogOpen] = useState(false);
  const [editLoja, setEditLoja] = useState<Loja | null>(null);
  const [editVendedora, setEditVendedora] = useState<Vendedora | null>(null);
  const [deleteLoja, setDeleteLoja] = useState<Loja | null>(null);
  const [deleteVendedora, setDeleteVendedora] = useState<Vendedora | null>(null);
  const [masterDialogOpen, setMasterDialogOpen] = useState(false);
  const [editMaster, setEditMaster] = useState<Profile | null>(null);
  const [deleteMaster, setDeleteMaster] = useState<Profile | null>(null);

  // Forms
  const [lojaForm, setLojaForm] = useState({ loja_name: '', loja_phone: '', loja_cnpj: '', owner_name: '', owner_email: '' });
  const [vendedoraForm, setVendedoraForm] = useState({ full_name: '', email: '', phone: '', loja_id: '' });
  const [editLojaForm, setEditLojaForm] = useState({ name: '', phone: '', cnpj: '' });
  const [editVendedoraForm, setEditVendedoraForm] = useState({ full_name: '', phone: '' });
  const [masterForm, setMasterForm] = useState({ full_name: '', email: '', phone: '' });
  const [editMasterForm, setEditMasterForm] = useState({ full_name: '', phone: '' });

  const { data: malinhas = [], isLoading } = useQuery({
    queryKey: ['master-malinhas'],
    queryFn: async () => {
      const { data, error } = await supabase.from('malinhas').select('*, malinha_products(*)').order('created_at', { ascending: false });
      if (error) throw error;
      return (data as unknown as Malinha[]) || [];
    },
  });

  const { data: lojas = [] } = useQuery({
    queryKey: ['lojas'],
    queryFn: async () => {
      const { data, error } = await supabase.from('lojas').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return (data as unknown as Loja[]) || [];
    },
  });

  const { data: vendedoras = [] } = useQuery({
    queryKey: ['master-vendedoras'],
    queryFn: async () => {
      const { data: vendedorasData, error: vendedorasError } = await supabase.from('vendedoras').select('*').order('created_at', { ascending: false });
      if (vendedorasError) throw vendedorasError;
      const vendedorasTyped = (vendedorasData || []) as unknown as Vendedora[];

      const userIds = [...new Set(vendedorasTyped.map(v => v.user_id))];
      const lojaIds = [...new Set(vendedorasTyped.map(v => v.loja_id))];

      let profilesData: Profile[] = [];
      if (userIds.length > 0) {
        const { data } = await supabase.from('profiles').select('user_id, full_name, email, phone').in('user_id', userIds);
        profilesData = (data as unknown as Profile[]) || [];
      }

      let lojasData: { id: string; name: string }[] = [];
      if (lojaIds.length > 0) {
        const { data } = await supabase.from('lojas').select('id, name').in('id', lojaIds);
        lojasData = (data as unknown as { id: string; name: string }[]) || [];
      }

      const profileByUserId = new Map(profilesData.map(p => [p.user_id, p]));
      const lojaById = new Map(lojasData.map(l => [l.id, l]));

      return vendedorasTyped.map(v => ({
        ...v,
        profile: profileByUserId.get(v.user_id) || null,
        loja: lojaById.get(v.loja_id) || null,
      })) as Vendedora[];
    },
  });
  
  const { data: admins = [], isLoading: isLoadingAdmins } = useQuery({
    queryKey: ['master-admins'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_roles')
        .select('user_id, role')
        .eq('role', 'master');
      
      if (error) throw error;
      
      const userIds = data.map(r => r.user_id);
      if (userIds.length === 0) return [];
      
      const { data: profiles, error: pError } = await supabase
        .from('profiles')
        .select('user_id, full_name, email, phone')
        .in('user_id', userIds);
        
      if (pError) throw pError;
      return (profiles as unknown as Profile[]) || [];
    },
    enabled: tab === 'admins',
  });

  const createLojaMutation = useMutation({
    mutationFn: async () => {
      const res = await supabase.functions.invoke('manage-users', { body: { action: 'create_loja', ...lojaForm } });
      if (res.error) throw new Error(res.error.message);
      if (res.data?.error) throw new Error(res.data.error);
      return res.data;
    },
    onSuccess: (data: unknown) => {
      const tempPassword = (data as { temporary_password?: string })?.temporary_password || 'A1b2c3';
      toast.success(`Loja criada! Senha temporária: ${tempPassword}`);
      setLojaDialogOpen(false);
      setLojaForm({ loja_name: '', loja_phone: '', loja_cnpj: '', owner_name: '', owner_email: '' });
      queryClient.invalidateQueries({ queryKey: ['lojas'] });
    },
    onError: (err: Error) => toast.error(`Erro ao criar loja: ${err.message}`),
  });

  const createVendedoraMutation = useMutation({
    mutationFn: async () => {
      const res = await supabase.functions.invoke('manage-users', { body: { action: 'create_vendedora', ...vendedoraForm } });
      if (res.error) throw new Error(res.error.message);
      if (res.data?.error) throw new Error(res.data.error);
      return res.data;
    },
    onSuccess: (data: unknown) => {
      const tempPassword = (data as { temporary_password?: string })?.temporary_password || 'A1b2c3';
      toast.success(`Vendedora criada! Senha temporária: ${tempPassword}`);
      setVendedoraDialogOpen(false);
      setVendedoraForm({ full_name: '', email: '', phone: '', loja_id: '' });
      queryClient.invalidateQueries({ queryKey: ['master-vendedoras'] });
    },
    onError: (err: Error) => toast.error(`Erro ao criar vendedora: ${err.message}`),
  });

  const createMasterMutation = useMutation({
    mutationFn: async () => {
      const res = await supabase.functions.invoke('manage-users', { body: { action: 'create_master', ...masterForm } });
      if (res.error) throw new Error(res.error.message);
      if (res.data?.error) throw new Error(res.data.error);
      return res.data;
    },
    onSuccess: (data: unknown) => {
      const tempPassword = (data as { temporary_password?: string })?.temporary_password || 'A1b2c3';
      toast.success(`Administrador criado! Senha temporária: ${tempPassword}`);
      setMasterDialogOpen(false);
      setMasterForm({ full_name: '', email: '', phone: '' });
      queryClient.invalidateQueries({ queryKey: ['master-admins'] });
    },
    onError: (err: Error) => toast.error(`Erro ao criar administrador: ${err.message}`),
  });

  const handleEditMaster = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editMaster) return;
    const { error } = await supabase.functions.invoke('manage-users', {
      body: { action: 'update_profile', user_id: editMaster.user_id, full_name: editMasterForm.full_name, phone: editMasterForm.phone }
    });
    if (error) { toast.error('Erro ao editar administrador'); return; }
    toast.success('Administrador atualizado!');
    setEditMaster(null);
    queryClient.invalidateQueries({ queryKey: ['master-admins'] });
  };

  const handleDeleteMaster = async () => {
    if (!deleteMaster) return;
    // Don't allow self-deletion
    if (deleteMaster.user_id === user?.id) {
      toast.error('Você não pode excluir sua própria conta.');
      setDeleteMaster(null);
      return;
    }
    const { error } = await supabase.functions.invoke('manage-users', {
      body: { action: 'delete_user', user_id: deleteMaster.user_id }
    });
    if (error) { toast.error('Erro ao excluir administrador'); return; }
    toast.success('Administrador removido!');
    setDeleteMaster(null);
    queryClient.invalidateQueries({ queryKey: ['master-admins'] });
  };

  const openEditLoja = (l: Loja) => {
    setEditLoja(l);
    setEditLojaForm({ name: l.name, phone: l.phone || '', cnpj: l.cnpj || '' });
  };

  const handleEditLoja = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editLoja) return;
    const { error } = await supabase.from('lojas').update({ name: editLojaForm.name, phone: editLojaForm.phone || null, cnpj: editLojaForm.cnpj || null }).eq('id', editLoja.id);
    if (error) { toast.error('Erro ao editar loja'); return; }
    toast.success('Loja atualizada!');
    setEditLoja(null);
    queryClient.invalidateQueries({ queryKey: ['lojas'] });
  };

  const handleArchiveLoja = async (l: Loja) => {
    const { error } = await supabase.from('lojas').update({ archived: !l.archived } as any).eq('id', l.id);
    if (error) { toast.error('Erro ao arquivar loja'); return; }
    toast.success(l.archived ? 'Loja reativada!' : 'Loja arquivada!');
    queryClient.invalidateQueries({ queryKey: ['lojas'] });
  };

  const handleDeleteLoja = async () => {
    if (!deleteLoja) return;
    const { error } = await supabase.from('lojas').delete().eq('id', deleteLoja.id);
    if (error) { toast.error('Erro ao excluir loja'); return; }
    toast.success('Loja excluída!');
    setDeleteLoja(null);
    queryClient.invalidateQueries({ queryKey: ['lojas'] });
    queryClient.invalidateQueries({ queryKey: ['master-vendedoras'] });
  };

  const openEditVendedora = (v: Vendedora) => {
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
    queryClient.invalidateQueries({ queryKey: ['master-vendedoras'] });
  };

  const handleArchiveVendedora = async (v: Vendedora) => {
    const { error } = await supabase.from('vendedoras').update({ archived: !v.archived } as any).eq('id', v.id);
    if (error) { toast.error('Erro ao arquivar vendedora'); return; }
    toast.success(v.archived ? 'Vendedora reativada!' : 'Vendedora arquivada!');
    queryClient.invalidateQueries({ queryKey: ['master-vendedoras'] });
  };

  const handleDeleteVendedora = async () => {
    if (!deleteVendedora) return;
    await supabase.from('user_roles').delete().eq('user_id', deleteVendedora.user_id);
    const { error } = await supabase.from('vendedoras').delete().eq('id', deleteVendedora.id);
    if (error) { toast.error('Erro ao excluir vendedora'); return; }
    toast.success('Vendedora removida!');
    setDeleteVendedora(null);
    queryClient.invalidateQueries({ queryKey: ['master-vendedoras'] });
  };

  const filtered = malinhas.filter(m => {
    if (!search) return true;
    const q = search.toLowerCase();
    return m.client_name.toLowerCase().includes(q) || m.client_phone.includes(q);
  });

  const lojasVisible = lojas.filter((l) => !!l.archived === showArchivedLojas);
  const vendedorasVisible = vendedoras.filter((v) => !!v.archived === showArchivedVendedoras);
  const formatDate = (d: string) => new Date(d).toLocaleDateString('pt-BR');

  const allVendedorasForClientes = vendedoras
    .filter((v) => !v.archived)
    .map((v) => ({ user_id: v.user_id, name: v.profile?.full_name || v.profile?.email || 'Vendedora', loja_id: v.loja_id }));

  const tabs: { key: Tab; label: string; icon?: React.ReactNode }[] = [
    { key: 'malinhas', label: 'Malinhas' },
    { key: 'lojas', label: 'Lojas', icon: <Store className="h-4 w-4" /> },
    { key: 'vendedoras', label: 'Vendedoras', icon: <Users className="h-4 w-4" /> },
    { key: 'clientes', label: 'Clientes', icon: <UserRound className="h-4 w-4" /> },
    { key: 'admins', label: 'Admins', icon: <ShieldCheck className="h-4 w-4" /> },
  ];

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b bg-card/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-4">
          <div>
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Master</p>
            <h1 className="font-display text-xl font-semibold text-foreground">BagSync</h1>
          </div>
          <Button variant="ghost" size="icon" onClick={signOut}><LogOut className="h-5 w-5" /></Button>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 pb-24 pt-4">
        {/* Tabs */}
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

        {/* ─── Lojas Tab ─── */}
        {tab === 'lojas' && (
          <div className="space-y-3">
            <div className="flex gap-2">
              <Dialog open={lojaDialogOpen} onOpenChange={setLojaDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="flex-1 gap-2" variant="outline"><Plus className="h-4 w-4" /> Adicionar Loja</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Nova Loja</DialogTitle></DialogHeader>
                  <form onSubmit={e => { e.preventDefault(); createLojaMutation.mutate(); }} className="space-y-3">
                    <div className="space-y-1"><Label>Nome da Loja *</Label><Input value={lojaForm.loja_name} onChange={e => setLojaForm(f => ({ ...f, loja_name: e.target.value }))} required /></div>
                    <div className="space-y-1"><Label>Telefone</Label><Input value={lojaForm.loja_phone} onChange={e => setLojaForm(f => ({ ...f, loja_phone: e.target.value }))} /></div>
                    <div className="space-y-1"><Label>CNPJ</Label><Input value={lojaForm.loja_cnpj} onChange={e => setLojaForm(f => ({ ...f, loja_cnpj: e.target.value }))} /></div>
                    <hr className="border-border" />
                    <p className="text-sm font-medium">Usuário dono da loja</p>
                    <div className="space-y-1"><Label>Nome completo *</Label><Input value={lojaForm.owner_name} onChange={e => setLojaForm(f => ({ ...f, owner_name: e.target.value }))} required /></div>
                    <div className="space-y-1"><Label>E-mail *</Label><Input type="email" value={lojaForm.owner_email} onChange={e => setLojaForm(f => ({ ...f, owner_email: e.target.value }))} required /></div>
                    <p className="text-xs text-muted-foreground">A senha é gerada automaticamente.</p>
                    <Button type="submit" className="w-full" disabled={createLojaMutation.isPending}>{createLojaMutation.isPending ? 'Criando...' : 'Criar Loja'}</Button>
                  </form>
                </DialogContent>
              </Dialog>
              <Button variant={showArchivedLojas ? 'default' : 'outline'} size="sm" onClick={() => setShowArchivedLojas(s => !s)} className="gap-1.5">
                <Archive className="h-4 w-4" />{showArchivedLojas ? 'Ativas' : 'Arquivadas'}
              </Button>
            </div>

            {lojasVisible.length === 0 ? (
              <p className="text-center text-muted-foreground py-16">{showArchivedLojas ? 'Nenhuma loja arquivada.' : 'Nenhuma loja cadastrada.'}</p>
            ) : (
              lojasVisible.map((l) => (
                <div key={l.id} className={`rounded-xl border bg-card p-4 flex items-start gap-3 ${l.archived ? 'opacity-60' : ''}`}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-foreground truncate">{l.name}</p>
                      {l.archived && <Badge variant="outline" className="text-xs shrink-0">Arquivada</Badge>}
                    </div>
                    {l.phone && <p className="text-sm text-muted-foreground">{l.phone}</p>}
                    {l.cnpj && <p className="text-xs text-muted-foreground">CNPJ: {l.cnpj}</p>}
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0"><MoreVertical className="h-4 w-4" /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => openEditLoja(l)}><Pencil className="h-4 w-4 mr-2" /> Editar</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleArchiveLoja(l)}>
                        {l.archived ? <><ArchiveRestore className="h-4 w-4 mr-2" /> Reativar</> : <><Archive className="h-4 w-4 mr-2" /> Arquivar</>}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setDeleteLoja(l)} className="text-destructive focus:text-destructive"><Trash2 className="h-4 w-4 mr-2" /> Excluir</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ))
            )}
          </div>
        )}

        {/* ─── Vendedoras Tab ─── */}
        {tab === 'vendedoras' && (
          <div className="space-y-3">
            <div className="flex gap-2">
              <Dialog open={vendedoraDialogOpen} onOpenChange={setVendedoraDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="flex-1 gap-2" variant="outline"><UserPlus className="h-4 w-4" /> Adicionar Vendedora</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Nova Vendedora</DialogTitle></DialogHeader>
                  <form onSubmit={e => { e.preventDefault(); createVendedoraMutation.mutate(); }} className="space-y-3">
                    <div className="space-y-1"><Label>Nome completo *</Label><Input value={vendedoraForm.full_name} onChange={e => setVendedoraForm(f => ({ ...f, full_name: e.target.value }))} required /></div>
                    <div className="space-y-1"><Label>E-mail *</Label><Input type="email" value={vendedoraForm.email} onChange={e => setVendedoraForm(f => ({ ...f, email: e.target.value }))} required /></div>
                    <div className="space-y-1"><Label>Celular</Label><Input value={vendedoraForm.phone} onChange={e => setVendedoraForm(f => ({ ...f, phone: e.target.value }))} placeholder="(31) 99999-9999" /></div>
                    <div className="space-y-1">
                      <Label>Loja *</Label>
                      <Select value={vendedoraForm.loja_id} onValueChange={v => setVendedoraForm(f => ({ ...f, loja_id: v }))}>
                        <SelectTrigger><SelectValue placeholder="Selecione a loja" /></SelectTrigger>
                        <SelectContent>{lojas.filter((l) => !l.archived).map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <p className="text-xs text-muted-foreground">A senha é gerada automaticamente.</p>
                    <Button type="submit" className="w-full" disabled={createVendedoraMutation.isPending || !vendedoraForm.loja_id}>{createVendedoraMutation.isPending ? 'Criando...' : 'Criar Vendedora'}</Button>
                  </form>
                </DialogContent>
              </Dialog>
              <Button variant={showArchivedVendedoras ? 'default' : 'outline'} size="sm" onClick={() => setShowArchivedVendedoras(s => !s)} className="gap-1.5">
                <Archive className="h-4 w-4" />{showArchivedVendedoras ? 'Ativas' : 'Arquivadas'}
              </Button>
            </div>

            {vendedorasVisible.length === 0 ? (
              <p className="text-center text-muted-foreground py-16">{showArchivedVendedoras ? 'Nenhuma vendedora arquivada.' : 'Nenhuma vendedora cadastrada.'}</p>
            ) : (
              vendedorasVisible.map((v) => (
                <div key={v.id} className={`rounded-xl border bg-card p-4 flex items-start gap-3 ${v.archived ? 'opacity-60' : ''}`}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-foreground truncate">{v.profile?.full_name || 'Sem nome'}</p>
                      {v.archived && <Badge variant="outline" className="text-xs shrink-0">Arquivada</Badge>}
                    </div>
                    <p className="text-sm text-muted-foreground">{v.profile?.email || ''}</p>
                    {v.profile?.phone && <p className="text-xs text-muted-foreground">Tel: {v.profile.phone}</p>}
                    <p className="text-xs text-muted-foreground mt-0.5">Loja: {v.loja?.name || '—'}</p>
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
            role="master"
            canCreate={true}
            availableVendedoras={allVendedorasForClientes}
          />
        )}

        {/* ─── Admins Tab ─── */}
        {tab === 'admins' && (
          <div className="space-y-3">
            <Dialog open={masterDialogOpen} onOpenChange={setMasterDialogOpen}>
              <DialogTrigger asChild>
                <Button className="w-full gap-2" variant="outline"><UserPlus className="h-4 w-4" /> Adicionar Administrador Master</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Novo Administrador Master</DialogTitle></DialogHeader>
                <form onSubmit={e => { e.preventDefault(); createMasterMutation.mutate(); }} className="space-y-3">
                  <div className="space-y-1"><Label>Nome completo *</Label><Input value={masterForm.full_name} onChange={e => setMasterForm(f => ({ ...f, full_name: e.target.value }))} required /></div>
                  <div className="space-y-1"><Label>E-mail *</Label><Input type="email" value={masterForm.email} onChange={e => setMasterForm(f => ({ ...f, email: e.target.value }))} required /></div>
                  <div className="space-y-1"><Label>Celular</Label><Input value={masterForm.phone} onChange={e => setMasterForm(f => ({ ...f, phone: e.target.value }))} placeholder="(31) 99999-9999" /></div>
                  <p className="text-xs text-muted-foreground">O novo usuário terá acesso total ao sistema. A senha é gerada automaticamente.</p>
                  <Button type="submit" className="w-full" disabled={createMasterMutation.isPending}>{createMasterMutation.isPending ? 'Criando...' : 'Criar Administrador'}</Button>
                </form>
              </DialogContent>
            </Dialog>

            {isLoadingAdmins ? (
              <div className="flex justify-center py-10"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
            ) : admins.length === 0 ? (
              <p className="text-center text-muted-foreground py-10">Nenhum administrador encontrado.</p>
            ) : (
              <div className="space-y-2">
                {admins.map((admin) => (
                  <div key={admin.user_id} className="rounded-xl border bg-card p-4 flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground truncate">{admin.full_name || 'Sem nome'}</p>
                      <p className="text-sm text-muted-foreground">{admin.email}</p>
                      {admin.phone && <p className="text-xs text-muted-foreground">Tel: {admin.phone}</p>}
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0"><MoreVertical className="h-4 w-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => { setEditMaster(admin); setEditMasterForm({ full_name: admin.full_name, phone: admin.phone || '' }); }}>
                          <Pencil className="h-4 w-4 mr-2" /> Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setDeleteMaster(admin)} className="text-destructive focus:text-destructive" disabled={admin.user_id === user?.id}>
                          <Trash2 className="h-4 w-4 mr-2" /> Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Edit Master Dialog */}
      <Dialog open={!!editMaster} onOpenChange={open => { if (!open) setEditMaster(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar Administrador</DialogTitle></DialogHeader>
          <form onSubmit={handleEditMaster} className="space-y-3">
            <div className="space-y-1"><Label>Nome completo *</Label><Input value={editMasterForm.full_name} onChange={e => setEditMasterForm(f => ({ ...f, full_name: e.target.value }))} required /></div>
            <div className="space-y-1"><Label>Telefone</Label><Input value={editMasterForm.phone} onChange={e => setEditMasterForm(f => ({ ...f, phone: e.target.value }))} /></div>
            <Button type="submit" className="w-full">Salvar</Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Master Confirmation */}
      <Dialog open={!!deleteMaster} onOpenChange={open => { if (!open) setDeleteMaster(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir Administrador</DialogTitle>
            <DialogDescription>Tem certeza que deseja remover <strong>{deleteMaster?.full_name}</strong>? Esta ação não pode ser desfeita e o usuário perderá todo o acesso.</DialogDescription>
          </DialogHeader>
          <div className="flex gap-2 justify-end pt-2">
            <Button variant="outline" onClick={() => setDeleteMaster(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDeleteMaster}>Excluir</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Loja Dialog */}
      <Dialog open={!!editLoja} onOpenChange={open => { if (!open) setEditLoja(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar Loja</DialogTitle></DialogHeader>
          <form onSubmit={handleEditLoja} className="space-y-3">
            <div className="space-y-1"><Label>Nome *</Label><Input value={editLojaForm.name} onChange={e => setEditLojaForm(f => ({ ...f, name: e.target.value }))} required /></div>
            <div className="space-y-1"><Label>Telefone</Label><Input value={editLojaForm.phone} onChange={e => setEditLojaForm(f => ({ ...f, phone: e.target.value }))} /></div>
            <div className="space-y-1"><Label>CNPJ</Label><Input value={editLojaForm.cnpj} onChange={e => setEditLojaForm(f => ({ ...f, cnpj: e.target.value }))} /></div>
            <Button type="submit" className="w-full">Salvar</Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Loja Confirmation */}
      <Dialog open={!!deleteLoja} onOpenChange={open => { if (!open) setDeleteLoja(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir Loja</DialogTitle>
            <DialogDescription>Tem certeza que deseja excluir <strong>{deleteLoja?.name}</strong>? Todas as vendedoras vinculadas serão removidas. Esta ação não pode ser desfeita.</DialogDescription>
          </DialogHeader>
          <div className="flex gap-2 justify-end pt-2">
            <Button variant="outline" onClick={() => setDeleteLoja(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDeleteLoja}>Excluir</Button>
          </div>
        </DialogContent>
      </Dialog>

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
            <DialogDescription>Tem certeza que deseja remover <strong>{deleteVendedora?.profile?.full_name}</strong> como vendedora? A conta de login será mantida, mas o acesso ao sistema será revogado.</DialogDescription>
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
