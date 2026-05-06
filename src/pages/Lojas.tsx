import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Store, UserPlus, MoreVertical, Pencil, Archive, ArchiveRestore, Trash2, Loader2, Search } from 'lucide-react';
import { toast } from 'sonner';
import type { Loja } from '@/lib/types';

export default function Lojas() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [lojaDialogOpen, setLojaDialogOpen] = useState(false);
  const [editLoja, setEditLoja] = useState<Loja | null>(null);
  const [deleteLoja, setDeleteLoja] = useState<Loja | null>(null);
  
  const [lojaForm, setLojaForm] = useState({ loja_name: '', loja_phone: '', loja_cnpj: '', owner_name: '', owner_email: '', owner_password: '' });
  const [editLojaForm, setEditLojaForm] = useState({ name: '', phone: '', cnpj: '' });

  const { data: lojas = [], isLoading } = useQuery({
    queryKey: ['lojas'],
    queryFn: async () => {
      const { data, error } = await supabase.from('lojas').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return (data as unknown as Loja[]) || [];
    },
  });

  const createLojaMutation = useMutation({
    mutationFn: async () => {
      const res = await supabase.functions.invoke('manage-users', { body: { action: 'create_loja', ...lojaForm } });
      if (res.error) throw new Error(res.error.message);
      if (res.data?.error) throw new Error(res.data.error);
      return res.data;
    },
    onSuccess: (data: any) => {
      const tempPassword = data?.temporary_password || 'A1b2c3';
      toast.success(`Loja criada! Senha temporária: ${tempPassword}`);
      setLojaDialogOpen(false);
      setLojaForm({ loja_name: '', loja_phone: '', loja_cnpj: '', owner_name: '', owner_email: '', owner_password: '' });
      queryClient.invalidateQueries({ queryKey: ['lojas'] });
    },
    onError: (err: Error) => toast.error(`Erro ao criar loja: ${err.message}`),
  });

  const handleEditLoja = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editLoja) return;
    const { error } = await supabase.from('lojas').update({ 
      name: editLojaForm.name, 
      phone: editLojaForm.phone || null, 
      cnpj: editLojaForm.cnpj || null 
    }).eq('id', editLoja.id);
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
  };

  const filtered = lojas.filter(l => {
    const matchesSearch = l.name.toLowerCase().includes(search.toLowerCase());
    const matchesArchived = !!l.archived === showArchived;
    return matchesSearch && matchesArchived;
  });

  return (
    <div className="mx-auto max-w-4xl p-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Gestão de Lojas</h1>
          <p className="text-muted-foreground mt-1">Configure e gerencie as lojas parceiras do BagSync.</p>
        </div>
        <Dialog open={lojaDialogOpen} onOpenChange={setLojaDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Store className="h-4 w-4" /> Nova Loja</Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Cadastrar Nova Loja</DialogTitle>
              <DialogDescription>As informações de acesso serão enviadas para o e-mail do proprietário.</DialogDescription>
            </DialogHeader>
            <form onSubmit={e => { e.preventDefault(); createLojaMutation.mutate(); }} className="space-y-4">
              <div className="grid gap-4">
                <div className="space-y-2">
                  <Label>Nome da Loja *</Label>
                  <Input value={lojaForm.loja_name} onChange={e => setLojaForm(f => ({ ...f, loja_name: e.target.value }))} required />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Telefone</Label>
                    <Input value={lojaForm.loja_phone} onChange={e => setLojaForm(f => ({ ...f, loja_phone: e.target.value }))} placeholder="(31) 99999-9999" />
                  </div>
                  <div className="space-y-2">
                    <Label>CNPJ</Label>
                    <Input value={lojaForm.loja_cnpj} onChange={e => setLojaForm(f => ({ ...f, loja_cnpj: e.target.value }))} />
                  </div>
                </div>
                <div className="border-t pt-4">
                  <p className="text-sm font-medium mb-3">Dados de Acesso (Proprietário)</p>
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <Label>Nome do Proprietário *</Label>
                      <Input value={lojaForm.owner_name} onChange={e => setLojaForm(f => ({ ...f, owner_name: e.target.value }))} required />
                    </div>
                    <div className="space-y-2">
                      <Label>E-mail Corporativo *</Label>
                      <Input type="email" value={lojaForm.owner_email} onChange={e => setLojaForm(f => ({ ...f, owner_email: e.target.value }))} required />
                    </div>
                    <div className="space-y-2">
                      <Label>Senha de Acesso *</Label>
                      <Input type="password" value={lojaForm.owner_password} onChange={e => setLojaForm(f => ({ ...f, owner_password: e.target.value }))} placeholder="Mínimo 6 caracteres" required minLength={6} />
                    </div>
                  </div>
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={createLojaMutation.isPending}>
                {createLojaMutation.isPending ? 'Cadastrando...' : 'Cadastrar Loja'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="mb-6 flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Buscar por nome da loja..." 
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
          <Store className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
          <p className="text-muted-foreground">Nenhuma loja encontrada.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map(loja => (
            <div key={loja.id} className="group relative rounded-xl border bg-card p-5 transition-all hover:shadow-md">
              <div className="flex justify-between items-start mb-4">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Store className="h-5 w-5 text-primary" />
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8"><MoreVertical className="h-4 w-4" /></Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => {
                        setEditLoja(loja);
                        setEditLojaForm({ name: loja.name, phone: loja.phone || '', cnpj: loja.cnpj || '' });
                    }}>
                      <Pencil className="h-4 w-4 mr-2" /> Editar
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleArchiveLoja(loja)}>
                      {loja.archived ? <><ArchiveRestore className="h-4 w-4 mr-2" /> Reativar</> : <><Archive className="h-4 w-4 mr-2" /> Arquivar</>}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setDeleteLoja(loja)} className="text-destructive focus:text-destructive">
                      <Trash2 className="h-4 w-4 mr-2" /> Excluir
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <h3 className="font-semibold text-lg line-clamp-1">{loja.name}</h3>
              <div className="mt-2 space-y-1">
                {loja.phone && <p className="text-sm text-muted-foreground">{loja.phone}</p>}
                {loja.cnpj && <p className="text-sm text-muted-foreground">{loja.cnpj}</p>}
              </div>
              {loja.archived && <div className="absolute top-2 right-12"><span className="text-[10px] bg-muted px-2 py-0.5 rounded uppercase font-bold tracking-tight">Arquivada</span></div>}
            </div>
          ))}
        </div>
      )}

      {/* Edit Loja Dialog */}
      <Dialog open={!!editLoja} onOpenChange={open => !open && setEditLoja(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar Loja</DialogTitle></DialogHeader>
          <form onSubmit={handleEditLoja} className="space-y-4">
            <div className="space-y-2"><Label>Nome da Loja *</Label><Input value={editLojaForm.name} onChange={e => setEditLojaForm(f => ({ ...f, name: e.target.value }))} required /></div>
            <div className="space-y-2"><Label>Telefone</Label><Input value={editLojaForm.phone} onChange={e => setEditLojaForm(f => ({ ...f, phone: e.target.value }))} /></div>
            <div className="space-y-2"><Label>CNPJ</Label><Input value={editLojaForm.cnpj} onChange={e => setEditLojaForm(f => ({ ...f, cnpj: e.target.value }))} /></div>
            <Button type="submit" className="w-full">Salvar Alterações</Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Loja Confirmation */}
      <Dialog open={!!deleteLoja} onOpenChange={open => !open && setDeleteLoja(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir Loja</DialogTitle>
            <DialogDescription>Tem certeza que deseja excluir <strong>{deleteLoja?.name}</strong>? Todas as vendedoras vinculadas serão removidas. Esta ação não pode ser desfeita.</DialogDescription>
          </DialogHeader>
          <div className="flex gap-2 justify-end pt-4">
            <Button variant="outline" onClick={() => setDeleteLoja(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDeleteLoja}>Excluir</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
