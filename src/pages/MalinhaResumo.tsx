import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Copy, Check, MessageCircle, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { getMalinhaById } from '@/lib/mock-data';
import { toast } from 'sonner';

const statusColors: Record<string, string> = {
  'Enviada': 'bg-accent text-accent-foreground',
  'Aguardando Retorno': 'bg-secondary text-secondary-foreground',
  'Finalizada': 'bg-success text-success-foreground',
};

export default function MalinhaResumo() {
  const { id } = useParams();
  const navigate = useNavigate();
  const malinha = getMalinhaById(id || '');
  const [copied, setCopied] = useState(false);

  if (!malinha) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Malinha não encontrada.</p>
      </div>
    );
  }

  const link = `${window.location.origin}/malinha/${malinha.id}`;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(link);
    setCopied(true);
    toast.success('Link copiado!');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleWhatsApp = () => {
    const msg = encodeURIComponent(`Olá ${malinha.clientName}! 🛍️\n\nSua malinha está pronta! Confira as peças que separei para você:\n${link}`);
    const phone = malinha.clientPhone.replace(/\D/g, '');
    window.open(`https://wa.me/55${phone}?text=${msg}`, '_blank');
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
            <h1 className="font-display text-lg font-semibold">Malinha de {malinha.clientName.split(' ')[0]}</h1>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-lg px-4 py-6 space-y-6">
        {/* Summary card */}
        <div className="rounded-xl border bg-card p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-base font-medium">{malinha.clientName}</h2>
            <Badge className={statusColors[malinha.status]}>{malinha.status}</Badge>
          </div>
          <div className="text-sm text-muted-foreground space-y-1">
            <p>📱 {malinha.clientPhone}</p>
            <p>📋 {malinha.clientCpf}</p>
            <p>📦 {malinha.products.length} {malinha.products.length === 1 ? 'peça' : 'peças'}</p>
          </div>
        </div>

        {/* Products */}
        <div>
          <h3 className="font-display text-sm font-medium mb-3">Peças</h3>
          <div className="space-y-2">
            {malinha.products.map(p => (
              <div key={p.id} className="flex items-center gap-3 rounded-lg border bg-card p-3">
                <img src={p.photoUrl} alt={p.code} className="h-12 w-12 rounded-md object-cover bg-muted" />
                <div>
                  <p className="text-sm font-medium">{p.code}</p>
                  <p className="text-xs text-muted-foreground">Tam: {p.size} · Qtd: {p.quantity}</p>
                </div>
                {p.status === 'accepted' && <Badge className="ml-auto bg-success text-success-foreground text-xs">Aceita</Badge>}
                {p.status === 'rejected' && <Badge className="ml-auto bg-destructive text-destructive-foreground text-xs">Recusada</Badge>}
                {p.status === 'edited' && <Badge className="ml-auto bg-accent text-accent-foreground text-xs">Editada</Badge>}
              </div>
            ))}
          </div>
        </div>

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
