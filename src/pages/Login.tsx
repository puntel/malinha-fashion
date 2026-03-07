import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import logo from '@/assets/logo.png';
import { toast } from 'sonner';

export default function Login() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: window.location.origin,
      },
    });
    if (error) {
      toast.error('Erro ao enviar link de acesso. Tente novamente.');
    } else {
      setSent(true);
      toast.success('Link de acesso enviado! Verifique seu e-mail.');
    }
    setLoading(false);
  };

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
