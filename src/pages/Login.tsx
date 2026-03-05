import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import logo from '@/assets/logo.png';
import { toast } from 'sonner';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<'login' | 'forgot'>('login');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      toast.error('Credenciais inválidas. Verifique seu e-mail e senha.');
    }
    setLoading(false);
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) {
      toast.error('Erro ao enviar e-mail de recuperação.');
    } else {
      toast.success('E-mail de recuperação enviado! Verifique sua caixa de entrada.');
    }
    setLoading(false);
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6">
      <img src={logo} alt="Malinha Store" className="h-20 w-20 mb-4 object-contain" />
      <h1 className="font-display text-2xl font-bold text-foreground mb-1">Malinha Store</h1>
      <p className="text-muted-foreground text-sm mb-8">
        {mode === 'login' ? 'Faça login para continuar' : 'Recupere sua senha'}
      </p>

      {mode === 'login' ? (
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
          <div className="space-y-2">
            <Label htmlFor="password">Senha</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Entrando...' : 'Entrar'}
          </Button>
          <button
            type="button"
            onClick={() => setMode('forgot')}
            className="w-full text-sm text-primary hover:underline mt-2"
          >
            Esqueci minha senha
          </button>
        </form>
      ) : (
        <form onSubmit={handleForgotPassword} className="w-full max-w-sm space-y-4">
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
            {loading ? 'Enviando...' : 'Enviar link de recuperação'}
          </Button>
          <button
            type="button"
            onClick={() => setMode('login')}
            className="w-full text-sm text-primary hover:underline mt-2"
          >
            Voltar ao login
          </button>
        </form>
      )}
    </div>
  );
}
