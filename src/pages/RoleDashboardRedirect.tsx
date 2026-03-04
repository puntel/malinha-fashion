import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Loader2 } from 'lucide-react';

/** Redirects authenticated users to their role-based dashboard */
export default function RoleDashboardRedirect() {
  const { user, role, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  switch (role) {
    case 'master':
      return <Navigate to="/master" replace />;
    case 'loja':
      return <Navigate to="/loja" replace />;
    case 'vendedora':
    default:
      return <Navigate to="/vendedora" replace />;
  }
}
