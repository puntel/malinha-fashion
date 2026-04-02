import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Plus, ImagePlus, Trash2, Loader2, Palette } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { createMalinha, addProducts, uploadProductPhoto } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import type { ProductStatus } from '@/lib/types';

const SIZE_CATEGORIES = {
  'Vestuário': ['PP', 'P', 'M', 'G', 'GG', 'XGG'],
  'Calças/Saias': ['32', '34', '36', '38', '40', '42', '44', '46', '48', '50', '52', '54', '56', '58'],
  'Calçados': ['33', '34', '35', '36', '37', '38', '39', '40', '41', '42', '43', '44'],
};

const PRESET_COLORS = [
  { label: 'Preto', value: 'Preto', hex: '#1a1a1a' },
  { label: 'Branco', value: 'Branco', hex: '#f5f5f5' },
  { label: 'Azul', value: 'Azul', hex: '#3b82f6' },
  { label: 'Vermelho', value: 'Vermelho', hex: '#ef4444' },
  { label: 'Rosa', value: 'Rosa', hex: '#ec4899' },
  { label: 'Verde', value: 'Verde', hex: '#22c55e' },
  { label: 'Amarelo', value: 'Amarelo', hex: '#eab308' },
  { label: 'Bege', value: 'Bege', hex: '#d4b896' },
  { label: 'Cinza', value: 'Cinza', hex: '#6b7280' },
  { label: 'Marrom', value: 'Marrom', hex: '#92400e' },
  { label: 'Roxo', value: 'Roxo', hex: '#8b5cf6' },
  { label: 'Laranja', value: 'Laranja', hex: '#f97316' },
];

interface Variation {
  id: string;
  color: string;
  size: string;
  stock: number;
}

interface LocalProduct {
  tempId: string;
  code: string;
  size: string;
  quantity: number;
  price: number;
  photo_url: string;
  photoFile?: File;
  status: ProductStatus;
  variations: Variation[];
}

function createVariation(): Variation {
  return { id: crypto.randomUUID(), color: '', size: '', stock: 1 };
}

