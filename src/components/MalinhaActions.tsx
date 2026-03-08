import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { MoreVertical, Pencil, Trash2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import type { Malinha } from '@/lib/types';

interface Props {
  malinha: Malinha;
}

export default function MalinhaActions({ malinha }: Props) {
  const queryClient = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    client_name: malinha.client_name,
    client_phone: malinha.client_phone,
    client_cpf: malinha.client_cpf,
    seller_name: malinha.seller_name,
  });

  const handleEdit = async () => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('malinhas')
        .update({
          client_name: form.client_name,
          client_phone: form.client_phone,
          client_cpf: form.client_cpf,
          seller_name: form.seller_name,
        })
        .eq('id', malinha.id);
      if (error) throw error;
      toast.success('Malinha atualizada!');
      setEditOpen(false);
      queryClient.invalidateQueries({ queryKey: ['master-malinhas'] });
      queryClient.invalidateQueries({ queryKey: ['loja-malinhas'] });
      queryClient.invalidateQueries({ queryKey: ['malinha', malinha.id] });
    } catch (err) {
      toast.error('Erro ao atualizar malinha');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    setLoading(true);
    try {
      // Delete products first, then the malinha
      const { error: prodErr } = await supabase
        .from('malinha_products')
        .delete()
        .eq('malinha_id', malinha.id);
      if (prodErr) throw prodErr;

      const { error } = await supabase
        .from('malinhas')
        .delete()
        .eq('id', malinha.id);
      if (error) throw error;

      toast.success('Malinha excluída!');
      setDeleteOpen(false);
      queryClient.invalidateQueries({ queryKey: ['master-malinhas'] });
      queryClient.invalidateQueries({ queryKey: ['loja-malinhas'] });
      queryClient.invalidateQueries({ queryKey: ['malinhas'] });
    } catch (err) {
      toast.error('Erro ao excluir malinha');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={(e) => e.stopPropagation()}
          >
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
          <DropdownMenuItem onClick={() => setEditOpen(true)}>
            <Pencil className="h-4 w-4 mr-2" /> Editar
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setDeleteOpen(true)} className="text-destructive focus:text-destructive">
            <Trash2 className="h-4 w-4 mr-2" /> Excluir
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent onClick={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle>Editar Malinha</DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); handleEdit(); }} className="space-y-3">
            <div className="space-y-1">
              <Label>Nome da cliente</Label>
              <Input value={form.client_name} onChange={(e) => setForm(f => ({ ...f, client_name: e.target.value }))} required />
            </div>
            <div className="space-y-1">
              <Label>Telefone</Label>
              <Input value={form.client_phone} onChange={(e) => setForm(f => ({ ...f, client_phone: e.target.value }))} required />
            </div>
            <div className="space-y-1">
              <Label>CPF</Label>
              <Input value={form.client_cpf} onChange={(e) => setForm(f => ({ ...f, client_cpf: e.target.value }))} required />
            </div>
            <div className="space-y-1">
              <Label>Nome da vendedora</Label>
              <Input value={form.seller_name} onChange={(e) => setForm(f => ({ ...f, seller_name: e.target.value }))} required />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Salvar
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent onClick={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle>Excluir Malinha</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir a malinha de <strong>{malinha.client_name}</strong>? 
              Todos os produtos vinculados também serão removidos. Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2 justify-end pt-2">
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Excluir
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
