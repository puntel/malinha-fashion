import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Plus, MoreVertical, Pencil, Archive, ArchiveRestore, Trash2, Loader2, UserRound, Search } from 'lucide-react';
import { toast } from 'sonner';

export interface ClienteRecord {
  id: string;
  name: string;
  phone: string;
  cpf: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  vendedora_id: string;
  loja_id: string | null;
  archived: boolean;
  created_at: string;
}

interface AvailableVendedora {
  user_id: string;
  name: string;
  loja_id: string;
}

interface ClientesTabProps {
  role: 'master' | 'loja' | 'vendedora';
  filterVendedoraId?: string;
  filterLojaId?: string;
  defaultVendedoraId?: string;
  defaultLojaId?: string;
  availableVendedoras?: AvailableVendedora[];
  canCreate: boolean;
}

const emptyForm = { name: '', phone: '', cpf: '', email: '', address: '', notes: '', vendedora_id: '', loja_id: '' };

export default function ClientesTab({
  role,
  filterVendedoraId,
  filterLojaId,
  defaultVendedoraId,
  defaultLojaId,
  availableVendedoras = [],
  canCreate,
}: ClientesTabProps) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [editCliente, setEditCliente] = useState<ClienteRecord | null>(null);
  const [deleteCliente, setDeleteCliente] = useState<ClienteRecord | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [loading, setLoading] = useState(false);

  const queryKey = ['clientes', role, filterVendedoraId, filterLojaId];

  const { data: clientes = [], isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      let q = supabase.from('clientes').select('*').order('created_at', { ascending: false });
      if (filterVendedoraId) q = q.eq('vendedora_id', filterVendedoraId);
      if (filterLojaId) q = q.eq('loja_id', filterLojaId);
      const { data, error } = await q;
      if (error) throw error;
      return (data as ClienteRecord[]) || [];
    },
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey });

  const openCreate = () => {
    setForm({
      ...emptyForm,
      vendedora_id: defaultVendedoraId || '',
      loja_id: defaultLojaId || '',
    });
    setCreateOpen(true);
  };

  const openEdit = (c: ClienteRecord) => {
    setEditCliente(c);
    setForm({
      name: c.name,
      phone: c.phone,
      cpf: c.cpf || '',
      email: c.email || '',
      address: c.address || '',
      notes: c.notes || '',
      vendedora_id: c.vendedora_id,
      loja_id: c.loja_id || '',
    });
  };

  const handleVendedoraChange = (userId: string) => {
    const v = availableVendedoras.find(av => av.user_id === userId);
    setForm(f => ({ ...f, vendedora_id: userId, loja_id: v?.loja_id || defaultLojaId || '' }));
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.vendedora_id) { toast.error('Selecione uma vendedora'); return; }
    setLoading(true);
    try {
      const { error } = await supabase.from('clientes').insert({
        name: form.name.trim(),
        phone: form.phone.trim(),
        cpf: form.cpf.trim() || null,
        email: form.email.trim() || null,
        address: form.address.trim() || null,
        notes: form.notes.trim() || null,
        vendedora_id: form.vendedora_id,
        loja_id: form.loja_id || null,
      });
      if (error) throw error;
      toast.success('Cliente cadastrado!');
      setCreateOpen(false);
      invalidate();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao cadastrar cliente');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editCliente) return;
    setLoading(true);
    try {
      const { error } = await supabase.from('clientes').update({
        name: form.name.trim(),
        phone: form.phone.trim(),
        cpf: form.cpf.trim() || null,
        email: form.email.trim() || null,
        address: form.address.trim() || null,
        notes: form.notes.trim() || null,
      }).eq('id', editCliente.id);
      if (error) throw error;
      toast.success('Cliente atualizado!');
      setEditCliente(null);
      invalidate();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao atualizar cliente');
    } finally {
      setLoading(false);
    }
  };

  const handleArchive = async (c: ClienteRecord) => {
    const { error } = await supabase.from('clientes').update({ archived: !c.archived }).eq('id', c.id);
    if (error) { toast.error('Erro ao arquivar cliente'); return; }
    toast.success(c.archived ? 'Cliente reativado!' : 'Cliente arquivado!');
    invalidate();
  };

  const handleDelete = async () => {
    if (!deleteCliente) return;
    setLoading(true);
    try {
      const { error } = await supabase.from('clientes').delete().eq('id', deleteCliente.id);
      if (error) throw error;
      toast.success('Cliente excluído!');
      setDeleteCliente(null);
      invalidate();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao excluir');
    } finally {
      setLoading(false);
    }
  };

  const needsVendedoraPicker = (availableVendedoras.length > 0) && !defaultVendedoraId;

  const filtered = clientes.filter(c => {
    if (c.archived !== showArchived) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return c.name.toLowerCase().includes(q) || c.phone.includes(q) || (c.cpf || '').includes(q);
  });

  const ClienteForm = ({ onSubmit, isEdit = false }: { onSubmit: (e: React.FormEvent) => Promise<void>; isEdit?: boolean }) => (
    <form onSubmit={onSubmit} className="space-y-3">
      {!isEdit && needsVendedoraPicker && (
        <div className="space-y-1">
          <Label>Vendedora *</Label>
          <Select value={form.vendedora_id} onValueChange={handleVendedoraChange}>
            <SelectTrigger><SelectValue placeholder="Selecione a vendedora" /></SelectTrigger>
            <SelectContent>
              {availableVendedoras.map(v => (
                <SelectItem key={v.user_id} value={v.user_id}>{v.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      <div className="space-y-1">
        <Label>Nome *</Label>
        <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
      </div>
      <div className="space-y-1">
        <Label>Telefone *</Label>
        <Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="(00) 00000-0000" required />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label>CPF</Label>
          <Input value={form.cpf} onChange={e => setForm(f => ({ ...f, cpf: e.target.value }))} placeholder="000.000.000-00" />
        </div>
        <div className="space-y-1">
          <Label>E-mail</Label>
          <Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
        </div>
      </div>
      <div className="space-y-1">
        <Label>Endereço</Label>
        <Input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} />
      </div>
      <div className="space-y-1">
        <Label>Observações</Label>
        <Input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
      </div>
      <Button type="submit" className="w-full" disabled={loading}>
        {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
        {isEdit ? 'Salvar Alterações' : 'Cadastrar Cliente'}
      </Button>
    </form>
  );

  return (
    <div className="space-y-3">
      {/* Actions row */}
      <div className="flex gap-2">
        {canCreate && (
          <Button variant="outline" className="flex-1 gap-2" onClick={openCreate}>
            <Plus className="h-4 w-4" /> Novo Cliente
          </Button>
        )}
        <Button
          variant={showArchived ? 'default' : 'outline'}
          size="sm"
          onClick={() => setShowArchived(s => !s)}
          className="gap-1.5"
        >
          <Archive className="h-4 w-4" />
          {showArchived ? 'Ativos' : 'Arquivados'}
        </Button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome, telefone ou CPF..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* List */}
      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center py-16 text-muted-foreground">
          <UserRound className="h-10 w-10 mb-3 opacity-30" />
          <p className="text-sm">{showArchived ? 'Nenhum cliente arquivado.' : 'Nenhum cliente cadastrado.'}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(c => (
            <div key={c.id} className={`rounded-xl border bg-card p-4 flex items-start gap-3 ${c.archived ? 'opacity-60' : ''}`}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-foreground truncate">{c.name}</p>
                  {c.archived && <Badge variant="outline" className="text-xs shrink-0">Arquivado</Badge>}
                </div>
                <p className="text-sm text-muted-foreground">{c.phone}</p>
                {c.cpf && <p className="text-xs text-muted-foreground">CPF: {c.cpf}</p>}
                {c.email && <p className="text-xs text-muted-foreground">{c.email}</p>}
                {c.address && <p className="text-xs text-muted-foreground">{c.address}</p>}
                {c.notes && <p className="text-xs italic text-muted-foreground mt-0.5">"{c.notes}"</p>}
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => openEdit(c)}>
                    <Pencil className="h-4 w-4 mr-2" /> Editar
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleArchive(c)}>
                    {c.archived
                      ? <><ArchiveRestore className="h-4 w-4 mr-2" /> Reativar</>
                      : <><Archive className="h-4 w-4 mr-2" /> Arquivar</>
                    }
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setDeleteCliente(c)} className="text-destructive focus:text-destructive">
                    <Trash2 className="h-4 w-4 mr-2" /> Excluir
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ))}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Novo Cliente</DialogTitle></DialogHeader>
          <ClienteForm onSubmit={handleCreate} />
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editCliente} onOpenChange={open => { if (!open) setEditCliente(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar Cliente</DialogTitle></DialogHeader>
          <ClienteForm onSubmit={handleEdit} isEdit />
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteCliente} onOpenChange={open => { if (!open) setDeleteCliente(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir Cliente</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir <strong>{deleteCliente?.name}</strong>? Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2 justify-end pt-2">
            <Button variant="outline" onClick={() => setDeleteCliente(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Excluir
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