export default function NovaMalinhaProdutos() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [searchParams] = useSearchParams();
  const clientName = searchParams.get('name') || '';
  const clientCpf = searchParams.get('cpf') || '';
  const clientPhone = searchParams.get('phone') || '';
  const clientAddress = searchParams.get('address') || '';
  const deliveryLocation = searchParams.get('deliveryLocation') || '';
  const collectionLocation = searchParams.get('collectionLocation') || '';
  const totalPieces = searchParams.get('totalPieces') || '';
  const sendDate = searchParams.get('sendDate') || '';
  const returnDate = searchParams.get('returnDate') || '';
  const clientEmail = searchParams.get('email') || '';

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

  // Variações do produto sendo adicionado
  const [variations, setVariations] = useState<Variation[]>([createVariation()]);

  const canAdd = code.trim() && size;

  // ── Gerenciar variações ────────────────────────────────────────────────────
  const addVariation = () => setVariations(prev => [...prev, createVariation()]);

  const removeVariation = (id: string) =>
    setVariations(prev => prev.length > 1 ? prev.filter(v => v.id !== id) : prev);

  const updateVariation = (id: string, field: keyof Omit<Variation, 'id'>, value: string | number) => {
    setVariations(prev => prev.map(v => v.id === id ? { ...v, [field]: value } : v));
  };

  // ── Adicionar produto ──────────────────────────────────────────────────────
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
      variations: variations.filter(v => v.color || v.size),
    };
    setProducts(prev => [...prev, product]);
    setCode(''); setSize(''); setQty('1'); setPrice('');
    setPhotoPreview(null); setPhotoFile(null);
    setVariations([createVariation()]);
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
    if (!user) {
      toast.error('Sessão inválida. Faça login novamente.');
      return;
    }

    setSaving(true);
    try {
      const productsWithUrls = await Promise.all(
        products.map(async (p) => {
          let photo_url = p.photo_url;
          if (p.photoFile) {
            photo_url = await uploadProductPhoto(p.photoFile);
          }
          return { code: p.code, size: p.size, quantity: p.quantity, price: p.price, photo_url, status: p.status as ProductStatus };
        })
      );

      const malinhaId = await createMalinha({
        client_name: clientName,
        client_cpf: clientCpf,
        client_phone: clientPhone,
        client_email: clientEmail || undefined,
        client_address: clientAddress || undefined,
        delivery_location: deliveryLocation || undefined,
        collection_location: collectionLocation || undefined,
        total_pieces: totalPieces ? parseInt(totalPieces) : undefined,
        send_date: sendDate || undefined,
        return_date: returnDate || undefined,
        seller_name: profile?.full_name || 'Vendedora',
        vendedora_id: user.id,
        seller_note: observation || undefined,
      });

      await addProducts(malinhaId, productsWithUrls);
      navigate(`/malinha/${malinhaId}/resumo`);
    } catch (err) {
      console.error(err);
      toast.error('Não foi possível salvar a malinha.');
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
        {clientAddress && (
          <p className="text-sm text-muted-foreground mb-4">Endereço: <span className="font-medium text-foreground">{clientAddress}</span></p>
        )}
        {(deliveryLocation || collectionLocation || totalPieces || sendDate || returnDate) && (
          <div className="rounded-xl border bg-card p-4 mb-4 space-y-2">
            <p className="text-sm font-medium text-foreground">Logística</p>
            {deliveryLocation && <p className="text-sm text-muted-foreground">Entrega: {deliveryLocation}</p>}
            {collectionLocation && <p className="text-sm text-muted-foreground">Coleta: {collectionLocation}</p>}
            {totalPieces && <p className="text-sm text-muted-foreground">Total peças: {totalPieces}</p>}
            {sendDate && <p className="text-sm text-muted-foreground">Envio: {new Date(sendDate).toLocaleDateString('pt-BR')}</p>}
            {returnDate && <p className="text-sm text-muted-foreground">Retorno: {new Date(returnDate).toLocaleDateString('pt-BR')}</p>}
          </div>
        )}

        {/* ── Card de cadastro do produto ─────────────────────────────────── */}
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

          {/* ── Variações de Cor / Tamanho / Estoque ────────────────────── */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Palette className="h-4 w-4 text-muted-foreground" />
                <Label className="text-sm font-medium">Variações (cor · tamanho · estoque)</Label>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addVariation}
                className="h-7 gap-1 px-2 text-xs"
              >
                <Plus className="h-3 w-3" />
                Variação
              </Button>
            </div>

            <div className="space-y-2">
              {variations.map((v, idx) => (
                <div
                  key={v.id}
                  className="relative flex items-end gap-2 rounded-lg border bg-muted/30 p-3"
                >
                  {/* Cor */}
                  <div className="flex-1 min-w-0 space-y-1">
                    <span className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">Cor</span>
                    <Select value={v.color} onValueChange={val => updateVariation(v.id, 'color', val)}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="Selecionar">
                          {v.color && (
                            <span className="flex items-center gap-1.5">
                              <span
                                className="inline-block h-3 w-3 rounded-full border border-border/60"
                                style={{ backgroundColor: PRESET_COLORS.find(c => c.value === v.color)?.hex || '#ccc' }}
                              />
                              {v.color}
                            </span>
                          )}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {PRESET_COLORS.map(c => (
                          <SelectItem key={c.value} value={c.value}>
                            <span className="flex items-center gap-2">
                              <span
                                className="inline-block h-3 w-3 rounded-full border border-border/60 flex-shrink-0"
                                style={{ backgroundColor: c.hex }}
                              />
                              {c.label}
                            </span>
                          </SelectItem>
                        ))}
                        <SelectItem value="Outra">Outra</SelectItem>
                      </SelectContent>
                    </Select>
                    {v.color === 'Outra' && (
                      <Input
                        className="h-7 text-xs mt-1"
                        placeholder="Digite a cor..."
                        onChange={e => updateVariation(v.id, 'color', e.target.value || 'Outra')}
                      />
                    )}
                  </div>

                  {/* Tamanho */}
                  <div className="w-20 space-y-1">
                    <span className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">Tam.</span>
                    <Select value={v.size} onValueChange={val => updateVariation(v.id, 'size', val)}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="-" />
                      </SelectTrigger>
                      <SelectContent>
                        {SIZE_CATEGORIES[sizeCategory].map(s => (
                          <SelectItem key={s} value={s}>{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Estoque */}
                  <div className="w-16 space-y-1">
                    <span className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">Estoque</span>
                    <Input
                      type="number"
                      min="0"
                      value={v.stock}
                      onChange={e => updateVariation(v.id, 'stock', parseInt(e.target.value) || 0)}
                      className="h-8 text-xs px-2"
                    />
                  </div>

                  {/* Remover variação */}
                  {variations.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeVariation(v.id)}
                      className="h-8 w-8 shrink-0 text-destructive/70 hover:text-destructive self-end"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* ── Foto ─────────────────────────────────────────────────────── */}
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

        {/* ── Lista de produtos adicionados ──────────────────────────────── */}
        {products.length > 0 && (
          <div className="mt-6">
            <h3 className="font-display text-sm font-medium mb-3">Peças adicionadas ({products.length})</h3>
            <div className="space-y-2">
              {products.map(p => (
                <div key={p.tempId} className="rounded-lg border bg-card p-3 space-y-2">
                  <div className="flex items-center gap-3">
                    <img src={p.photo_url} alt={p.code} className="h-12 w-12 rounded-md object-cover bg-muted flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{p.code}</p>
                      <p className="text-xs text-muted-foreground">Tam: {p.size} · Qtd: {p.quantity} · R$ {p.price.toFixed(2).replace('.', ',')}</p>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => handleRemove(p.tempId)} className="shrink-0 text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  {p.variations.length > 0 && p.variations.some(v => v.color || v.size) && (
                    <div className="flex flex-wrap gap-1.5 pt-1 border-t border-border/40">
                      {p.variations.filter(v => v.color || v.size).map(v => (
                        <span
                          key={v.id}
                          className="inline-flex items-center gap-1 rounded-full border bg-muted px-2 py-0.5 text-[11px] text-muted-foreground"
                        >
                          {v.color && (
                            <span
                              className="inline-block h-2.5 w-2.5 rounded-full border border-border/50 flex-shrink-0"
                              style={{ backgroundColor: PRESET_COLORS.find(c => c.value === v.color)?.hex || '#ccc' }}
                            />
                          )}
                          {[v.color, v.size, v.stock > 0 ? `${v.stock} un.` : null].filter(Boolean).join(' · ')}
                        </span>
                      ))}
                    </div>
                  )}
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
