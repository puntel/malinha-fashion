import { useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Copy, Check, MessageCircle, Share2, CheckCircle2,
  Loader2, Pencil, Trash2, Plus, Camera, X, Mail, CreditCard
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchMalinhaById, updateMalinhaStatus, uploadProductPhoto, sendEmailNotification, createCheckoutSession } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { MalinhaProduct } from '@/lib/types';

const statusColors: Record<string, string> = {
  'Enviada': 'bg-accent text-accent-foreground',
  'Em aberto': 'bg-primary/15 text-primary',
  'Pedido realizado': 'bg-secondary text-secondary-foreground',
  'Finalizada': 'bg-success text-success-foreground',
};

const emptyProductForm = { code: '', size: '', quantity: '1', price: '' };

export default function MalinhaResumo() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { role } = useAuth();
  const photoInputRef = useRef<HTMLInputElement>(null);

  const canEdit = role === 'master' || role === 'loja';

  const [copied, setCopied] = useState(false);
  const [sellerNote, setSellerNote] = useState('');
  const [finalizing, setFinalizing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [generatingPayment, setGeneratingPayment] = useState(false);
  const [paymentLink, setPaymentLink] = useState('');

  // Client edit
  const [editClientOpen, setEditClientOpen] = useState(false);
  const [clientForm, setClientForm] = useState({
    client_name: '',
    client_phone: '',
    client_cpf: '',
    client_address: '',
    delivery_location: '',
    collection_location: '',
    total_pieces: '',
    send_date: '',
    return_date: ''
  });

  // Product edit
  const [editProduct, setEditProduct] = useState<MalinhaProduct | null>(null);
  const [editProductForm, setEditProductForm] = useState({ ...emptyProductForm });
  const [editProductPhotoFile, setEditProductPhotoFile] = useState<File | null>(null);
  const [editProductPhotoPreview, setEditProductPhotoPreview] = useState<string>('');

  // Add product
  const [addProductOpen, setAddProductOpen] = useState(false);
  const [addProductForm, setAddProductForm] = useState({ ...emptyProductForm });
  const [addProductPhotoFile, setAddProductPhotoFile] = useState<File | null>(null);
  const [addProductPhotoPreview, setAddProductPhotoPreview] = useState<string>('');

  // Delete product
  const [deleteProduct, setDeleteProduct] = useState<MalinhaProduct | null>(null);

  const { data: malinha, isLoading } = useQuery({
    queryKey: ['malinha', id],
    queryFn: () => fetchMalinhaById(id || ''),
    enabled: !!id,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['malinha', id] });
    queryClient.invalidateQueries({ queryKey: ['master-malinhas'] });
    queryClient.invalidateQueries({ queryKey: ['loja-malinhas'] });
  };

  if (isLoading) return (
    <div className="flex min-h-screen items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  );

  if (!malinha) return (
    <div className="flex min-h-screen items-center justify-center">
      <p className="text-muted-foreground">Malinha não encontrada.</p>
    </div>
  );

  const products = malinha.malinha_products || [];
  const link = `${window.location.origin}/malinha/${malinha.id}`;

  const clientObservations = products
    .filter(p => p.client_note && p.client_note.trim())
    .map(p => `${p.code}: ${p.client_note}`)
    .join('\n');

  const handleCopy = async () => {
    await navigator.clipboard.writeText(link);
    setCopied(true);
    toast.success('Link copiado!');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleWhatsApp = () => {
    const msg = encodeURIComponent(`Olá ${malinha.client_name}! 🛍️\n\nSua malinha está pronta! Confira as peças que separei para você:\n${link}`);
    const phone = malinha.client_phone.replace(/\D/g, '');
    window.open(`https://wa.me/55${phone}?text=${msg}`, '_blank');
  };

  const handleEmail = async () => {
    if (!malinha.client_email) {
      toast.error('Cliente não possui e-mail cadastrado nesta malinha.');
      return;
    }
    setSendingEmail(true);
    try {
      const subject = `Sua Malinha BagSync está pronta! 🛍️`;
      const html = `
        <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 12px;">
          <h2 style="color: #8884d8;">Olá ${malinha.client_name}!</h2>
          <p>Sua malinha está pronta! Confira as peças que separei para você clicando no link abaixo:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${link}" style="background-color: #8884d8; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">Ver Minha Malinha</a>
          </div>
          <p style="color: #666; font-size: 14px;">Se o botão não funcionar, copie e cole este link no seu navegador:<br><a href="${link}">${link}</a></p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
          <p style="font-size: 12px; color: #999;">Enviado via BagSync</p>
        </div>
      `;
      await sendEmailNotification(malinha.client_email, subject, html);
      toast.success('E-mail enviado com sucesso!');
    } catch (err: any) {
      console.error(err);
      toast.error('Erro ao enviar e-mail. Verifique as configurações do Resend.');
    } finally {
      setSendingEmail(false);
    }
  };

  const handleGeneratePayment = async () => {
    setGeneratingPayment(true);
    try {
      const data = await createCheckoutSession(malinha.id);
      setPaymentLink(data.url);
      toast.success('Link de pagamento gerado!');
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Erro ao gerar link de pagamento do Stripe.');
    } finally {
      setGeneratingPayment(false);
    }
  };

  const handleFinalize = async () => {
    setFinalizing(true);
    try {
      const noteToSave = sellerNote.trim() || malinha.seller_note || '';
      await updateMalinhaStatus(malinha.id, 'Finalizada', noteToSave);

      // Register sales for accepted/edited products
      const soldProducts = products.filter(p => p.status === 'accepted' || p.status === 'edited');
      if (soldProducts.length > 0) {
        // Get loja_id from vendedoras table
        let lojaId: string | null = null;
        if (malinha.vendedora_id) {
          const { data: vendedoraData } = await supabase
            .from('vendedoras')
            .select('loja_id')
            .eq('user_id', malinha.vendedora_id)
            .maybeSingle();
          lojaId = vendedoraData?.loja_id ?? null;
        }

        const salesPayload = soldProducts.map(p => ({
          product_name: p.code,
          internal_code: p.code,
          quantity: p.quantity,
          value: Number(p.price) * p.quantity,
          discount: 0,
          payment_method: null,
          category: 'Consignado',
          vendedora_id: malinha.vendedora_id,
          loja_id: lojaId,
          cliente_id: null,
          malinha_id: malinha.id,
        }));

        const { error: salesError } = await supabase.from('sales').insert(salesPayload);
        if (salesError) {
          console.error('Erro ao registrar vendas:', salesError);
          toast.warning('Malinha finalizada, mas houve um erro ao registrar as vendas.');
        } else {
          toast.success(`Malinha finalizada! ${soldProducts.length} venda(s) registrada(s).`);
        }
      } else {
        toast.success('Malinha finalizada!');
      }

      invalidate();
    } catch (err) {
      console.error(err);
      toast.error('Erro ao finalizar malinha.');
    } finally {
      setFinalizing(false);
    }
  };

  // ─── Edit client ───────────────────────────────────────────
  const openEditClient = () => {
    setClientForm({
      client_name: malinha.client_name,
      client_phone: malinha.client_phone,
      client_cpf: malinha.client_cpf,
      client_address: malinha.client_address || '',
      delivery_location: malinha.delivery_location || '',
      collection_location: malinha.collection_location || '',
      total_pieces: malinha.total_pieces?.toString() || '',
      send_date: malinha.send_date || '',
      return_date: malinha.return_date || ''
    });
    setEditClientOpen(true);
  };

  const handleSaveClient = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { error } = await supabase.from('malinhas').update(clientForm).eq('id', malinha.id);
      if (error) throw error;
      toast.success('Dados da cliente atualizados!');
      setEditClientOpen(false);
      invalidate();
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao atualizar';
      toast.error(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  // ─── Photo helpers ─────────────────────────────────────────
  const handlePhotoChange = (
    file: File,
    setPreview: (v: string) => void,
    setPhotoFile: (f: File) => void
  ) => {
    setPhotoFile(file);
    setPreview(URL.createObjectURL(file));
  };

  // ─── Edit product ──────────────────────────────────────────
  const openEditProduct = (p: MalinhaProduct) => {
    setEditProduct(p);
    setEditProductForm({ code: p.code, size: p.size, quantity: String(p.quantity), price: String(p.price) });
    setEditProductPhotoFile(null);
    setEditProductPhotoPreview(p.photo_url);
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editProduct) return;
    setSaving(true);
    try {
      let photo_url = editProduct.photo_url;
      if (editProductPhotoFile) {
        photo_url = await uploadProductPhoto(editProductPhotoFile);
      }
      const { error } = await supabase.from('malinha_products').update({
        code: editProductForm.code.trim(),
        size: editProductForm.size.trim(),
        quantity: Number(editProductForm.quantity),
        price: Number(editProductForm.price),
        photo_url,
      }).eq('id', editProduct.id);
      if (error) throw error;
      toast.success('Peça atualizada!');
      setEditProduct(null);
      setEditProductPhotoFile(null);
      setEditProductPhotoPreview('');
      invalidate();
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao atualizar peça';
      toast.error(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  // ─── Delete product ────────────────────────────────────────
  const handleDeleteProduct = async () => {
    if (!deleteProduct) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('malinha_products').delete().eq('id', deleteProduct.id);
      if (error) throw error;
      toast.success('Peça removida!');
      setDeleteProduct(null);
      invalidate();
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao remover peça';
      toast.error(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  // ─── Add product ───────────────────────────────────────────
  const openAddProduct = () => {
    setAddProductForm({ ...emptyProductForm });
    setAddProductPhotoFile(null);
    setAddProductPhotoPreview('');
    setAddProductOpen(true);
  };

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      let photo_url = '';
      if (addProductPhotoFile) {
        photo_url = await uploadProductPhoto(addProductPhotoFile);
      }
      const { error } = await supabase.from('malinha_products').insert({
        malinha_id: malinha.id,
        code: addProductForm.code.trim(),
        size: addProductForm.size.trim(),
        quantity: Number(addProductForm.quantity),
        price: Number(addProductForm.price),
        photo_url,
        status: 'pending',
      });
      if (error) throw error;
      toast.success('Peça adicionada!');
      setAddProductOpen(false);
      invalidate();
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao adicionar peça';
      toast.error(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  const ProductForm = ({
    form,
    setForm,
    photoPreview,
    photoInputId,
    onPhotoChange,
    onSubmit,
    isAdd = false,
  }: {
    form: typeof emptyProductForm;
    setForm: React.Dispatch<React.SetStateAction<typeof emptyProductForm>>;
    photoPreview: string;
    photoInputId: string;
    onPhotoChange: (f: File) => void;
    onSubmit: (e: React.FormEvent) => Promise<void>;
    isAdd?: boolean;
  }) => (
    <form onSubmit={onSubmit} className="space-y-3">
      {/* Photo */}
      <div className="space-y-1">
        <Label>Foto da peça</Label>
        <div className="flex items-center gap-3">
          {photoPreview ? (
            <img src={photoPreview} alt="preview" className="h-16 w-16 rounded-lg object-cover bg-muted" />
          ) : (
            <div className="h-16 w-16 rounded-lg bg-muted flex items-center justify-center">
              <Camera className="h-6 w-6 text-muted-foreground" />
            </div>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => document.getElementById(photoInputId)?.click()}
          >
            {photoPreview ? 'Trocar foto' : 'Adicionar foto'}
          </Button>
          <input
            id={photoInputId}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) onPhotoChange(f); }}
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label>Código *</Label>
          <Input value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} placeholder="REF-001" required />
        </div>
        <div className="space-y-1">
          <Label>Tamanho *</Label>
          <Input value={form.size} onChange={e => setForm(f => ({ ...f, size: e.target.value }))} placeholder="M" required />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label>Quantidade *</Label>
          <Input type="number" min="1" value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))} required />
        </div>
        <div className="space-y-1">
          <Label>Preço (R$) *</Label>
          <Input type="number" step="0.01" min="0" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} placeholder="0,00" required />
        </div>
      </div>
      <Button type="submit" className="w-full" disabled={saving}>
        {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
        {isAdd ? 'Adicionar Peça' : 'Salvar Alterações'}
      </Button>
    </form>
  );

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b bg-card/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-lg items-center gap-3 px-4 py-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Resumo</p>
            <h1 className="font-display text-lg font-semibold">Malinha de {malinha.client_name.split(' ')[0]}</h1>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-lg px-4 py-6 space-y-6">
        {/* Summary card */}
        <div className="rounded-xl border bg-card p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-base font-medium">{malinha.client_name}</h2>
            <div className="flex items-center gap-2">
              <Badge className={statusColors[malinha.status]}>{malinha.status}</Badge>
              {canEdit && (
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={openEditClient}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </div>
          <div className="text-sm text-muted-foreground space-y-1">
            <p>📱 {malinha.client_phone}</p>
            <p>📋 {malinha.client_cpf}</p>
            {malinha.client_address && <p>🏠 {malinha.client_address}</p>}
            {malinha.delivery_location && <p>🚚 Entrega: {malinha.delivery_location}</p>}
            {malinha.collection_location && <p>📥 Coleta: {malinha.collection_location}</p>}
            {malinha.total_pieces && <p>📦 Total peças: {malinha.total_pieces}</p>}
            {malinha.send_date && <p>📅 Envio: {new Date(malinha.send_date).toLocaleDateString('pt-BR')}</p>}
            {malinha.return_date && <p>🔄 Retorno: {new Date(malinha.return_date).toLocaleDateString('pt-BR')}</p>}
            <p>📦 {products.length} {products.length === 1 ? 'peça' : 'peças'}</p>
            <p className="text-foreground font-medium">
              💰 Total: R$ {products.reduce((sum, p) => sum + Number(p.price) * p.quantity, 0).toFixed(2).replace('.', ',')}
            </p>
            <p className="text-success font-semibold">
              ✅ Valor fechado: R$ {products.filter(p => p.status === 'accepted' || p.status === 'edited').reduce((sum, p) => sum + Number(p.price) * p.quantity, 0).toFixed(2).replace('.', ',')}
            </p>
          </div>
        </div>

        {/* Products */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-display text-sm font-medium">Peças</h3>
            {canEdit && (
              <Button variant="outline" size="sm" className="gap-1.5" onClick={openAddProduct}>
                <Plus className="h-4 w-4" /> Adicionar peça
              </Button>
            )}
          </div>
          <div className="space-y-2">
            {products.map(p => (
              <div key={p.id} className="flex items-center gap-3 rounded-lg border bg-card p-3">
                <img src={p.photo_url} alt={p.code} className="h-12 w-12 rounded-md object-cover bg-muted shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{p.code}</p>
                  <p className="text-xs text-muted-foreground">Tam: {p.size} · Qtd: {p.quantity} · R$ {Number(p.price).toFixed(2).replace('.', ',')}</p>
                  {p.client_note && <p className="text-xs text-primary mt-1 italic">💬 "{p.client_note}"</p>}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {p.status === 'accepted' && <Badge className="bg-success text-success-foreground text-xs">Aceita</Badge>}
                  {p.status === 'rejected' && <Badge className="bg-destructive text-destructive-foreground text-xs">Recusada</Badge>}
                  {p.status === 'edited' && <Badge className="bg-accent text-accent-foreground text-xs">Editada</Badge>}
                  {canEdit && (
                    <>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditProduct(p)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setDeleteProduct(p)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
            ))}
            {products.length === 0 && (
              <p className="text-center text-sm text-muted-foreground py-6">Nenhuma peça adicionada.</p>
            )}
          </div>
        </div>

        {/* Seller observation */}
        {(malinha.status === 'Pedido realizado' || malinha.status === 'Finalizada') && (
          <div className="rounded-xl border bg-card p-5 space-y-3">
            <h3 className="font-display text-sm font-medium">Observações da Vendedora</h3>
            {malinha.status === 'Finalizada' ? (
              <p className="text-sm text-foreground bg-muted/50 border border-muted rounded-lg p-3 min-h-[84px]">
                {malinha.seller_note || 'Nenhuma observação.'}
              </p>
            ) : (
              <Textarea
                placeholder="Ex: Fechou 3 peças, pagamento no cartão 2x. Devolver 2 peças na sexta."
                value={sellerNote || malinha.seller_note || ''}
                onChange={e => setSellerNote(e.target.value)}
                rows={3}
                className="text-sm"
              />
            )}
            {malinha.status === 'Pedido realizado' && (
              <Button onClick={handleFinalize} className="w-full gap-2" size="lg" disabled={finalizing}>
                {finalizing && <Loader2 className="h-4 w-4 animate-spin" />}
                <CheckCircle2 className="h-5 w-5" /> Finalizar Malinha
              </Button>
            )}
          </div>
        )}

        {/* Client observation */}
        {clientObservations ? (
          <div className="rounded-xl border bg-card p-5 space-y-3">
            <h3 className="font-display text-sm font-medium">Observações do Cliente</h3>
            <pre className="whitespace-pre-wrap text-sm text-foreground bg-muted/50 border border-muted rounded-lg p-3">
              {clientObservations}
            </pre>
          </div>
        ) : (
          <div className="rounded-xl border bg-card p-5">
            <p className="text-sm text-muted-foreground">Nenhuma observação do cliente.</p>
          </div>
        )}

        {/* Share section */}
        <div className="rounded-xl border bg-card p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Share2 className="h-4 w-4 text-primary" />
            <h3 className="font-display text-sm font-medium">Compartilhar com a cliente</h3>
          </div>
          
          {/* Payment Link Section */}
          <div className="pt-2 pb-4 border-b border-muted">
             {paymentLink ? (
                <div className="space-y-2">
                   <Label className="text-success font-medium flex items-center gap-2"><CheckCircle2 className="h-4 w-4"/> Link de Pagamento Pronto</Label>
                   <div className="flex gap-2">
                     <Input value={paymentLink} readOnly className="text-xs border-success/30 bg-success/5" />
                     <Button variant="secondary" size="icon" onClick={() => {
                        navigator.clipboard.writeText(paymentLink);
                        toast.success('Link de pagamento copiado!');
                     }}>
                       <Copy className="h-4 w-4" />
                     </Button>
                   </div>
                </div>
             ) : (
                <Button onClick={handleGeneratePayment} variant="secondary" className="w-full gap-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-950/50 dark:text-indigo-400" size="lg" disabled={generatingPayment}>
                  {generatingPayment ? <Loader2 className="h-5 w-5 animate-spin" /> : <CreditCard className="h-5 w-5" />} Gerar Link de Pagamento (Stripe)
                </Button>
             )}
          </div>

          <div className="flex gap-2 pt-2">
            <Input value={link} readOnly className="text-xs" />
            <Button variant="secondary" size="icon" onClick={handleCopy}>
              {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
          <Button onClick={handleWhatsApp} className="w-full gap-2 mb-2" size="lg">
            <MessageCircle className="h-5 w-5" /> Enviar por WhatsApp
          </Button>
          <Button onClick={handleEmail} variant="outline" className="w-full gap-2" size="lg" disabled={sendingEmail}>
            {sendingEmail ? <Loader2 className="h-5 w-5 animate-spin" /> : <Mail className="h-5 w-5" />} Enviar por E-mail
          </Button>
        </div>
      </main>

      {/* ─── Edit Client Dialog ─── */}
      <Dialog open={editClientOpen} onOpenChange={setEditClientOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar Dados da Cliente</DialogTitle></DialogHeader>
          <form onSubmit={handleSaveClient} className="space-y-3">
            <div className="space-y-1"><Label>Nome *</Label>
              <Input value={clientForm.client_name} onChange={e => setClientForm(f => ({ ...f, client_name: e.target.value }))} required />
            </div>
            <div className="space-y-1"><Label>Telefone *</Label>
              <Input value={clientForm.client_phone} onChange={e => setClientForm(f => ({ ...f, client_phone: e.target.value }))} required />
            </div>
            <div className="space-y-1"><Label>CPF</Label>
              <Input value={clientForm.client_cpf} onChange={e => setClientForm(f => ({ ...f, client_cpf: e.target.value }))} />
            </div>
            <div className="space-y-1"><Label>Endereço</Label>
              <Input value={clientForm.client_address} onChange={e => setClientForm(f => ({ ...f, client_address: e.target.value }))} />
            </div>
            <div className="space-y-1"><Label>Local de entrega</Label>
              <Input value={clientForm.delivery_location} onChange={e => setClientForm(f => ({ ...f, delivery_location: e.target.value }))} />
            </div>
            <div className="space-y-1"><Label>Local de coleta</Label>
              <Input value={clientForm.collection_location} onChange={e => setClientForm(f => ({ ...f, collection_location: e.target.value }))} />
            </div>
            <div className="space-y-1"><Label>Total de peças</Label>
              <Input type="number" value={clientForm.total_pieces} onChange={e => setClientForm(f => ({ ...f, total_pieces: e.target.value }))} />
            </div>
            <div className="space-y-1"><Label>Data de envio</Label>
              <Input type="date" value={clientForm.send_date} onChange={e => setClientForm(f => ({ ...f, send_date: e.target.value }))} />
            </div>
            <div className="space-y-1"><Label>Data de retorno</Label>
              <Input type="date" value={clientForm.return_date} onChange={e => setClientForm(f => ({ ...f, return_date: e.target.value }))} />
            </div>
            <Button type="submit" className="w-full" disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Salvar
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* ─── Edit Product Dialog ─── */}
      <Dialog open={!!editProduct} onOpenChange={open => { if (!open) setEditProduct(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar Peça</DialogTitle></DialogHeader>
          <ProductForm
            form={editProductForm}
            setForm={setEditProductForm}
            photoPreview={editProductPhotoPreview}
            photoInputId="edit-product-photo"
            onPhotoChange={f => handlePhotoChange(f, setEditProductPhotoPreview, setEditProductPhotoFile)}
            onSubmit={handleSaveProduct}
          />
        </DialogContent>
      </Dialog>

      {/* ─── Add Product Dialog ─── */}
      <Dialog open={addProductOpen} onOpenChange={setAddProductOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Adicionar Peça</DialogTitle></DialogHeader>
          <ProductForm
            form={addProductForm}
            setForm={setAddProductForm}
            photoPreview={addProductPhotoPreview}
            photoInputId="add-product-photo"
            onPhotoChange={f => handlePhotoChange(f, setAddProductPhotoPreview, setAddProductPhotoFile)}
            onSubmit={handleAddProduct}
            isAdd
          />
        </DialogContent>
      </Dialog>

      {/* ─── Delete Product Confirmation ─── */}
      <Dialog open={!!deleteProduct} onOpenChange={open => { if (!open) setDeleteProduct(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remover Peça</DialogTitle>
            <DialogDescription>Tem certeza que deseja remover a peça <strong>{deleteProduct?.code}</strong> desta malinha?</DialogDescription>
          </DialogHeader>
          <div className="flex gap-2 justify-end pt-2">
            <Button variant="outline" onClick={() => setDeleteProduct(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDeleteProduct} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Remover
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
