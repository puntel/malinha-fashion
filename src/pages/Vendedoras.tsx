import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Users, UserPlus, MoreVertical, Pencil, Archive, ArchiveRestore, Trash2, Loader2, Search } from 'lucide-react';
import { toast } from 'sonner';
import type { Vendedora, Profile, Loja } from '@/lib/types';

export default function Vendedoras() {
  const { profile: myProfile } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  
  const [vendedoraDialogOpen, setVendedoraDialogOpen] = useState(false);
  const [editVendedora, setEditVendedora] = useState<Vendedora | null>(null);
  const [deleteVendedora, setDeleteVendedora] = useState<Vendedora | null>(null);
  
  const [vendedoraForm, setVendedoraForm] = useState({ full_name: '', email: '', phone: '', loja_id: '' });
  const [editVendedoraForm, setEditVendedoraForm] = useState({ full_name: '', phone: '' });

  const isMaster = (myProfile as any)?.role === 'master';

  const { data: lojas = [] } = useQuery({
    queryKey: ['lojas'],
    queryFn: async () => {
      const { data, error } = await supabase.from('lojas').select('*').order('name');
      if (error) throw error;
      return (data as unknown as Loja[]) || [];
    },
    enabled: isMaster
  });

  const { data: myLojaId } = useQuery({
    queryKey: ['my-loja-id'],
    queryFn: async () => {
      const { data } = await supabase.from('loja_members').select('loja_id').single();
      return data?.loja_id || null;
    },
    enabled: !isMaster
  });

  const { data: vendedoras = [], isLoading } = useQuery({
    queryKey: ['vendedoras-list'],
    queryFn: async () => {
      let query = supabase.from('vendedoras').select('*').order('created_at', { ascending: false });
      
      const { data: vendedorasData, error: vendedorasError } = await query;
      if (vendedorasError) throw vendedorasError;
      
      const vendedorasTyped = (vendedorasData || []) as any[];
      const userIds = [...new Set(vendedorasTyped.map(v => v.user_id))];
      
      if (userIds.length === 0) return [];
      
      const { data: profilesData } = await supabase.from('profiles').select('user_id, full_name, email, phone').in('user_id', userIds);
      const profileByUserId = new Map((profilesData || []).map(p => [p.user_id, p]));
      
      return vendedorasTyped.map(v => ({
        ...v,
        profile: profileByUserId.get(v.user_id) || null
      })) as Vendedora[];
    },
  });

  const createVendedoraMutation = useMutation({
    mutationFn: async () => {
      const finalLojaId = isMaster ? vendedoraForm.loja_id : myLojaId;
      if (!finalLojaId) throw new Error('Selecione uma loja');
      
      const res = await supabase.functions.invoke('manage-users', { 
        body: { 
          action: 'create_vendedora', 
          email: vendedoraForm.email,
          full_name: vendedoraForm.full_name,
          phone: vendedoraForm.phone,
          loja_id: finalLojaId
        } 
      });
      if (res.error) throw new Error(res.error.message);
      if (res.data?.error) throw new Error(res.data.error);
      return res.data;
    },
    onSuccess: (data: any) => {
      const tempPassword = data?.temporary_password || 'A1b2c3';
      toast.success(`Vendedora criada! Senha temporária: ${tempPassword}`);
      setVendedoraDialogOpen(false);
      setVendedoraForm({ full_name: '', email: '', phone: '', loja_id: '' });
      queryClient.invalidateQueries({ queryKey: ['vendedoras-list'] });
    },
    onError: (err: Error) => toast.error(`Erro ao criar vendedora: ${err.message}`),
  });

  const handleEditVendedora = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editVendedora) return;
    const { error } = await supabase.from('profiles').update({ 
      full_name: editVendedoraForm.full_name, 
      phone: editVendedoraForm.phone || null 
    }).eq('user_id', editVendedora.user_id);
    if (error) { toast.error('Erro ao editar vendedora'); return; }
    toast.success('Vendedora atualizada!');
    setEditVendedora(null);
    queryClient.invalidateQueries({ queryKey: ['vendedoras-list'] });
  };

  const openEditVendedora = (v: Vendedora) => {
    setEditVendedora(v);
    setEditVendedoraForm({ full_name: v.profile?.full_name || '', phone: v.profile?.phone || '' });
  };

  const handleArchiveVendedora = async (v: Vendedora) => {
    const { error } = await supabase.from('vendedoras').update({ archived: !v.archived } as any).eq('id', v.id);
    if (error) { toast.error('Erro ao arquivar vendedora'); return; }
    toast.success(v.archived ? 'Vendedora reativada!' : 'Vendedora arquivada!');
    queryClient.invalidateQueries({ queryKey: ['vendedoras-list'] });
  };

  const handleDeleteVendedora = async () => {
    if (!deleteVendedora) return;
    await supabase.from('user_roles').delete().eq('user_id', deleteVendedora.user_id);
    const { error } = await supabase.from('vendedoras').delete().eq('id', deleteVendedora.id);
    if (error) { toast.error('Erro ao excluir vendedora'); return; }
    toast.success('Vendedora removida!');
    setDeleteVendedora(null);
    queryClient.invalidateQueries({ queryKey: ['vendedoras-list'] });
  };

  const filtered = vendedoras.filter(v => {
    const name = v.profile?.full_name || '';
    const email = v.profile?.email || '';
    const matchesSearch = name.toLowerCase().includes(search.toLowerCase()) || email.toLowerCase().includes(search.toLowerCase());
    const matchesArchived = !!v.archived === showArchived;
    return matchesSearch && matchesArchived;
  });

  return (
    <div className="mx-auto max-w-4xl p-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Gestão de Vendedoras</h1>
          <p className="text-muted-foreground mt-1">Gerencie sua equipe de vendas e acessos.</p>
        </div>
        <Dialog open={vendedoraDialogOpen} onOpenChange={setVendedoraDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2"><UserPlus className="h-4 w-4" /> Nova Vendedora</Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Cadastrar Nova Vendedora</DialogTitle>
              <DialogDescription>A vendedora receberá os dados de acesso por e-mail.</DialogDescription>
            </DialogHeader>
            <form onSubmit={e => { e.preventDefault(); createVendedoraMutation.mutate(); }} className="space-y-4">
              <div className="space-y-2">
                <Label>Nome Completo *</Label>
                <Input value={vendedoraForm.full_name} onChange={e => setVendedoraForm(f => ({ ...f, full_name: e.target.value }))} required />
              </div>
              <div className="space-y-2">
                <Label>E-mail *</Label>
                <Input type="email" value={vendedoraForm.email} onChange={e => setVendedoraForm(f => ({ ...f, email: e.target.value }))} required />
              </div>
              <div className="grid grid-cols-1 gap-4">
                <div className="space-y-2">
                  <Label>Telefone</Label>
                  <Input value={vendedoraForm.phone} onChange={e => setVendedoraForm(f => ({ ...f, phone: e.target.value }))} placeholder="(31) 99999-9999" />
                </div>
                {isMaster && (
                  <div className="space-y-2">
                    <Label>Loja *</Label>
                    <Select value={vendedoraForm.loja_id} onValueChange={val => setVendedoraForm(f => ({ ...f, loja_id: val }))}>
                      <SelectTrigger><SelectValue placeholder="Selecione a loja" /></SelectTrigger>
                      <SelectContent>
                        {lojas.map(l => (
                          <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
              <Button type="submit" className="w-full" disabled={createVendedoraMutation.isPending}>
                {createVendedoraMutation.isPending ? 'Criando...' : 'Criar Vendedora'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="mb-6 flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Buscar por nome ou e-mail..." 
            value={search} 
            onChange={e => setSearch(e.target.value)} 
            className="pl-9" 
          />
        </div>
        <Button 
          variant="outline" 
          onClick={() => setShowArchived(!showArchived)}
          className="shrink-0"
        >
          {showArchived ? 'Ver Ativas' : 'Ver Arquivadas'}
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 rounded-xl border-2 border-dashed">
          <Users className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
          <p className="text-muted-foreground">Nenhuma vendedora encontrada.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {filtered.map(v => (
            <div key={v.id} className="relative rounded-xl border bg-card p-5 flex items-start gap-4 transition-all hover:shadow-md">
              <div className="h-12 w-12 rounded-full bg-secondary flex items-center justify-center shrink-0">
                <Users className="h-6 w-6 text-secondary-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-lg truncate">{v.profile?.full_name || 'Sem nome'}</h3>
                <p className="text-sm text-muted-foreground truncate">{v.profile?.email}</p>
                {v.profile?.phone && <p className="text-xs text-muted-foreground mt-1">{v.profile.phone}</p>}
              </div>
              <div className="flex flex-col items-end gap-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8"><MoreVertical className="h-4 w-4" /></Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => openEditVendedora(v)}>
                      <Pencil className="h-4 w-4 mr-2" /> Editar
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleArchiveVendedora(v)}>
                      {v.archived ? <><ArchiveRestore className="h-4 w-4 mr-2" /> Reativar</> : <><Archive className="h-4 w-4 mr-2" /> Arquivar</>}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setDeleteVendedora(v)} className="text-destructive focus:text-destructive">
                      <Trash2 className="h-4 w-4 mr-2" /> Excluir
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                {v.archived && <span className="text-[10px] bg-muted px-2 py-0.5 rounded uppercase font-bold text-muted-foreground">Arquivada</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit Vendedora Dialog */}
      <Dialog open={!!editVendedora} onOpenChange={open => !open && setEditVendedora(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar Vendedora</DialogTitle></DialogHeader>
          <form onSubmit={handleEditVendedora} className="space-y-4">
            <div className="space-y-2"><Label>Nome Completo *</Label><Input value={editVendedoraForm.full_name} onChange={e => setEditVendedoraForm(f => ({ ...f, full_name: e.target.value }))} required /></div>
            <div className="space-y-2"><Label>Telefone</Label><Input value={editVendedoraForm.phone} onChange={e => setEditVendedoraForm(f => ({ ...f, phone: e.target.value }))} /></div>
            <Button type="submit" className="w-full">Salvar Alterações</Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Vendedora Confirmation */}
      <Dialog open={!!deleteVendedora} onOpenChange={open => !open && setDeleteVendedora(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir Vendedora</DialogTitle>
            <DialogDescription>Tem certeza que deseja remover <strong>{deleteVendedora?.profile?.full_name}</strong>? A conta de login será mantida mas o acesso ao sistema será revogado.</DialogDescription>
          </DialogHeader>
          <div className="flex gap-2 justify-end pt-4">
            <Button variant="outline" onClick={() => setDeleteVendedora(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDeleteVendedora}>Excluir</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
