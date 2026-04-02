import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { 
  Package, 
  ShoppingCart, 
  Warehouse, 
  BarChart3, 
  Users, 
  ShieldCheck, 
  Store,
  LogOut,
  Menu,
  X,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
  UserRound,
  KeyRound,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import { cn } from '@/lib/utils';
import type { FeatureKey } from '@/lib/types';

export default function Sidebar() {
  const { role, signOut } = useAuth();
  const { canView } = usePermissions();
  const navigate = useNavigate();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  // Only show items the current user has view permission for
  const menuItems: { title: string; icon: any; path: string; roles: string[]; feature?: FeatureKey }[] = [
    { title: 'Clientes',    icon: UserRound,      path: '/clientes',   roles: ['master', 'loja', 'vendedora'], feature: 'clientes'   },
    { title: 'Produtos',    icon: Warehouse,      path: '/produtos',   roles: ['master', 'loja', 'vendedora'], feature: 'produtos'   },
    { title: 'Vendas',      icon: ShoppingCart,   path: '/vendas',     roles: ['master', 'loja', 'vendedora'], feature: 'vendas'     },
    { 
      title: 'Consignado',  
      icon: Package,        
      path: role === 'master' ? '/master' : role === 'loja' ? '/loja' : '/vendedora', 
      roles: ['master', 'loja', 'vendedora'],
      feature: 'malinhas'
    },
    { title: 'Relatórios',  icon: BarChart3,      path: '/relatorios', roles: ['master', 'loja', 'vendedora'], feature: 'relatorios' },
  ];

  const resourceItems: { title: string; icon: any; path: string; roles: string[]; feature?: FeatureKey }[] = [
    { title: 'Modelos', icon: FileSpreadsheet, path: '/modelos', roles: ['master', 'loja', 'vendedora'], feature: 'modelos' },
  ];

  const managementItems = [
    { title: 'Lojas',           icon: Store,       path: '/lojas',       roles: ['master'] },
    { title: 'Vendedoras',      icon: Users,       path: '/vendedoras',  roles: ['master', 'loja'] },
    { title: 'Administradores', icon: ShieldCheck, path: '/admins',      roles: ['master'] },
    { title: 'Permissões',      icon: KeyRound,    path: '/permissoes',  roles: ['master', 'loja'] },
  ];

  const toggleSidebar = () => setIsCollapsed(!isCollapsed);
  const toggleMobile = () => setIsMobileOpen(!isMobileOpen);

  const visibleMenu = menuItems.filter(item => {
    if (!item.roles.includes(role || '')) return false;
    if (item.feature && !canView(item.feature)) return false;
    return true;
  });

  const visibleResources = resourceItems.filter(item => {
    if (!item.roles.includes(role || '')) return false;
    if (item.feature && !canView(item.feature)) return false;
    return true;
  });

  const visibleManagement = managementItems.filter(item =>
    item.roles.includes(role || '')
  );

  return (
    <>
      {/* Mobile Toggle */}
      <div className="lg:hidden fixed top-4 left-4 z-50">
        <Button variant="outline" size="icon" onClick={toggleMobile}>
          {isMobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </Button>
      </div>

      {/* Sidebar Overlay (Mobile) */}
      {isMobileOpen && (
        <div 
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 lg:hidden"
          onClick={toggleMobile}
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "fixed top-0 left-0 z-40 h-screen transition-all duration-300 border-r bg-card",
        isCollapsed ? "w-20" : "w-64",
        isMobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
      )}>
        <div className="flex flex-col h-full py-6">
          {/* Logo Area */}
          <div className={cn(
            "flex items-center mb-10 px-6",
            isCollapsed ? "justify-center" : "justify-between"
          )}>
            {!isCollapsed && (
              <span className="font-display text-2xl font-bold text-foreground">
                BagSync
              </span>
            )}
            {isCollapsed ? (
              <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center text-white font-bold">B</div>
            ) : (
              <Button variant="ghost" size="icon" onClick={toggleSidebar} className="hidden lg:flex">
                <ChevronLeft className="h-4 w-4" />
              </Button>
            )}
          </div>

          {/* Navigation Links */}
          <nav className="flex-1 space-y-1 px-3 overflow-y-auto">

            {/* ── Main menu ─────────────────────────────────────────── */}
            {visibleMenu.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={() => setIsMobileOpen(false)}
                className={({ isActive }) => cn(
                  "flex items-center gap-3 px-3 py-2 rounded-lg transition-colors group relative",
                  isActive 
                    ? "bg-primary text-primary-foreground shadow-sm" 
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                  isCollapsed && "justify-center px-0"
                )}
              >
                <item.icon className={cn("h-5 w-5 shrink-0", isCollapsed ? "h-6 w-6" : "")} />
                {!isCollapsed && <span className="font-medium">{item.title}</span>}
                {isCollapsed && (
                  <div className="absolute left-full ml-2 px-2 py-1 bg-popover text-popover-foreground rounded text-xs opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap shadow-md z-50">
                    {item.title}
                  </div>
                )}
              </NavLink>
            ))}

            {/* ── Gestão (master + loja) ─────────────────────────── */}
            {visibleManagement.length > 0 && (
              <div className="pt-4 pb-2 border-t mt-4">
                {!isCollapsed && (
                  <p className="px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                    Gestão
                  </p>
                )}
                {visibleManagement.map((item) => (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    onClick={() => setIsMobileOpen(false)}
                    className={({ isActive }) => cn(
                      "flex items-center gap-3 px-3 py-2 rounded-lg transition-colors group relative",
                      isActive 
                        ? "bg-primary/10 text-primary font-semibold" 
                        : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                      isCollapsed && "justify-center px-0"
                    )}
                  >
                    <item.icon className={cn("h-5 w-5 shrink-0", isCollapsed ? "h-6 w-6" : "")} />
                    {!isCollapsed && <span className="font-medium">{item.title}</span>}
                    {isCollapsed && (
                      <div className="absolute left-full ml-2 px-2 py-1 bg-popover text-popover-foreground rounded text-xs opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap shadow-md z-50">
                        {item.title}
                      </div>
                    )}
                  </NavLink>
                ))}
              </div>
            )}

            {/* ── Recursos ────────────────────────────────────────── */}
            {visibleResources.length > 0 && (
              <div className="pt-4 pb-2">
                {!isCollapsed && (
                  <p className="px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                    Recursos
                  </p>
                )}
                {visibleResources.map((item) => (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    onClick={() => setIsMobileOpen(false)}
                    className={({ isActive }) => cn(
                      "flex items-center gap-3 px-3 py-2 rounded-lg transition-colors group relative",
                      isActive 
                        ? "bg-primary text-primary-foreground shadow-sm" 
                        : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                      isCollapsed && "justify-center px-0"
                    )}
                  >
                    <item.icon className={cn("h-5 w-5 shrink-0", isCollapsed ? "h-6 w-6" : "")} />
                    {!isCollapsed && <span className="font-medium">{item.title}</span>}
                    {isCollapsed && (
                      <div className="absolute left-full ml-2 px-2 py-1 bg-popover text-popover-foreground rounded text-xs opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap shadow-md z-50">
                        {item.title}
                      </div>
                    )}
                  </NavLink>
                ))}
              </div>
            )}
          </nav>

          {/* Bottom Actions */}
          <div className="px-3 pt-4 border-t space-y-1">
            <Button 
              variant="ghost" 
              className={cn(
                "w-full justify-start gap-3 text-muted-foreground hover:text-destructive transition-colors",
                isCollapsed && "justify-center px-0"
              )}
              onClick={() => {
                signOut();
                navigate('/login');
              }}
            >
              <LogOut className="h-5 w-5" />
              {!isCollapsed && <span>Sair</span>}
            </Button>
            
            {isCollapsed && (
              <Button variant="ghost" size="icon" onClick={toggleSidebar} className="mx-auto hidden lg:flex mt-2">
                <ChevronRight className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}
