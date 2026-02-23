import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Plus, ImagePlus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { addMalinha, generateId, getData } from '@/lib/mock-data';
import type { Product } from '@/lib/mock-data';

const SIZES = ['PP', 'P', 'M', 'G', 'GG'];

export default function NovaMalinhaProdutos() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const clientName = searchParams.get('name') || '';
  const clientCpf = searchParams.get('cpf') || '';
  const clientPhone = searchParams.get('phone') || '';

  const [products, setProducts] = useState<Product[]>([]);
  const [code, setCode] = useState('');
  const [size, setSize] = useState('');
  const [qty, setQty] = useState('1');
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  const canAdd = code.trim() && size;

  const handleAddProduct = () => {
    if (!canAdd) return;
    const product: Product = {
      id: generateId(),
      code: code.trim().toUpperCase(),
      size,
      quantity: parseInt(qty) || 1,
      photoUrl: photoPreview || '/placeholder.svg',
      status: 'pending',
    };
    setProducts(prev => [...prev, product]);
    setCode('');
    setSize('');
    setQty('1');
    setPhotoPreview(null);
  };

  const handleRemove = (id: string) => {
    setProducts(prev => prev.filter(p => p.id !== id));
  };

  const handlePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setPhotoPreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleFinalize = () => {
    const data = getData();
    const id = generateId();
    addMalinha({
      id,
      clientName,
      clientCpf,
      clientPhone,
      createdAt: new Date().toISOString().split('T')[0],
      status: 'Enviada',
      sellerName: data.currentSeller,
      products,
    });
    navigate(`/malinha/${id}/resumo`);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b bg-card/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-lg items-center gap-3 px-4 py-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Nova Malinha</p>
            <h1 className="font-display text-lg font-semibold">Adicionar Produtos</h1>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-lg px-4 py-6 pb-32">
        <p className="text-sm text-muted-foreground mb-4">Cliente: <span className="font-medium text-foreground">{clientName}</span></p>

        {/* Form */}
        <div className="rounded-xl border bg-card p-4 space-y-4">
          <div className="space-y-2">
            <Label>Código do produto</Label>
            <Input placeholder="Ex: VT-001" value={code} onChange={e => setCode(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Tamanho</Label>
              <Select value={size} onValueChange={setSize}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {SIZES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Quantidade</Label>
              <Input type="number" min="1" value={qty} onChange={e => setQty(e.target.value)} />
            </div>
          </div>

          {/* Photo */}
          <div className="space-y-2">
            <Label>Foto da peça</Label>
            <label className="flex h-28 cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-border bg-muted/50 transition-colors hover:border-primary/40">
              {photoPreview ? (
                <img src={photoPreview} alt="Preview" className="h-full w-full rounded-lg object-cover" />
              ) : (
                <div className="flex flex-col items-center gap-1 text-muted-foreground">
                  <ImagePlus className="h-6 w-6" />
                  <span className="text-xs">Toque para adicionar</span>
                </div>
              )}
              <input type="file" accept="image/*" className="hidden" onChange={handlePhoto} />
            </label>
          </div>

          <Button variant="secondary" onClick={handleAddProduct} disabled={!canAdd} className="w-full gap-2">
            <Plus className="h-4 w-4" /> Adicionar à malinha
          </Button>
        </div>

        {/* Added products list */}
        {products.length > 0 && (
          <div className="mt-6">
            <h3 className="font-display text-sm font-medium mb-3">Peças adicionadas ({products.length})</h3>
            <div className="space-y-2">
              {products.map(p => (
                <div key={p.id} className="flex items-center gap-3 rounded-lg border bg-card p-3">
                  <img src={p.photoUrl} alt={p.code} className="h-12 w-12 rounded-md object-cover bg-muted" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{p.code}</p>
                    <p className="text-xs text-muted-foreground">Tam: {p.size} · Qtd: {p.quantity}</p>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => handleRemove(p.id)} className="shrink-0 text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Fixed bottom bar */}
      {products.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 border-t bg-card/90 backdrop-blur-md p-4">
          <div className="mx-auto max-w-lg">
            <Button onClick={handleFinalize} className="w-full" size="lg">
              Avançar e Revisar ({products.length} {products.length === 1 ? 'peça' : 'peças'})
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
