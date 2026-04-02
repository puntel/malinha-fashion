import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ShieldCheck, UserPlus, MoreVertical, Pencil, Trash2, Loader2, Search } from 'lucide-react';
import { toast } from 'sonner';
import type { Profile } from '@/lib/types';

export default function Admins() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [masterDialogOpen, setMasterDialogOpen] = useState(false);
  const [editMaster, setEditMaster] = useState<Profile | null>(null);
  const [deleteMaster, setDeleteMaster] = useState<Profile | null>(null);
  
  const [masterForm, setMasterForm] = useState({ full_name: '', email: '', phone: '' });
  const [editMasterForm, setEditMasterForm] = useState({ full_name: '', phone: '' });

  const { data: admins = [], isLoading } = useQuery({
    queryKey: ['master-admins'],
    queryFn: async () => {
      const { data, error } = await supabase.from('user_roles').select('user_id').eq('role', 'master');
      if (error) throw error;
      
      const userIds = data.map(r => r.user_id);
      if (userIds.length === 0) return [];
      
      const { data: profiles, error: pError } = await supabase.from('profiles').select('user_id, full_name, email, phone').in('user_id', userIds);
      if (pError) throw pError;
      return (profiles as unknown as Profile[]) || [];
    },
  });

  const createMasterMutation = useMutation({
    mutationFn: async () => {
      const res = await supabase.functions.invoke('manage-users', { body: { action: 'create_master', ...masterForm } });
      if (res.error) throw new Error(res.error.message);
      if (res.data?.error) throw new Error(res.data.error);
      return res.data;
    },
    onSuccess: (data: any) => {
      const tempPassword = data?.temporary_password || 'A1b2c3';
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

  const filtered = admins.filter(a => {
    const name = a.full_name || '';
    const email = a.email || '';
    return name.toLowerCase().includes(search.toLowerCase()) || email.toLowerCase().includes(search.toLowerCase());
  });

  return (
    <div className="mx-auto max-w-4xl p-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Administradores Master</h1>
          <p className="text-muted-foreground mt-1">Gerencie usuários com acesso total ao sistema.</p>
        </div>
        <Dialog open={masterDialogOpen} onOpenChange={setMasterDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2"><UserPlus className="h-4 w-4" /> Novo Administrador</Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Criar Administrador Master</DialogTitle>
              <DialogDescription>O novo usuário terá controle total sobre lojas, vendedoras e produtos.</DialogDescription>
            </DialogHeader>
            <form onSubmit={e => { e.preventDefault(); createMasterMutation.mutate(); }} className="space-y-4">
              <div className="space-y-2"><Label>Nome Completo *</Label><Input value={masterForm.full_name} onChange={e => setMasterForm(f => ({ ...f, full_name: e.target.value }))} required /></div>
              <div className="space-y-2"><Label>E-mail *</Label><Input type="email" value={masterForm.email} onChange={e => setMasterForm(f => ({ ...f, email: e.target.value }))} required /></div>
              <div className="space-y-2"><Label>Telefone</Label><Input value={masterForm.phone} onChange={e => setMasterForm(f => ({ ...f, phone: e.target.value }))} placeholder="(31) 99999-9999" /></div>
              <Button type="submit" className="w-full" disabled={createMasterMutation.isPending}>
                {createMasterMutation.isPending ? 'Criando...' : 'Criar Administrador'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="mb-6 relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input 
          placeholder="Buscar por nome ou e-mail..." 
          value={search} 
          onChange={e => setSearch(e.target.value)} 
          className="pl-9" 
        />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 rounded-xl border-2 border-dashed">
          <ShieldCheck className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
          <p className="text-muted-foreground">Nenhum administrador encontrado.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(admin => (
            <div key={admin.user_id} className="rounded-xl border bg-card p-5 flex items-center justify-between transition-all hover:shadow-sm">
              <div className="flex items-center gap-4 min-w-0">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <ShieldCheck className="h-5 w-5 text-primary" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-medium text-foreground truncate">{admin.full_name || 'Sem nome'}</h3>
                  <p className="text-sm text-muted-foreground truncate">{admin.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {admin.user_id === user?.id && <span className="text-[10px] bg-primary/20 text-primary px-2 py-0.5 rounded uppercase font-bold mr-2">Você</span>}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8"><MoreVertical className="h-4 w-4" /></Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => {
                      setEditMaster(admin);
                      setEditMasterForm({ full_name: admin.full_name, phone: admin.phone || '' });
                    }}>
                      <Pencil className="h-4 w-4 mr-2" /> Editar
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setDeleteMaster(admin)} className="text-destructive focus:text-destructive" disabled={admin.user_id === user?.id}>
                      <Trash2 className="h-4 w-4 mr-2" /> Excluir
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit Master Dialog */}
      <Dialog open={!!editMaster} onOpenChange={open => !open && setEditMaster(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar Administrador</DialogTitle></DialogHeader>
          <form onSubmit={handleEditMaster} className="space-y-4">
            <div className="space-y-2"><Label>Nome Completo *</Label><Input value={editMasterForm.full_name} onChange={e => setEditMasterForm(f => ({ ...f, full_name: e.target.value }))} required /></div>
            <div className="space-y-2"><Label>Telefone</Label><Input value={editMasterForm.phone} onChange={e => setEditMasterForm(f => ({ ...f, phone: e.target.value }))} /></div>
            <Button type="submit" className="w-full">Salvar Alterações</Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Master Confirmation */}
      <Dialog open={!!deleteMaster} onOpenChange={open => !open && setDeleteMaster(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir Administrador</DialogTitle>
            <DialogDescription>Tem certeza que deseja remover <strong>{deleteMaster?.full_name}</strong>? Esta ação não pode ser desfeita.</DialogDescription>
          </DialogHeader>
          <div className="flex gap-2 justify-end pt-4">
            <Button variant="outline" onClick={() => setDeleteMaster(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDeleteMaster}>Excluir</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
