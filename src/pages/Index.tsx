import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import logo from '@/assets/logo.png';

export default function Index() {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6 text-center">
      <img src={logo} alt="Malinha Store" className="h-28 w-28 mb-6 object-contain" />
      <h1 className="font-display text-3xl font-bold text-foreground mb-2">Malinha Store</h1>
      <p className="text-muted-foreground max-w-xs mb-8">
        Gerenciador de vestuários consignados.
      </p>
      <Button onClick={() => navigate('/login')} size="lg" className="px-8">
        Entrar
      </Button>
    </div>
  );
}
