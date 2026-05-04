import { useState, useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import logo from '@/assets/logo.png';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { Loader2, Eye, EyeOff, Mail, Lock, ArrowLeft, User, Building } from 'lucide-react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';

// Inicializa o Stripe (Configure VITE_STRIPE_PUBLISHABLE_KEY no .env)
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || 'pk_test_TYooMQauvdEDq54NiTphI7jx');

function CheckoutForm({ regForm, onSuccess }: { regForm: any, onSuccess: () => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) return;

    setIsProcessing(true);

    const { error: submitError } = await elements.submit();
    if (submitError) {
      toast.error(submitError.message);
      setIsProcessing(false);
      return;
    }

    // Tenta confirmar o pagamento via Stripe
    const { error: paymentError, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        payment_method_data: {
          billing_details: {
            name: regForm.owner_name,
            email: regForm.owner_email,
          }
        }
      },
      redirect: "if_required",
    });

    if (paymentError) {
      toast.error(paymentError.message || "Falha no pagamento");
      setIsProcessing(false);
      return;
    }

    if (paymentIntent && paymentIntent.status === 'succeeded') {
      // Sucesso no pagamento! Agora criamos a loja no banco.
      try {
        const res = await supabase.functions.invoke('manage-users', { 
          body: { action: 'create_loja', ...regForm } 
        });

        if (res.error) throw new Error(res.error.message);
        if (res.data?.error) throw new Error(res.data.error);

        const tempPassword = res.data?.temporary_password || 'A1b2c3';
        toast.success(`Loja criada com sucesso! Senha temporária enviada para o e-mail: ${tempPassword}`);
        onSuccess();
      } catch (err: any) {
        toast.error(`Pagamento aprovado, mas erro ao criar loja: ${err.message}. Contate o suporte.`);
      }
    }

    setIsProcessing(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="bg-card p-5 rounded-2xl shadow-sm border border-border mt-6">
        <h3 className="font-semibold text-xs text-primary uppercase tracking-wider mb-4">Pagamento Seguro (R$ 99,90)</h3>
        <PaymentElement />
      </div>

      <Button 
        type="submit" 
        disabled={!stripe || isProcessing}
        className="w-full h-14 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold tracking-widest shadow-md transition-all text-base mt-2 uppercase"
      >
        {isProcessing ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : 'Cadastrar e Assinar'}
      </Button>
    </form>
  );
}

