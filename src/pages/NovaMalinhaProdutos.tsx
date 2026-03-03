import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Plus, ImagePlus, Trash2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { createMalinha, addProducts, uploadProductPhoto } from '@/lib/api';
import type { ProductStatus } from '@/lib/types';

const SIZE_CATEGORIES = {
  'Vestuário': ['PP', 'P', 'M', 'G', 'GG', 'XGG'],
  'Calças/Saias': ['32', '34', '36', '38', '40', '42', '44', '46', '48', '50', '52', '54', '56', '58'],
  'Calçados': ['33', '34', '35', '36', '37', '38', '39', '40', '41', '42', '43', '44'],
};

interface LocalProduct {
  tempId: string;
  code: string;
  size: string;
  quantity: number;
  price: number;
  photo_url: string;
  photoFile?: File;
  status: ProductStatus;
}

export default function NovaMalinhaProdutos() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const clientName = searchParams.get('name') || '';
  const clientCpf = searchParams.get('cpf') || '';
  const clientPhone = searchParams.get('phone') || '';

  const [products, setProducts] = useState<LocalProduct[]>([]);
  const [code, setCode] = useState('');
  const [sizeCategory, setSizeCategory] = useState<keyof typeof SIZE_CATEGORIES>('Vestuário');
  const [size, setSize] = useState('');
  const [qty, setQty] = useState('1');
  const [price, setPrice] = useState('');
  const [observation, setObservation] = useState('');
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const canAdd = code.trim() && size;

  const handleAddProduct = () => {
    if (!canAdd) return;
    const product: LocalProduct = {
      tempId: crypto.randomUUID(),
      code: code.trim().toUpperCase(),
      size,
      quantity: parseInt(qty) || 1,
      price: parseFloat(price.replace(',', '.')) || 0,
      photo_url: photoPreview || '/placeholder.svg',
      photoFile: photoFile || undefined,
      status: 'pending',
    };
    setProducts(prev => [...prev, product]);
    setCode(''); setSize(''); setQty('1'); setPrice('');
    setPhotoPreview(null); setPhotoFile(null);
  };

  const handleRemove = (tempId: string) => {
    setProducts(prev => prev.filter(p => p.tempId !== tempId));
  };

  const handlePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPhotoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setPhotoPreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleFinalize = async () => {
    setSaving(true);
    try {
      // 1. Upload photos
      const productsWithUrls = await Promise.all(
        products.map(async (p) => {
          let photo_url = p.photo_url;
          if (p.photoFile) {
            photo_url = await uploadProductPhoto(p.photoFile);
          }
          return { code: p.code, size: p.size, quantity: p.quantity, price: p.price, photo_url, status: p.status as ProductStatus };
        })
      );

      // 2. Create malinha
      const malinhaId = await createMalinha({
        client_name: clientName,
        client_cpf: clientCpf,
        client_phone: clientPhone,
        seller_name: 'Ana Beatriz',
        seller_note: observation || undefined,
      });

      // 3. Add products
      await addProducts(malinhaId, productsWithUrls);

      navigate(`/malinha/${malinhaId}/resumo`);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
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

        <div className="rounded-xl border bg-card p-4 space-y-4">
          <div className="space-y-2">
            <Label>Código do produto</Label>
            <Input placeholder="Ex: VT-001" value={code} onChange={e => setCode(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Categoria de tamanho</Label>
            <Select value={sizeCategory} onValueChange={(v) => { setSizeCategory(v as keyof typeof SIZE_CATEGORIES); setSize(''); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.keys(SIZE_CATEGORIES).map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label>Tamanho</Label>
              <Select value={size} onValueChange={setSize}>
                <SelectTrigger><SelectValue placeholder="Tam" /></SelectTrigger>
                <SelectContent>
                  {SIZE_CATEGORIES[sizeCategory].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Qtd</Label>
              <Input type="number" min="1" value={qty} onChange={e => setQty(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Preço (R$)</Label>
              <Input placeholder="0,00" value={price} onChange={e => setPrice(e.target.value)} inputMode="decimal" />
            </div>
          </div>

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

          <div className="space-y-2">
            <Label>Observação da vendedora</Label>
            <Input placeholder="Ex: Cliente prefere cores claras" value={observation} onChange={e => setObservation(e.target.value)} />
          </div>

          <Button variant="secondary" onClick={handleAddProduct} disabled={!canAdd} className="w-full gap-2">
            <Plus className="h-4 w-4" /> Adicionar à malinha
          </Button>
        </div>

        {products.length > 0 && (
          <div className="mt-6">
            <h3 className="font-display text-sm font-medium mb-3">Peças adicionadas ({products.length})</h3>
            <div className="space-y-2">
              {products.map(p => (
                <div key={p.tempId} className="flex items-center gap-3 rounded-lg border bg-card p-3">
                  <img src={p.photo_url} alt={p.code} className="h-12 w-12 rounded-md object-cover bg-muted" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{p.code}</p>
                    <p className="text-xs text-muted-foreground">Tam: {p.size} · Qtd: {p.quantity} · R$ {p.price.toFixed(2).replace('.', ',')}</p>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => handleRemove(p.tempId)} className="shrink-0 text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {products.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 border-t bg-card/90 backdrop-blur-md p-4">
          <div className="mx-auto max-w-lg">
            <Button onClick={handleFinalize} className="w-full gap-2" size="lg" disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Avançar e Revisar ({products.length} {products.length === 1 ? 'peça' : 'peças'})
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
