import { useState, useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { Loader2 } from 'lucide-react';

export default function Login() {
  const { user, loading: authLoading } = useAuth();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const hash = window.location.hash;
    if (hash.includes("error=access_denied") || hash.includes("error_code=otp_expired")) {
      toast.error("Erro de autenticação. Tente novamente.");
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, [location]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('login-by-email', {
        body: { email: email.trim() },
      });

      if (fnError) {
        toast.error('Erro ao conectar ao servidor. Tente novamente.');
        setLoading(false);
        return;
      }

      if (data?.error) {
        toast.error(data.error);
        setLoading(false);
        return;
      }

      // Set the session returned by the edge function
      const { error: sessionError } = await supabase.auth.setSession({
        access_token: data.access_token,
        refresh_token: data.refresh_token,
      });

      if (sessionError) {
        console.error('Session error:', sessionError);
        toast.error('Erro ao autenticar. Tente novamente.');
      } else {
        toast.success('Login realizado com sucesso!');
      }
    } catch (err) {
      console.error('Login error:', err);
      toast.error('Erro inesperado. Tente novamente.');
    }

    setLoading(false);
  };

  if (!authLoading && user) {
    return <Navigate to="/relatorios" replace />;
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6">

      <h1 className="font-display text-2xl font-bold text-foreground mb-1">BagSync</h1>
      <p className="text-muted-foreground text-sm mb-8">
        Digite seu e-mail para entrar
      </p>

      <form onSubmit={handleLogin} className="w-full max-w-sm space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">E-mail</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="seu@email.com"
            required
          />
        </div>
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Entrando...
            </>
          ) : (
            'Entrar'
          )}
        </Button>
      </form>
    </div>
  );
}
