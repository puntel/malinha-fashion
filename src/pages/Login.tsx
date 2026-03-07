import { useState, useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import logo from '@/assets/logo.png';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';

export default function Login() {
  const { user, loading: authLoading } = useAuth();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    const hash = window.location.hash;
    if (hash.includes("error=access_denied") || hash.includes("error_code=otp_expired")) {
      toast.error("O link de acesso expirou ou é inválido. Solicite um novo link.");
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, [location]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/dashboard`,
        shouldCreateUser: false,
      },
    });

    if (error) {
      const message = error.message?.toLowerCase() ?? '';
      if (message.includes('security purposes') || message.includes('rate limit')) {
        toast.error('Muitas tentativas. Aguarde alguns segundos e tente novamente.');
      } else if (message.includes('user not found') || message.includes('invalid login')) {
        toast.error('E-mail não cadastrado. Entre em contato com o administrador.');
      } else {
        toast.error('Erro ao enviar link de acesso. Tente novamente.');
      }
    } else {
      setSent(true);
      toast.success('Link de acesso enviado! Verifique seu e-mail.');
    }

    setLoading(false);
  };

  if (!authLoading && user) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6">
      <img src={logo} alt="Malinha Store" className="h-20 w-20 mb-4 object-contain" />
      <h1 className="font-display text-2xl font-bold text-foreground mb-1">Malinha Store</h1>
      <p className="text-muted-foreground text-sm mb-8">
        {sent ? 'Verifique seu e-mail para acessar' : 'Digite seu e-mail para entrar'}
      </p>

      {sent ? (
        <div className="w-full max-w-sm text-center space-y-4">
          <p className="text-sm text-muted-foreground">
            Enviamos um link de acesso para <strong>{email}</strong>. Clique no link no e-mail para entrar.
          </p>
          <Button variant="outline" className="w-full" onClick={() => setSent(false)}>
            Enviar novamente
          </Button>
        </div>
      ) : (
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
            {loading ? 'Enviando...' : 'Enviar link de acesso'}
          </Button>
        </form>
      )}
    </div>
  );
}
