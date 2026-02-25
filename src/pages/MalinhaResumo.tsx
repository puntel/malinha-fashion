import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Copy, Check, MessageCircle, Share2, CheckCircle2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchMalinhaById, updateMalinhaStatus } from '@/lib/api';
import { toast } from 'sonner';

const statusColors: Record<string, string> = {
  'Enviada': 'bg-accent text-accent-foreground',
  'Em aberto': 'bg-primary/15 text-primary',
  'Pedido realizado': 'bg-secondary text-secondary-foreground',
  'Finalizada': 'bg-success text-success-foreground',
};

export default function MalinhaResumo() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [copied, setCopied] = useState(false);
  const [sellerNote, setSellerNote] = useState('');
  const [finalizing, setFinalizing] = useState(false);

  const { data: malinha, isLoading } = useQuery({
    queryKey: ['malinha', id],
    queryFn: () => fetchMalinhaById(id || ''),
    enabled: !!id,
  });

  // Sync sellerNote when data loads
  useState(() => {
    if (malinha?.seller_note && !sellerNote) setSellerNote(malinha.seller_note);
  });

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!malinha) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Malinha não encontrada.</p>
      </div>
    );
  }

  const products = malinha.malinha_products || [];
  const link = `${window.location.origin}/malinha/${malinha.id}`;

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

  const handleFinalize = async () => {
    setFinalizing(true);
    try {
      await updateMalinhaStatus(malinha.id, 'Finalizada', sellerNote);
      queryClient.invalidateQueries({ queryKey: ['malinha', id] });
      queryClient.invalidateQueries({ queryKey: ['malinhas'] });
      toast.success('Malinha finalizada!');
    } catch (err) {
      console.error(err);
    } finally {
      setFinalizing(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b bg-card/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-lg items-center gap-3 px-4 py-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')}>
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
            <Badge className={statusColors[malinha.status]}>{malinha.status}</Badge>
          </div>
          <div className="text-sm text-muted-foreground space-y-1">
            <p>📱 {malinha.client_phone}</p>
            <p>📋 {malinha.client_cpf}</p>
            <p>📦 {products.length} {products.length === 1 ? 'peça' : 'peças'}</p>
            <p className="text-foreground font-medium">💰 Total: R$ {products.reduce((sum, p) => sum + Number(p.price) * p.quantity, 0).toFixed(2).replace('.', ',')}</p>
          </div>
        </div>

        {/* Products */}
        <div>
          <h3 className="font-display text-sm font-medium mb-3">Peças</h3>
          <div className="space-y-2">
            {products.map(p => (
              <div key={p.id} className="flex items-center gap-3 rounded-lg border bg-card p-3">
                <img src={p.photo_url} alt={p.code} className="h-12 w-12 rounded-md object-cover bg-muted" />
                <div>
                  <p className="text-sm font-medium">{p.code}</p>
                  <p className="text-xs text-muted-foreground">Tam: {p.size} · Qtd: {p.quantity} · R$ {Number(p.price).toFixed(2).replace('.', ',')}</p>
                </div>
                {p.status === 'accepted' && <Badge className="ml-auto bg-success text-success-foreground text-xs">Aceita</Badge>}
                {p.status === 'rejected' && <Badge className="ml-auto bg-destructive text-destructive-foreground text-xs">Recusada</Badge>}
                {p.status === 'edited' && <Badge className="ml-auto bg-accent text-accent-foreground text-xs">Editada</Badge>}
              </div>
            ))}
          </div>
        </div>

        {/* Seller observation */}
        {(malinha.status === 'Pedido realizado' || malinha.status === 'Finalizada') && (
          <div className="rounded-xl border bg-card p-5 space-y-3">
            <h3 className="font-display text-sm font-medium">Observações da Vendedora</h3>
            <Textarea
              placeholder="Ex: Fechou 3 peças, pagamento no cartão 2x. Devolver 2 peças na sexta."
              value={sellerNote}
              onChange={e => setSellerNote(e.target.value)}
              rows={3}
              className="text-sm"
              disabled={malinha.status === 'Finalizada'}
            />
            {malinha.status === 'Pedido realizado' && (
              <Button onClick={handleFinalize} className="w-full gap-2" variant="default" size="lg" disabled={finalizing}>
                {finalizing && <Loader2 className="h-4 w-4 animate-spin" />}
                <CheckCircle2 className="h-5 w-5" />
                Finalizar Malinha
              </Button>
            )}
          </div>
        )}

        {/* Share section */}
        <div className="rounded-xl border bg-card p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Share2 className="h-4 w-4 text-primary" />
            <h3 className="font-display text-sm font-medium">Compartilhar com a cliente</h3>
          </div>
          <div className="flex gap-2">
            <Input value={link} readOnly className="text-xs" />
            <Button variant="secondary" size="icon" onClick={handleCopy}>
              {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
          <Button onClick={handleWhatsApp} className="w-full gap-2" variant="default" size="lg">
            <MessageCircle className="h-5 w-5" />
            Enviar por WhatsApp
          </Button>
        </div>
      </main>
    </div>
  );
}
