import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Check, X, Pencil, Heart, Loader2, ZoomIn } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { MalinhaProduct, ProductStatus, Malinha } from '@/lib/types';

export default function ClienteView() {
  const { id } = useParams();
  const [malinha, setMalinha] = useState<Malinha | null>(null);
  const [products, setProducts] = useState<MalinhaProduct[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editNote, setEditNote] = useState('');
  const [finalized, setFinalized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Lightbox
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    supabase.rpc('get_malinha_for_client', { _malinha_id: id }).then(({ data, error }) => {
      if (error || !data) { setLoading(false); return; }
      const malinhaResult = data as unknown as Malinha;
      setProducts(malinhaResult.malinha_products || []);
      setMalinha(malinhaResult);
      if (malinhaResult.status === 'Enviada') {
        supabase.rpc('update_malinha_client_status', { _malinha_id: id, _status: 'Em aberto' });
      }
      setLoading(false);
    });
  }, [id]);

  if (loading) return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  );

  if (!malinha) return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <p className="text-muted-foreground text-center">Esta malinha não foi encontrada ou o link é inválido.</p>
    </div>
  );

  const setStatus = (productId: string, status: ProductStatus, note?: string) => {
    setProducts(prev => prev.map(p => {
      if (p.id !== productId) return p;
      return {
        ...p,
        status,
        client_note: note !== undefined ? note : p.client_note,
      };
    }));
  };

  const handleEdit = (productId: string) => {
    if (editingId === productId) {
      setStatus(productId, 'edited', editNote);
      setEditingId(null);
      setEditNote('');
    } else {
      setEditingId(productId);
      const p = products.find(p => p.id === productId);
      setEditNote(p?.client_note || '');
    }
  };

  const handleFinalize = async () => {
    setSaving(true);
    try {
      // If there is a client note being edited, persist it before finalizing
      let finalProducts = products;
      if (editingId) {
        finalProducts = products.map(p =>
          p.id === editingId ? { ...p, status: 'edited', client_note: editNote } : p
        );
        setProducts(finalProducts);
        setEditingId(null);
        setEditNote('');
      }

      const { error: productError } = await supabase.rpc('update_product_client_statuses', {
        _malinha_id: id!,
        _products: finalProducts.map(p => ({ id: p.id, status: p.status, client_note: p.client_note ?? null })),
      });
      if (productError) {
        throw productError;
      }

      const { error: statusError } = await supabase.rpc('update_malinha_client_status', { _malinha_id: id!, _status: 'Pedido realizado' });
      if (statusError) {
        throw statusError;
      }

      setFinalized(true);
    } catch (err: unknown) {
      console.error(err);
      const errorMessage = err instanceof Error ? err.message : 'Erro ao finalizar pedido. Tente novamente.';
      toast.error(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  if (finalized) return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6 text-center">
      <div className="rounded-full bg-success/10 p-4 mb-4">
        <Heart className="h-10 w-10 text-primary" />
      </div>
      <h1 className="font-display text-2xl font-semibold text-foreground mb-2">Obrigada! 💕</h1>
      <p className="text-muted-foreground max-w-xs">
        Suas escolhas foram enviadas. {malinha.seller_name} entrará em contato em breve para finalizar tudo!
      </p>
    </div>
  );

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="border-b bg-card px-4 py-6">
        <div className="mx-auto max-w-lg text-center">
          <p className="text-xs uppercase tracking-widest text-muted-foreground mb-1">Minha Malinha</p>
          <h1 className="font-display text-xl font-semibold text-foreground">
            Olá, {malinha.client_name.split(' ')[0]}! 👋
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {malinha.seller_name} preparou estas peças para você.
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-lg px-4 py-6">
        <div className="space-y-4">
          {products.map(p => (
            <div
              key={p.id}
              className={`rounded-xl border bg-card overflow-hidden transition-all ${
                p.status === 'rejected' ? 'opacity-50' : ''
              } ${p.status === 'accepted' ? 'ring-2 ring-success' : ''} ${
                p.status === 'edited' ? 'ring-2 ring-primary' : ''
              }`}
            >
              <div className="flex gap-3 p-4">
                {/* Clickable image → opens lightbox */}
                <button
                  type="button"
                  className="relative group shrink-0 h-20 w-20 rounded-lg overflow-hidden bg-muted focus:outline-none"
                  onClick={() => p.photo_url && setLightboxUrl(p.photo_url)}
                  title="Ver imagem completa"
                >
                  <img
                    src={p.photo_url}
                    alt={p.code}
                    className={`h-full w-full object-cover transition-opacity ${p.status === 'rejected' ? 'grayscale' : ''}`}
                  />
                  {p.photo_url && (
                    <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <ZoomIn className="h-5 w-5 text-white" />
                    </div>
                  )}
                </button>

                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground">{p.code}</p>
                  <p className="text-sm text-muted-foreground">Tamanho: {p.size}</p>
                  <p className="text-sm font-medium text-foreground">R$ {Number(p.price).toFixed(2).replace('.', ',')}</p>
                  {p.client_note && <p className="text-xs text-primary mt-1 italic">"{p.client_note}"</p>}
                </div>
              </div>

              {editingId === p.id && (
                <div className="px-4 pb-3">
                  <Textarea
                    placeholder="Ex: Quero essa, mas no tamanho M ou na cor preta"
                    value={editNote}
                    onChange={e => setEditNote(e.target.value)}
                    rows={2}
                    className="text-sm"
                  />
                </div>
              )}

              <div className="flex border-t">
                <button
                  onClick={() => setStatus(p.id, 'rejected')}
                  className={`flex flex-1 items-center justify-center gap-1.5 py-3 text-sm transition-colors ${
                    p.status === 'rejected' ? 'bg-destructive/10 text-destructive font-medium' : 'text-muted-foreground hover:text-destructive'
                  }`}
                >
                  <X className="h-4 w-4" /> Não
                </button>
                <div className="w-px bg-border" />
                <button
                  onClick={() => setStatus(p.id, 'accepted')}
                  className={`flex flex-1 items-center justify-center gap-1.5 py-3 text-sm transition-colors ${
                    p.status === 'accepted' ? 'bg-success/10 text-success font-medium' : 'text-muted-foreground hover:text-success'
                  }`}
                >
                  <Check className="h-4 w-4" /> Sim
                </button>
                <div className="w-px bg-border" />
                <button
                  onClick={() => handleEdit(p.id)}
                  className={`flex flex-1 items-center justify-center gap-1.5 py-3 text-sm transition-colors ${
                    p.status === 'edited' || editingId === p.id ? 'bg-primary/10 text-primary font-medium' : 'text-muted-foreground hover:text-primary'
                  }`}
                >
                  <Pencil className="h-4 w-4" /> {editingId === p.id ? 'Salvar' : 'Observação'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </main>

      {/* Fixed bottom bar */}
      <div className="fixed bottom-0 left-0 right-0 border-t bg-card/90 backdrop-blur-md p-4">
        <div className="mx-auto max-w-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">Total selecionado:</span>
            <span className="font-display font-semibold text-foreground">
              R$ {products.filter(p => p.status === 'accepted' || p.status === 'edited').reduce((sum, p) => sum + Number(p.price) * p.quantity, 0).toFixed(2).replace('.', ',')}
            </span>
          </div>
          <Button onClick={handleFinalize} className="w-full gap-2" size="lg" disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Finalizar Minhas Escolhas
          </Button>
        </div>
      </div>

      {/* ─── Image Lightbox ─── */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setLightboxUrl(null)}
        >
          <button
            className="absolute top-4 right-4 text-white/80 hover:text-white transition-colors"
            onClick={() => setLightboxUrl(null)}
          >
            <X className="h-7 w-7" />
          </button>
          <img
            src={lightboxUrl}
            alt="Imagem da peça"
            className="max-h-[85vh] max-w-full rounded-xl object-contain shadow-2xl"
            onClick={e => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
