import { useState, useMemo } from 'react';
import { 
  Plus, 
  Search, 
  Upload, 
  Warehouse, 
  Pencil, 
  Trash2, 
  Loader2, 
  Filter,
  MoreVertical,
  Image as ImageIcon,
  Check,
  X,
  Download
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import type { InventoryProduct } from '@/lib/types';
import { uploadProductPhoto } from '@/lib/api';

export default function Produtos() {
  const { user, role } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<InventoryProduct | null>(null);
  const [loading, setLoading] = useState(false);
  
  // Form state
  const [form, setForm] = useState({
    name: '',
    internal_code: '',
    unit_price: '',
    profit_percent: '0',
    category: '',
    brand: '',
    description: '',
    image_url: ''
  });
  
  const [variations, setVariations] = useState<{ id: string; size: string; color: string; quantity: string }[]>([
    { id: crypto.randomUUID(), size: '', color: '', quantity: '0' }
  ]);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState('');

  // Fetch loja_id for the current user
  const { data: userData } = useQuery({
    queryKey: ['user-loja', user?.id],
    queryFn: async () => {
      if (role === 'master') return { loja_id: null };
      if (role === 'loja') {
        const { data } = await supabase.from('lojas').select('id').eq('created_by', user?.id).single();
        return { loja_id: data?.id };
      }
      const { data } = await supabase.from('vendedoras').select('loja_id').eq('user_id', user?.id).single();
      return { loja_id: data?.loja_id };
    },
    enabled: !!user
  });

  const lojaId = userData?.loja_id;

  const { data: products = [], isLoading } = useQuery({
    queryKey: ['inventory-products', lojaId],
    queryFn: async () => {
      let query = supabase.from('products').select('*');
      if (lojaId) query = query.eq('loja_id', lojaId);
      const { data, error } = await query.order('name');
      if (error) throw error;
      return data as InventoryProduct[];
    },
    enabled: role === 'master' || !!lojaId
  });

  const filteredProducts = useMemo(() => {
    return products.filter(p => 
      p.name.toLowerCase().includes(search.toLowerCase()) || 
      p.internal_code?.toLowerCase().includes(search.toLowerCase()) ||
      p.category?.toLowerCase().includes(search.toLowerCase())
    );
  }, [products, search]);

  const resetForm = () => {
    setForm({
      name: '',
      internal_code: '',
      unit_price: '',
      profit_percent: '0',
      category: '',
      brand: '',
      description: '',
      image_url: ''
    });
    setVariations([{ id: crypto.randomUUID(), size: '', color: '', quantity: '0' }]);
    setPhotoFile(null);
    setPhotoPreview('');
    setEditingProduct(null);
  };

  const handleOpenEdit = (p: InventoryProduct) => {
    setEditingProduct(p);
    setForm({
      name: p.name,
      internal_code: p.internal_code || '',
      unit_price: String(p.unit_price),
      profit_percent: String(p.profit_percent || '0'),
      category: p.category || '',
      brand: p.brand || '',
      description: p.description || '',
      image_url: p.image_url || ''
    });
    setVariations([{ 
      id: crypto.randomUUID(), 
      size: p.size || '', 
      color: p.color || '', 
      quantity: String(p.quantity)
    }]);
    setPhotoPreview(p.image_url || '');
    setIsAddOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      let image_url = form.image_url;
      if (photoFile) {
        image_url = await uploadProductPhoto(photoFile);
      }

      const basePayload = {
        name: form.name,
        internal_code: form.internal_code,
        unit_price: parseFloat(form.unit_price.replace(',', '.')),
        profit_percent: parseFloat(form.profit_percent),
        category: form.category,
        brand: form.brand,
        description: form.description,
        image_url,
        loja_id: lojaId
      };

      if (editingProduct) {
        const v = variations[0];
        const payload = {
          ...basePayload,
          size: v.size,
          color: v.color,
          quantity: parseInt(v.quantity) || 0
        };
        const { error } = await supabase.from('products').update(payload).eq('id', editingProduct.id);
        if (error) throw error;
        toast.success('Produto atualizado!');
      } else {
        const payloads = variations.map(v => ({
          ...basePayload,
          size: v.size,
          color: v.color,
          quantity: parseInt(v.quantity) || 0
        }));
        const { error } = await supabase.from('products').insert(payloads);
        if (error) throw error;
        toast.success(payloads.length > 1 ? `${payloads.length} variações criadas!` : 'Produto criado!');
      }

      setIsAddOpen(false);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ['inventory-products'] });
    } catch (err: any) {
      toast.error(err.message || 'Erro ao salvar produto');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este produto?')) return;
    try {
      const { error } = await supabase.from('products').delete().eq('id', id);
      if (error) throw error;
      toast.success('Produto excluído!');
      queryClient.invalidateQueries({ queryKey: ['inventory-products'] });
    } catch (err: any) {
      toast.error(err.message || 'Erro ao excluir');
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    try {
      const data: any[] = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (evt) => {
          try {
            const bstr = evt.target?.result;
            const wb = XLSX.read(bstr, { type: 'binary' });
            const wsname = wb.SheetNames[0];
            const ws = wb.Sheets[wsname];
            resolve(XLSX.utils.sheet_to_json(ws));
          } catch (error) {
            reject(error);
          }
        };
        reader.onerror = (error) => reject(error);
        reader.readAsBinaryString(file);
      });

      const importedProducts = data.map(item => {
        const cleanNumber = (val: any) => {
          if (!val) return 0;
          if (typeof val === 'number') return val;
          const cleanStr = String(val).replace(/[^\d.,-]/g, '').replace(',', '.');
          const parsed = parseFloat(cleanStr);
          return isNaN(parsed) ? 0 : parsed;
        };

        return {
          name: item.Nome || item.name || '',
          internal_code: String(item.Código || item.code || ''),
          quantity: parseInt(item.Quantidade || item.quantity || '0') || 0,
          unit_price: cleanNumber(item.Preço || item.price),
          category: item.Categoria || item.category || '',
          brand: item.Marca || item.brand || '',
          size: String(item.Tamanho || item.size || ''),
          color: item.Cor || item.color || '',
          description: item.Descrição || item.description || '',
          profit_percent: cleanNumber(item.Lucro || item.profit),
          loja_id: lojaId
        };
      }).filter(p => p.name);

      if (importedProducts.length === 0) {
        throw new Error("Nenhum produto válido encontrado. Verifique as colunas da planilha.");
      }

      const { error } = await supabase.from('products').insert(importedProducts);
      if (error) throw error;

      toast.success(`${importedProducts.length} produtos importados!`);
      setIsImportOpen(false);
      queryClient.invalidateQueries({ queryKey: ['inventory-products'] });
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Erro na importação. Verifique o formato do arquivo.');
    } finally {
      setLoading(false);
      e.target.value = ''; // Reset input so same file can be selected again
    }
  };

  const exportTemplate = () => {
    const ws = XLSX.utils.json_to_sheet([
      { Nome: 'Produto Exemplo', Código: 'REF-001', Quantidade: 10, Preço: '59,90', Lucro: 30, Categoria: 'Camisetas', Marca: 'BagSync', Tamanho: 'M', Cor: 'Azul', Descrição: 'Tecido 100% algodão' }
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    XLSX.writeFile(wb, "template_importacao_bagsync.xlsx");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Estoque de Produtos</h1>
          <p className="text-muted-foreground font-medium">Gerencie o inventário da loja.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setIsImportOpen(true)} className="gap-2">
            <Upload className="h-4 w-4" /> Importar
          </Button>
          <Button onClick={() => { resetForm(); setIsAddOpen(true); }} className="gap-2">
            <Plus className="h-4 w-4" /> Novo Produto
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Buscar por nome, código ou categoria..." 
            className="pl-9" 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Button variant="outline" size="icon">
          <Filter className="h-4 w-4" />
        </Button>
      </div>

      <div className="border rounded-xl bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-[80px]">Foto</TableHead>
              <TableHead>Produto</TableHead>
              <TableHead>Código</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead className="text-right">Estoque</TableHead>
              <TableHead className="text-right">Preço</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="h-32 text-center">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                </TableCell>
              </TableRow>
            ) : filteredProducts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-32 text-center text-muted-foreground font-medium">
                  Nenhum produto encontrado.
                </TableCell>
              </TableRow>
            ) : (
              filteredProducts.map((product) => (
                <TableRow key={product.id}>
                  <TableCell>
                    {product.image_url ? (
                      <img src={product.image_url} alt={product.name} className="h-10 w-10 rounded-md object-cover bg-muted" />
                    ) : (
                      <div className="h-10 w-10 rounded-md bg-muted flex items-center justify-center">
                        <ImageIcon className="h-5 w-5 text-muted-foreground" />
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="font-medium">{product.name}</TableCell>
                  <TableCell className="text-muted-foreground">{product.internal_code || '-'}</TableCell>
                  <TableCell>{product.category || '-'}</TableCell>
                  <TableCell className="text-right font-semibold">
                    <span className={product.quantity <= 3 ? 'text-destructive' : ''}>
                      {product.quantity}
                    </span>
                  </TableCell>
                  <TableCell className="text-right font-medium">R$ {product.unit_price.toFixed(2).replace('.', ',')}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleOpenEdit(product)}>
                          <Pencil className="h-4 w-4 mr-2" /> Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleDelete(product.id)} className="text-destructive focus:text-destructive">
                          <Trash2 className="h-4 w-4 mr-2" /> Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingProduct ? 'Editar Produto' : 'Novo Produto'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-6 pt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Foto do Produto</Label>
                  <div className="flex items-center gap-4">
                    <div className="h-24 w-24 rounded-lg border-2 border-dashed flex items-center justify-center bg-muted overflow-hidden relative group">
                      {photoPreview ? (
                        <img src={photoPreview} alt="Preview" className="h-full w-full object-cover" />
                      ) : (
                        <ImageIcon className="h-8 w-8 text-muted-foreground" />
                      )}
                      <input 
                        type="file" 
                        accept="image/*" 
                        className="absolute inset-0 opacity-0 cursor-pointer" 
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            setPhotoFile(file);
                            setPhotoPreview(URL.createObjectURL(file));
                          }
                        }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground italic">Toque no quadro ao lado para carregar uma imagem.</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Nome do Produto *</Label>
                  <Input 
                    value={form.name} 
                    onChange={(e) => setForm({...form, name: e.target.value})} 
                    placeholder="Ex: Camiseta Oversized" 
                    required 
                  />
                </div>

                <div className="space-y-2">
                  <Label>Código Interno</Label>
                  <Input 
                    value={form.internal_code} 
                    onChange={(e) => setForm({...form, internal_code: e.target.value})} 
                    placeholder="Ex: REF-001" 
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Categoria</Label>
                    <Input 
                      value={form.category} 
                      onChange={(e) => setForm({...form, category: e.target.value})} 
                      placeholder="Ex: Blusas" 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Marca</Label>
                    <Input 
                      value={form.brand} 
                      onChange={(e) => setForm({...form, brand: e.target.value})} 
                      placeholder="Ex: BagSync" 
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Preço Unitário (R$) *</Label>
                    <Input 
                      value={form.unit_price} 
                      onChange={(e) => setForm({...form, unit_price: e.target.value})} 
                      placeholder="0,00" 
                      required 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>% de Lucro</Label>
                    <Input 
                      type="number" 
                      value={form.profit_percent} 
                      onChange={(e) => setForm({...form, profit_percent: e.target.value})} 
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium text-foreground">Variações (tamanho · cor · estoque)</Label>
                    {!editingProduct && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setVariations([...variations, { id: crypto.randomUUID(), size: '', color: '', quantity: '1' }])}
                        className="h-7 gap-1 px-2 text-xs"
                      >
                        <Plus className="h-3 w-3" />
                        Variação
                      </Button>
                    )}
                  </div>
                  <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1">
                    {variations.map((v, i) => (
                      <div key={v.id} className="flex items-end gap-2 rounded-lg border bg-muted/30 p-2">
                        <div className="flex-1 space-y-1">
                          <Label className="text-[10px] uppercase text-muted-foreground">Tam.</Label>
                          <Input 
                            className="h-7 text-xs" 
                            placeholder="Ex: M"
                            value={v.size} 
                            onChange={(e) => {
                              const newVars = [...variations];
                              newVars[i].size = e.target.value;
                              setVariations(newVars);
                            }} 
                          />
                        </div>
                        <div className="flex-1 space-y-1">
                          <Label className="text-[10px] uppercase text-muted-foreground">Cor</Label>
                          <Input 
                            className="h-7 text-xs" 
                            placeholder="Ex: Preto"
                            value={v.color} 
                            onChange={(e) => {
                              const newVars = [...variations];
                              newVars[i].color = e.target.value;
                              setVariations(newVars);
                            }} 
                          />
                        </div>
                        <div className="w-16 space-y-1">
                          <Label className="text-[10px] uppercase text-muted-foreground">Qtd *</Label>
                          <Input 
                            className="h-7 text-xs px-2" 
                            type="number"
                            min="0"
                            required
                            value={v.quantity} 
                            onChange={(e) => {
                              const newVars = [...variations];
                              newVars[i].quantity = e.target.value;
                              setVariations(newVars);
                            }} 
                          />
                        </div>
                        {!editingProduct && variations.length > 1 && (
                          <Button 
                            type="button" 
                            variant="ghost" 
                            size="icon" 
                            className="h-7 w-7 shrink-0 text-destructive/70 hover:text-destructive"
                            onClick={() => {
                              setVariations(variations.filter(vari => vari.id !== v.id));
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Descrição</Label>
                  <Textarea 
                    value={form.description} 
                    onChange={(e) => setForm({...form, description: e.target.value})} 
                    rows={3}
                  />
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setIsAddOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={loading} className="min-w-[120px]">
                {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                {editingProduct ? 'Atualizar' : 'Criar Produto'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Import Dialog */}
      <Dialog open={isImportOpen} onOpenChange={setIsImportOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Importar do Excel</DialogTitle>
          </DialogHeader>
          <div className="py-6 space-y-6">
            <div className="rounded-lg border-2 border-dashed p-10 flex flex-col items-center justify-center text-center gap-3 relative">
              <Upload className="h-10 w-10 text-muted-foreground" />
              <div>
                <p className="font-medium">Clique para carregar ou arraste o arquivo</p>
                <p className="text-sm text-muted-foreground mt-1">Suporta .xlsx e .csv</p>
              </div>
              <input 
                type="file" 
                accept=".xlsx, .xls, .csv" 
                className="absolute inset-0 opacity-0 cursor-pointer" 
                onChange={handleImport}
                disabled={loading}
              />
            </div>

            <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
              <div className="flex items-center gap-2">
                <Download className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">Baixar modelo de planilha</span>
              </div>
              <Button variant="ghost" size="sm" onClick={exportTemplate}>Download</Button>
            </div>

            {loading && (
              <div className="flex items-center justify-center gap-2 py-4">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                <span className="text-sm font-medium">Processando dados...</span>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsImportOpen(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
