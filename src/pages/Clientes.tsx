import { useAuth } from '@/hooks/useAuth';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import ClientesTab from '@/components/ClientesTab';
import { Loader2 } from 'lucide-react';

export default function Clientes() {
  const { user, role } = useAuth();

  const { data: userData, isLoading: isLoadingUserData } = useQuery({
    queryKey: ['user-data-clientes', user?.id],
    queryFn: async () => {
      if (!user) return null;
      
      let lojaId = null;
      let vendedoraId = null;
      let availableVendedoras: any[] = [];

      if (role === 'loja') {
        const { data: memberData } = await supabase.from('loja_members').select('loja_id').single();
        lojaId = memberData?.loja_id;
        
        const { data: vendedorasData } = await supabase.from('vendedoras').select('*').eq('loja_id', lojaId).is('archived', false);
        const vendedoraUserIds = vendedorasData?.map(v => v.user_id) || [];
        
        if (vendedoraUserIds.length > 0) {
          const { data: profiles } = await supabase.from('profiles').select('user_id, full_name, email').in('user_id', vendedoraUserIds);
          availableVendedoras = vendedorasData?.map(v => {
            const p = profiles?.find(p => p.user_id === v.user_id);
            return { user_id: v.user_id, name: p?.full_name || p?.email || 'Vendedora', loja_id: v.loja_id };
          }) || [];
        }
      } else if (role === 'vendedora') {
        const { data: vData } = await supabase.from('vendedoras').select('id, loja_id').eq('user_id', user.id).single();
        vendedoraId = user.id; // ClientesTab uses user_id for vendedoraId filtering
        lojaId = vData?.loja_id;
      } else if (role === 'master') {
        const { data: vendedorasData } = await supabase.from('vendedoras').select('*').is('archived', false);
        const vendedoraUserIds = vendedorasData?.map(v => v.user_id) || [];
        
        if (vendedoraUserIds.length > 0) {
          const { data: profiles } = await supabase.from('profiles').select('user_id, full_name, email').in('user_id', vendedoraUserIds);
          availableVendedoras = vendedorasData?.map(v => {
            const p = profiles?.find(p => p.user_id === v.user_id);
            return { user_id: v.user_id, name: p?.full_name || p?.email || 'Vendedora', loja_id: v.loja_id };
          }) || [];
        }
      }

      return { lojaId, vendedoraId, availableVendedoras };
    },
    enabled: !!user
  });

  if (isLoadingUserData) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Clientes</h1>
        <p className="text-muted-foreground font-medium">Gerencie sua base de clientes e contatos.</p>
      </div>
      
      <ClientesTab 
        role={role as any}
        filterLojaId={userData?.lojaId}
        filterVendedoraId={role === 'vendedora' ? userData?.vendedoraId : undefined}
        defaultLojaId={userData?.lojaId}
        defaultVendedoraId={role === 'vendedora' ? userData?.vendedoraId : undefined}
        availableVendedoras={userData?.availableVendedoras}
        canCreate={true}
      />
    </div>
  );
}
