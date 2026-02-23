import { useNavigate } from 'react-router-dom';
import { ShoppingBag } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function Index() {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6 text-center">
      <div className="rounded-full bg-primary/10 p-5 mb-6">
        <ShoppingBag className="h-10 w-10 text-primary" />
      </div>
      <h1 className="font-display text-3xl font-bold text-foreground mb-2">Minha Malinha</h1>
      <p className="text-muted-foreground max-w-xs mb-8">
        Envie roupas em consignação com elegância e praticidade.
      </p>
      <Button onClick={() => navigate('/dashboard')} size="lg" className="px-8">
        Entrar como Vendedora
      </Button>
    </div>
  );
}