function RegisterView({ goBack }: { goBack: () => void }) {
  const [clientSecret, setClientSecret] = useState("");
  const [paymentError, setPaymentError] = useState("");
  const [regForm, setRegForm] = useState({
    loja_name: '',
    loja_phone: '',
    loja_cnpj: '',
    owner_name: '',
    owner_email: '',
  });

  useEffect(() => {
    // Cria um PaymentIntent assim que a tela de cadastro é aberta
    supabase.functions.invoke('create-payment-intent', {
      body: { email: 'nova_loja@exemplo.com', name: 'Nova Loja' }
    }).then(({ data, error }) => {
      if (error) {
        console.error("Erro ao invocar edge function:", error);
        setPaymentError(error.message || "Erro na conexão com o servidor.");
        toast.error("Erro na conexão com o sistema de pagamentos.");
      } else if (data?.error) {
        console.error("Erro do Stripe:", data.error);
        setPaymentError(data.error);
        toast.error("Erro do Stripe: " + data.error);
      } else if (data?.clientSecret) {
        setClientSecret(data.clientSecret);
      } else {
        setPaymentError("Resposta inválida do servidor.");
      }
    }).catch(err => {
      console.error("Erro de rede:", err);
      setPaymentError(err.message || "Falha de rede.");
    });
  }, []);

  return (
    <div className="w-full animate-in fade-in slide-in-from-right-4 duration-500 pb-10">
      <div className="flex items-center mb-6 relative justify-center">
        <Button variant="ghost" size="icon" onClick={goBack} className="absolute left-0 text-primary hover:bg-transparent">
          <ArrowLeft className="h-6 w-6" />
        </Button>
        <h2 className="text-xl font-bold text-primary">Criar Conta</h2>
      </div>

      <div className="space-y-6">
        <div className="space-y-3 bg-card p-5 rounded-2xl shadow-sm border border-border">
          <h3 className="font-semibold text-xs text-primary uppercase tracking-wider flex items-center gap-2"><Building className="w-4 h-4"/> Dados da Loja</h3>
          <Input value={regForm.loja_name} onChange={e => setRegForm(f => ({ ...f, loja_name: e.target.value }))} placeholder="Nome da Loja *" required className="bg-background border-border rounded-lg h-11" />
          <Input value={regForm.loja_cnpj} onChange={e => setRegForm(f => ({ ...f, loja_cnpj: e.target.value }))} placeholder="CNPJ ou CPF *" required className="bg-background border-border rounded-lg h-11" />
          <Input value={regForm.loja_phone} onChange={e => setRegForm(f => ({ ...f, loja_phone: e.target.value }))} placeholder="Telefone *" required className="bg-background border-border rounded-lg h-11" />
        </div>

        <div className="space-y-3 bg-card p-5 rounded-2xl shadow-sm border border-border">
          <h3 className="font-semibold text-xs text-primary uppercase tracking-wider flex items-center gap-2"><User className="w-4 h-4"/> Dados do Proprietário</h3>
          <Input value={regForm.owner_name} onChange={e => setRegForm(f => ({ ...f, owner_name: e.target.value }))} placeholder="Nome Completo *" required className="bg-background border-border rounded-lg h-11" />
          <Input type="email" value={regForm.owner_email} onChange={e => setRegForm(f => ({ ...f, owner_email: e.target.value }))} placeholder="E-mail Corporativo *" required className="bg-background border-border rounded-lg h-11" />
        </div>

        {clientSecret ? (
          <Elements stripe={stripePromise} options={{ clientSecret, appearance: { theme: 'stripe' } }}>
            <CheckoutForm regForm={regForm} onSuccess={goBack} />
          </Elements>
        ) : paymentError ? (
          <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-6 text-center mt-6">
            <h3 className="font-semibold text-destructive mb-2">Conexão Indisponível</h3>
            <p className="text-sm text-destructive/80 mb-4">{paymentError}</p>
            <Button variant="outline" size="sm" onClick={() => window.location.reload()} className="border-destructive/30 text-destructive hover:bg-destructive/10">Tentar Novamente</Button>
          </div>
        ) : (
          <div className="flex justify-center py-6 text-muted-foreground mt-6">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span className="ml-2 text-sm">Carregando módulo de pagamento...</span>
          </div>
        )}
      </div>
    </div>
  );
}

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
        toast.error('Erro ao autenticar. Tente novamente.');
      } else {
        toast.success('Login realizado com sucesso!');
      }
    } catch (err) {
      toast.error('Erro inesperado. Tente novamente.');
    }

    setLoading(false);
  };

  if (!authLoading && user) {
    return <Navigate to="/relatorios" replace />;
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6 py-12">
      <div className="w-full max-w-sm flex flex-col items-center">
        
        <img src={logo} alt="Logo" className="h-24 w-24 mb-4 object-contain" />
        <h1 className="font-display text-3xl font-bold text-primary mb-8">BagSync</h1>

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
                  className="pl-12 h-12 bg-secondary/30 border-0 shadow-sm rounded-full text-center font-medium"
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
                  className="pl-12 pr-12 h-12 bg-secondary/30 border-0 shadow-sm rounded-full text-center font-medium"
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
                <button type="button" className="text-[10px] font-bold text-primary uppercase tracking-wider">
                  Esqueci minha senha
                </button>
              </div>

              <div className="flex items-center justify-center space-x-2 pb-2">
                <Checkbox 
                  id="terms" 
                  checked={termsAccepted} 
                  onCheckedChange={(checked) => setTermsAccepted(checked as boolean)}
                  className="border-primary h-4 w-4 rounded-sm data-[state=checked]:bg-primary"
                />
                <label
                  htmlFor="terms"
                  className="text-[10px] uppercase font-semibold leading-none text-muted-foreground"
                >
                  Estou de acordo com os <span className="font-bold text-primary">Termos de uso</span>
                </label>
              </div>

              <div className="space-y-3">
                <Button 
                  type="submit" 
                  className="w-full h-12 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-sm tracking-widest shadow-md transition-all uppercase" 
                  disabled={loading}
                >
                  {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Entrar'}
                </Button>
                
                <Button 
                  type="button"
                  variant="outline"
                  onClick={() => setIsLoginMode(false)}
                  className="w-full h-12 rounded-full border-primary text-primary hover:bg-primary/5 font-bold text-sm tracking-widest shadow-sm transition-all uppercase"
                >
                  Criar Conta
                </Button>
              </div>
            </form>
          </div>
        ) : (
          // --- REGISTER VIEW ---
          <RegisterView goBack={() => setIsLoginMode(true)} />
        )}
      </div>
    </div>
  );
}
