import { useState, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  Plus, MoreVertical, Pencil, Archive, ArchiveRestore, Trash2,
  Loader2, UserRound, Search, Download, Upload, FileSpreadsheet
} from 'lucide-react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';

export interface ClienteRecord {
  id: string;
  name: string;
  phone: string;
  cpf: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  vendedora_id: string | null;
  loja_id: string | null;
  created_by: string;
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

const TEMPLATE_COLUMNS = ['Nome*', 'Telefone*', 'CPF', 'Email', 'Endereço', 'Observações'];
const TEMPLATE_EXAMPLE = ['Maria Silva', '(11) 99999-9999', '000.000.000-00', 'maria@email.com', 'Rua das Flores, 123 - SP', 'Cliente preferencial'];

export default function ClientesTab({
  role,
  filterVendedoraId,
  filterLojaId,
  defaultVendedoraId,
  defaultLojaId,
  availableVendedoras = [],
  canCreate,
}: ClientesTabProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [search, setSearch] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [editCliente, setEditCliente] = useState<ClienteRecord | null>(null);
  const [deleteCliente, setDeleteCliente] = useState<ClienteRecord | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);

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
      vendedora_id: c.vendedora_id || '',
      loja_id: c.loja_id || '',
    });
  };

  const handleVendedoraChange = (userId: string) => {
    if (userId === '__none__') {
      setForm(f => ({ ...f, vendedora_id: '', loja_id: defaultLojaId || '' }));
      return;
    }
    const v = availableVendedoras.find(av => av.user_id === userId);
    setForm(f => ({ ...f, vendedora_id: userId, loja_id: v?.loja_id || defaultLojaId || '' }));
  };

  const buildInsertPayload = () => ({
    name: form.name.trim(),
    phone: form.phone.trim(),
    cpf: form.cpf.trim() || null,
    email: form.email.trim() || null,
    address: form.address.trim() || null,
    notes: form.notes.trim() || null,
    vendedora_id: form.vendedora_id || null,
    loja_id: form.loja_id || null,
    created_by: user!.id,
  });

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.from('clientes').insert(buildInsertPayload());
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
    if (error) { toast.error('Erro ao arquivar'); return; }
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

  // ─── Excel template download ───────────────────────────────
  const downloadTemplate = () => {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([
      TEMPLATE_COLUMNS,
      TEMPLATE_EXAMPLE,
    ]);
    // Column widths
    ws['!cols'] = [{ wch: 30 }, { wch: 18 }, { wch: 16 }, { wch: 28 }, { wch: 35 }, { wch: 30 }];
    XLSX.utils.book_append_sheet(wb, ws, 'Clientes');

    // Instructions sheet
    const wsInfo = XLSX.utils.aoa_to_sheet([
      ['Instruções de preenchimento'],
      [''],
      ['* Nome e Telefone são obrigatórios.'],
      ['* CPF, Email, Endereço e Observações são opcionais.'],
      ['* Não altere o cabeçalho da primeira linha.'],
      ['* Você pode adicionar quantas linhas quiser.'],
    ]);
    XLSX.utils.book_append_sheet(wb, wsInfo, 'Instruções');

    XLSX.writeFile(wb, 'modelo-clientes.xlsx');
    toast.success('Modelo baixado com sucesso!');
  };

  // ─── Excel import ──────────────────────────────────────────
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    setImporting(true);
    try {
      const data = await file.arrayBuffer();
      const wb = XLSX.read(data);
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });

      // Skip header row
      const dataRows = rows.slice(1).filter(r => r.length > 0 && String(r[0] || '').trim());

      if (dataRows.length === 0) {
        toast.error('Nenhum cliente encontrado no arquivo.');
        return;
      }

      const records = dataRows.map(r => ({
        name: String(r[0] || '').trim(),
        phone: String(r[1] || '').trim(),
        cpf: String(r[2] || '').trim() || null,
        email: String(r[3] || '').trim() || null,
        address: String(r[4] || '').trim() || null,
        notes: String(r[5] || '').trim() || null,
        vendedora_id: defaultVendedoraId || null,
        loja_id: defaultLojaId || null,
        created_by: user!.id,
      })).filter(r => r.name && r.phone);

      if (records.length === 0) {
        toast.error('Nenhuma linha válida encontrada. Nome e Telefone são obrigatórios.');
        return;
      }

      const { error } = await supabase.from('clientes').insert(records);
      if (error) throw error;

      toast.success(`${records.length} cliente(s) importado(s) com sucesso!`);
      invalidate();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao importar arquivo');
    } finally {
      setImporting(false);
    }
  };

  const needsVendedoraPicker = availableVendedoras.length > 0 && !defaultVendedoraId;

  const filtered = clientes.filter(c => {
    if (c.archived !== showArchived) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      c.phone.includes(q) ||
      (c.cpf || '').includes(q) ||
      (c.email || '').toLowerCase().includes(q)
    );
  });

  const ClienteForm = ({ onSubmit, isEdit = false }: { onSubmit: (e: React.FormEvent) => Promise<void>; isEdit?: boolean }) => (
    <form onSubmit={onSubmit} className="space-y-3">
      {!isEdit && needsVendedoraPicker && (
        <div className="space-y-1">
          <Label>Vendedora <span className="text-muted-foreground text-xs">(opcional)</span></Label>
          <Select value={form.vendedora_id || '__none__'} onValueChange={handleVendedoraChange}>
            <SelectTrigger><SelectValue placeholder="Selecione a vendedora (opcional)" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">— Sem vendedora —</SelectItem>
              {availableVendedoras.map(v => (
                <SelectItem key={v.user_id} value={v.user_id}>{v.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      <div className="space-y-1">
        <Label>Nome *</Label>
        <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Nome completo" required />
      </div>
      <div className="space-y-1">
        <Label>Telefone *</Label>
        <Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="(00) 00000-0000" required />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label>CPF <span className="text-muted-foreground text-xs">(opcional)</span></Label>
          <Input value={form.cpf} onChange={e => setForm(f => ({ ...f, cpf: e.target.value }))} placeholder="000.000.000-00" />
        </div>
        <div className="space-y-1">
          <Label>E-mail <span className="text-muted-foreground text-xs">(opcional)</span></Label>
          <Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
        </div>
      </div>
      <div className="space-y-1">
        <Label>Endereço <span className="text-muted-foreground text-xs">(opcional)</span></Label>
        <Input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} />
      </div>
      <div className="space-y-1">
        <Label>Observações <span className="text-muted-foreground text-xs">(opcional)</span></Label>
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
      {/* Action buttons */}
      <div className="flex flex-wrap gap-2">
        {canCreate && (
          <Button variant="outline" className="flex-1 gap-2 min-w-[120px]" onClick={openCreate}>
            <Plus className="h-4 w-4" /> Novo Cliente
          </Button>
        )}
        <Button variant="outline" size="sm" className="gap-1.5" onClick={downloadTemplate} title="Baixar modelo Excel">
          <Download className="h-4 w-4" /> Modelo
        </Button>
        {canCreate && (
          <>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => fileInputRef.current?.click()}
              disabled={importing}
              title="Importar clientes do Excel"
            >
              {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {importing ? 'Importando...' : 'Importar Excel'}
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={handleFileChange}
            />
          </>
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

      {/* Excel info banner */}
      <div className="flex items-start gap-2 rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
        <FileSpreadsheet className="h-3.5 w-3.5 mt-0.5 shrink-0" />
        <span>Baixe o <button onClick={downloadTemplate} className="underline underline-offset-2 hover:text-foreground transition-colors">modelo Excel</button>, preencha e faça upload para cadastrar múltiplos clientes de uma vez.</span>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome, telefone, CPF ou e-mail..."
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
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-medium text-foreground">{c.name}</p>
                  {c.archived && <Badge variant="outline" className="text-xs">Arquivado</Badge>}
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
                      : <><Archive className="h-4 w-4 mr-2" /> Arquivar</>}
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

      {/* Delete Confirmation */}
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
