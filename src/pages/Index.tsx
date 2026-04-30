import { useState, useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import logo from '@/assets/logo.png';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { Loader2, Eye, EyeOff, Mail, Lock, ArrowLeft, CreditCard, User, Building } from 'lucide-react';

export default function Index() {
  const { user, loading: authLoading } = useAuth();
  const location = useLocation();
  const [isLoginMode, setIsLoginMode] = useState(true);
  
  // Login State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);

  // Register State
  const [regForm, setRegForm] = useState({
    loja_name: '',
    loja_phone: '',
    loja_cnpj: '',
    owner_name: '',
    owner_email: '',
  });

  useEffect(() => {
    const hash = window.location.hash;
    if (hash.includes("error=access_denied") || hash.includes("error_code=otp_expired")) {
      toast.error("Erro de autenticação. Tente novamente.");
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, [location]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!termsAccepted) {
      toast.error('Você precisa aceitar os Termos de Uso para entrar.');
      return;
    }
    
    setLoading(true);

    try {
      // Usando a edge function atual que autentica pelo e-mail
      // A senha está na interface apenas como layout conforme solicitado, ou pode ser usada futuramente
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

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    // Apenas layout no momento
    toast.info("Funcionalidade de cadastro e pagamento em desenvolvimento.");
  };

  if (!authLoading && user) {
    return <Navigate to="/relatorios" replace />;
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#F4F7F4] px-6 py-12">
      <div className="w-full max-w-sm flex flex-col items-center">
        
        <img src={logo} alt="Logo" className="h-24 w-24 mb-4 object-contain" />
        <h1 className="font-display text-3xl font-bold text-foreground mb-8 text-[#2F6B43]">BagSync</h1>

        {isLoginMode ? (
          // --- LOGIN VIEW ---
          <div className="w-full space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none text-muted-foreground">
                  <Mail className="h-5 w-5 opacity-50" />
                </div>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email"
                  className="pl-12 h-12 bg-[#EAEFEA] border-0 shadow-sm rounded-full text-center font-medium"
                  required
                />
              </div>

              <div className="relative">
                <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none text-muted-foreground">
                  <Lock className="h-5 w-5 opacity-50" />
                </div>
                <Input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Senha"
                  className="pl-12 pr-12 h-12 bg-[#EAEFEA] border-0 shadow-sm rounded-full text-center font-medium"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 flex items-center pr-4 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-5 w-5 opacity-50" /> : <Eye className="h-5 w-5 opacity-50" />}
                </button>
              </div>

              <div className="text-center pt-1 pb-1">
                <button type="button" className="text-[10px] font-bold text-[#2F6B43] uppercase tracking-wider">
                  Esqueci minha senha
                </button>
              </div>

              <div className="flex items-center justify-center space-x-2 pb-2">
                <Checkbox 
                  id="terms" 
                  checked={termsAccepted} 
                  onCheckedChange={(checked) => setTermsAccepted(checked as boolean)}
                  className="border-[#2F6B43] h-4 w-4 rounded-sm data-[state=checked]:bg-[#2F6B43]"
                />
                <label
                  htmlFor="terms"
                  className="text-[10px] uppercase font-semibold leading-none text-muted-foreground"
                >
                  Estou de acordo com os <span className="font-bold text-[#2F6B43]">Termos de uso</span>
                </label>
              </div>

              <div className="space-y-3">
                <Button 
                  type="submit" 
                  className="w-full h-12 rounded-full bg-[#40825B] hover:bg-[#2F6B43] text-white font-bold text-sm tracking-widest shadow-md transition-all uppercase" 
                  disabled={loading}
                >
                  {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Entrar'}
                </Button>
                
                <Button 
                  type="button"
                  onClick={() => setIsLoginMode(false)}
                  className="w-full h-12 rounded-full bg-[#40825B] hover:bg-[#2F6B43] text-white font-bold text-sm tracking-widest shadow-md transition-all uppercase"
                >
                  Criar Conta
                </Button>
              </div>
            </form>
          </div>
        ) : (
          // --- REGISTER VIEW ---
          <div className="w-full animate-in fade-in slide-in-from-right-4 duration-500 pb-10">
            <div className="flex items-center mb-6 relative justify-center">
              <Button variant="ghost" size="icon" onClick={() => setIsLoginMode(true)} className="absolute left-0 text-[#2F6B43] hover:bg-transparent">
                <ArrowLeft className="h-6 w-6" />
              </Button>
              <h2 className="text-xl font-bold text-[#2F6B43]">Criar Conta</h2>
            </div>

            <form onSubmit={handleRegister} className="space-y-6">
              
              <div className="space-y-3 bg-white/60 p-5 rounded-2xl shadow-sm border border-[#EAEFEA]">
                <h3 className="font-semibold text-xs text-[#2F6B43] uppercase tracking-wider flex items-center gap-2"><Building className="w-4 h-4"/> Dados da Loja</h3>
                <Input value={regForm.loja_name} onChange={e => setRegForm(f => ({ ...f, loja_name: e.target.value }))} placeholder="Nome da Loja *" required className="bg-white border-0 rounded-lg shadow-sm h-11" />
                <Input value={regForm.loja_cnpj} onChange={e => setRegForm(f => ({ ...f, loja_cnpj: e.target.value }))} placeholder="CNPJ ou CPF *" required className="bg-white border-0 rounded-lg shadow-sm h-11" />
                <Input value={regForm.loja_phone} onChange={e => setRegForm(f => ({ ...f, loja_phone: e.target.value }))} placeholder="Telefone *" required className="bg-white border-0 rounded-lg shadow-sm h-11" />
              </div>

              <div className="space-y-3 bg-white/60 p-5 rounded-2xl shadow-sm border border-[#EAEFEA]">
                <h3 className="font-semibold text-xs text-[#2F6B43] uppercase tracking-wider flex items-center gap-2"><User className="w-4 h-4"/> Dados do Proprietário</h3>
                <Input value={regForm.owner_name} onChange={e => setRegForm(f => ({ ...f, owner_name: e.target.value }))} placeholder="Nome Completo *" required className="bg-white border-0 rounded-lg shadow-sm h-11" />
                <Input type="email" value={regForm.owner_email} onChange={e => setRegForm(f => ({ ...f, owner_email: e.target.value }))} placeholder="E-mail Corporativo *" required className="bg-white border-0 rounded-lg shadow-sm h-11" />
              </div>

              <div className="space-y-3 bg-white/60 p-5 rounded-2xl shadow-sm border border-[#EAEFEA]">
                <h3 className="font-semibold text-xs text-[#2F6B43] uppercase tracking-wider flex items-center gap-2"><CreditCard className="w-4 h-4"/> Pagamento</h3>
                <Input placeholder="Número do Cartão" className="bg-white border-0 rounded-lg shadow-sm h-11" />
                <div className="grid grid-cols-2 gap-3">
                  <Input placeholder="Validade (MM/AA)" className="bg-white border-0 rounded-lg shadow-sm h-11" />
                  <Input placeholder="CVV" className="bg-white border-0 rounded-lg shadow-sm h-11" />
                </div>
                <Input placeholder="Nome impresso no cartão" className="bg-white border-0 rounded-lg shadow-sm h-11" />
              </div>

              <Button 
                type="submit" 
                className="w-full h-14 rounded-full bg-[#40825B] hover:bg-[#2F6B43] text-white font-bold tracking-widest shadow-md transition-all text-base mt-2 uppercase"
              >
                Cadastrar
              </Button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
