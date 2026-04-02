import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Warehouse } from 'lucide-react';

export default function Index() {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6 text-center">
      <div className="bg-primary/10 p-5 rounded-3xl mb-6">
        <Warehouse className="h-16 w-16 text-primary" />
      </div>
      <h1 className="font-display text-4xl font-bold tracking-tight text-foreground mb-3">BagSync</h1>
      <p className="text-muted-foreground max-w-xs mb-8 text-lg">
        Gestão Inteligente de Consignação e Vendas.
      </p>
      <Button onClick={() => navigate('/login')} size="lg" className="px-8">
        Entrar
      </Button>
    </div>
  );
}
