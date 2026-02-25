import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Check, X, Pencil, Heart, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { fetchMalinhaById, updateMalinhaStatus, updateProductStatuses } from '@/lib/api';
import type { Product, ProductStatus } from '@/lib/types';

export default function ClienteView() {
  const { id } = useParams();
  const [products, setProducts] = useState<Product[]>([]);
  const [malinhaData, setMalinhaData] = useState<{ client_name: string; seller_name: string; status: string } | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editNote, setEditNote] = useState('');
  const [finalized, setFinalized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!id) return;
    fetchMalinhaById(id).then(malinha => {
      if (malinha) {
        setProducts(malinha.malinha_products || []);
        setMalinhaData({ client_name: malinha.client_name, seller_name: malinha.seller_name, status: malinha.status });
        // Mark as "Em aberto" when client opens
        if (malinha.status === 'Enviada') {
          updateMalinhaStatus(malinha.id, 'Em aberto');
        }
      }
      setLoading(false);
    });
  }, [id]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!malinhaData) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <p className="text-muted-foreground text-center">Esta malinha não foi encontrada ou o link é inválido.</p>
      </div>
    );
  }

  const setStatus = (productId: string, status: ProductStatus, note?: string) => {
    setProducts(prev =>
      prev.map(p => p.id === productId ? { ...p, status, client_note: note || p.client_note } : p)
    );
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
      await updateProductStatuses(products.map(p => ({ id: p.id, status: p.status, client_note: p.client_note })));
      await updateMalinhaStatus(id!, 'Pedido realizado');
      setFinalized(true);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  if (finalized) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6 text-center">
        <div className="rounded-full bg-success/10 p-4 mb-4">
          <Heart className="h-10 w-10 text-primary" />
        </div>
        <h1 className="font-display text-2xl font-semibold text-foreground mb-2">Obrigada! 💕</h1>
        <p className="text-muted-foreground max-w-xs">
          Suas escolhas foram enviadas. {malinhaData.seller_name} entrará em contato em breve para finalizar tudo!
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="border-b bg-card px-4 py-6">
        <div className="mx-auto max-w-lg text-center">
          <p className="text-xs uppercase tracking-widest text-muted-foreground mb-1">Minha Malinha</p>
          <h1 className="font-display text-xl font-semibold text-foreground">
            Olá, {malinhaData.client_name.split(' ')[0]}! 👋
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {malinhaData.seller_name} preparou estas peças para você.
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
                <img
                  src={p.photo_url}
                  alt={p.code}
                  className={`h-20 w-20 rounded-lg object-cover bg-muted ${p.status === 'rejected' ? 'grayscale' : ''}`}
                />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground">{p.code}</p>
                  <p className="text-sm text-muted-foreground">Tamanho: {p.size}</p>
                  <p className="text-sm font-medium text-foreground">R$ {Number(p.price).toFixed(2).replace('.', ',')}</p>
                  {p.client_note && (
                    <p className="text-xs text-primary mt-1 italic">"{p.client_note}"</p>
                  )}
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
                  <Pencil className="h-4 w-4" /> {editingId === p.id ? 'Salvar' : 'Editar'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </main>

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
    </div>
  );
}
