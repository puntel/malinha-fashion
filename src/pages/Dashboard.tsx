import { useNavigate } from 'react-router-dom';
import { Plus, LogOut, Package, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import type { Malinha } from '@/lib/types';

const statusColors: Record<string, string> = {
  'Enviada': 'bg-accent text-accent-foreground',
  'Em aberto': 'bg-primary/15 text-primary',
  'Pedido realizado': 'bg-secondary text-secondary-foreground',
  'Finalizada': 'bg-success text-success-foreground',
};

export default function Dashboard() {
  const navigate = useNavigate();
  const { profile, signOut, user } = useAuth();

  const { data: malinhas = [], isLoading } = useQuery({
    queryKey: ['vendedora-malinhas', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('malinhas')
        .select('*, malinha_products(*)')
        .eq('vendedora_id', user!.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data as unknown as Malinha[]) || [];
    },
    enabled: !!user,
  });

  const formatDate = (dateStr: string) => new Date(dateStr).toLocaleDateString('pt-BR');

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b bg-card/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-lg items-center justify-between px-4 py-4">
          <div>
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Vendedora</p>
            <h1 className="font-display text-xl font-semibold text-foreground">
              Olá, {profile?.full_name || 'Vendedora'}
            </h1>
          </div>
          <Button variant="ghost" size="icon" onClick={signOut}>
            <LogOut className="h-5 w-5" />
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-lg px-4 pb-24 pt-6">
        <h2 className="font-display text-lg font-medium text-foreground mb-4">Minhas Malinhas</h2>

        {isLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : malinhas.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Package className="h-12 w-12 text-muted-foreground/40 mb-4" />
            <p className="text-muted-foreground">Nenhuma malinha criada ainda.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {malinhas.map((m: Malinha) => (
              <button
                key={m.id}
                onClick={() => navigate(`/malinha/${m.id}/resumo`)}
                className="w-full rounded-xl border bg-card p-4 text-left transition-all hover:shadow-md active:scale-[0.98]"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium text-foreground truncate">{m.client_name}</p>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {formatDate(m.created_at)} · {m.malinha_products?.length || 0} {(m.malinha_products?.length || 0) === 1 ? 'peça' : 'peças'}
                    </p>
                  </div>
                  <Badge className={`shrink-0 text-xs font-medium ${statusColors[m.status]}`}>
                    {m.status}
                  </Badge>
                </div>
              </button>
            ))}
          </div>
        )}
      </main>

      <div className="fixed bottom-6 left-0 right-0 flex justify-center">
        <Button onClick={() => navigate('/nova-malinha')} size="lg" className="rounded-full shadow-lg px-6 gap-2">
          <Plus className="h-5 w-5" /> Nova Malinha
        </Button>
      </div>
    </div>
  );
}
