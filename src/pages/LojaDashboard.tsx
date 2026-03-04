import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { LogOut, Search, Plus, Loader2, Users } from 'lucide-react';
import type { Malinha } from '@/lib/types';

const statusColors: Record<string, string> = {
  'Enviada': 'bg-accent text-accent-foreground',
  'Em aberto': 'bg-primary/15 text-primary',
  'Pedido realizado': 'bg-secondary text-secondary-foreground',
  'Finalizada': 'bg-success text-success-foreground',
};

export default function LojaDashboard() {
  const navigate = useNavigate();
  const { profile, signOut } = useAuth();
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<'malinhas' | 'vendedoras'>('malinhas');

  // Fetch all malinhas visible to this loja (RLS handles filtering)
  const { data: malinhas = [], isLoading } = useQuery({
    queryKey: ['loja-malinhas'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('malinhas')
        .select('*, malinha_products(*)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data as unknown as Malinha[]) || [];
    },
  });

  const { data: vendedoras = [] } = useQuery({
    queryKey: ['loja-vendedoras'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vendedoras')
        .select('*, profiles:user_id(full_name, email)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const filtered = malinhas.filter((m) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return m.client_name.toLowerCase().includes(q) || m.client_phone.includes(q);
  });

  const formatDate = (d: string) => new Date(d).toLocaleDateString('pt-BR');

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b bg-card/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-4">
          <div>
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Loja</p>
            <h1 className="font-display text-xl font-semibold text-foreground">
              Olá, {profile?.full_name || 'Loja'}
            </h1>
          </div>
          <Button variant="ghost" size="icon" onClick={signOut}>
            <LogOut className="h-5 w-5" />
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 pb-24 pt-4">
        <div className="flex gap-2 mb-4">
          <Button variant={tab === 'malinhas' ? 'default' : 'outline'} size="sm" onClick={() => setTab('malinhas')}>
            Malinhas
          </Button>
          <Button variant={tab === 'vendedoras' ? 'default' : 'outline'} size="sm" onClick={() => setTab('vendedoras')}>
            <Users className="h-4 w-4 mr-1" /> Vendedoras
          </Button>
        </div>

        {tab === 'malinhas' && (
          <>
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome ou telefone..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>

            {isLoading ? (
              <div className="flex justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : filtered.length === 0 ? (
              <p className="text-center text-muted-foreground py-20">Nenhuma malinha encontrada.</p>
            ) : (
              <div className="space-y-3">
                {filtered.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => navigate(`/malinha/${m.id}/resumo`)}
                    className="w-full rounded-xl border bg-card p-4 text-left transition-all hover:shadow-md active:scale-[0.98]"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-medium text-foreground truncate">{m.client_name}</p>
                        <p className="text-xs text-muted-foreground">Vendedora: {m.seller_name}</p>
                        <p className="text-sm text-muted-foreground mt-0.5">
                          {formatDate(m.created_at)} · {m.malinha_products?.length || 0} peças
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
          </>
        )}

        {tab === 'vendedoras' && (
          <div className="space-y-3">
            {vendedoras.length === 0 ? (
              <p className="text-center text-muted-foreground py-20">Nenhuma vendedora cadastrada.</p>
            ) : (
              vendedoras.map((v: any) => (
                <div key={v.id} className="rounded-xl border bg-card p-4">
                  <p className="font-medium text-foreground">{(v as any).profiles?.full_name || 'Sem nome'}</p>
                  <p className="text-sm text-muted-foreground">{(v as any).profiles?.email || ''}</p>
                </div>
              ))
            )}
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
