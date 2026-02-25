import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Check, X, Pencil, Heart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { getMalinhaById, updateMalinha } from '@/lib/mock-data';
import type { Product, ProductStatus } from '@/lib/mock-data';

export default function ClienteView() {
  const { id } = useParams();
  const malinha = getMalinhaById(id || '');
  const [products, setProducts] = useState<Product[]>(malinha?.products || []);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editNote, setEditNote] = useState('');
  const [finalized, setFinalized] = useState(false);

  // Mark as "Em aberto" when client opens the link
  useState(() => {
    if (malinha && malinha.status === 'Enviada') {
      updateMalinha(malinha.id, { status: 'Em aberto' });
    }
  });

  if (!malinha) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <p className="text-muted-foreground text-center">Esta malinha não foi encontrada ou o link é inválido.</p>
      </div>
    );
  }

  const setStatus = (productId: string, status: ProductStatus, note?: string) => {
    setProducts(prev =>
      prev.map(p => p.id === productId ? { ...p, status, clientNote: note || p.clientNote } : p)
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
      setEditNote(p?.clientNote || '');
    }
  };

  const handleFinalize = () => {
    updateMalinha(malinha.id, {
      status: 'Pedido realizado',
      products: products,
    });
    setFinalized(true);
  };

  if (finalized) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6 text-center">
        <div className="rounded-full bg-success/10 p-4 mb-4">
          <Heart className="h-10 w-10 text-primary" />
        </div>
        <h1 className="font-display text-2xl font-semibold text-foreground mb-2">Obrigada! 💕</h1>
        <p className="text-muted-foreground max-w-xs">
          Suas escolhas foram enviadas. {malinha.sellerName} entrará em contato em breve para finalizar tudo!
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <header className="border-b bg-card px-4 py-6">
        <div className="mx-auto max-w-lg text-center">
          <p className="text-xs uppercase tracking-widest text-muted-foreground mb-1">Minha Malinha</p>
          <h1 className="font-display text-xl font-semibold text-foreground">
            Olá, {malinha.clientName.split(' ')[0]}! 👋
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {malinha.sellerName} preparou estas peças para você.
          </p>
        </div>
      </header>

      {/* Products */}
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
                  src={p.photoUrl}
                  alt={p.code}
                  className={`h-20 w-20 rounded-lg object-cover bg-muted ${p.status === 'rejected' ? 'grayscale' : ''}`}
                />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground">{p.code}</p>
                  <p className="text-sm text-muted-foreground">Tamanho: {p.size}</p>
                  <p className="text-sm font-medium text-foreground">R$ {p.price.toFixed(2).replace('.', ',')}</p>
                  {p.clientNote && (
                    <p className="text-xs text-primary mt-1 italic">"{p.clientNote}"</p>
                  )}
                </div>
              </div>

              {/* Edit field */}
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

              {/* Action buttons */}
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

      {/* Fixed bottom */}
      <div className="fixed bottom-0 left-0 right-0 border-t bg-card/90 backdrop-blur-md p-4">
        <div className="mx-auto max-w-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">Total selecionado:</span>
            <span className="font-display font-semibold text-foreground">
              R$ {products.filter(p => p.status === 'accepted' || p.status === 'edited').reduce((sum, p) => sum + p.price * p.quantity, 0).toFixed(2).replace('.', ',')}
            </span>
          </div>
          <Button onClick={handleFinalize} className="w-full" size="lg">
            Finalizar Minhas Escolhas
          </Button>
        </div>
      </div>
    </div>
  );
}
