import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { 
  Package, 
  ShoppingCart, 
  Warehouse, 
  BarChart3, 
  Users, 
  ShieldCheck, 
  LogOut,
  Menu,
  X,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';

export default function Sidebar() {
  const { role, signOut } = useAuth();
  const navigate = useNavigate();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const menuItems = [
    { title: 'Malinha', icon: Package, path: '/dashboard', roles: ['master', 'loja', 'vendedora'] },
    { title: 'Vendas', icon: ShoppingCart, path: '/vendas', roles: ['master', 'loja', 'vendedora'] },
    { title: 'Produtos', icon: Warehouse, path: '/produtos', roles: ['master', 'loja', 'vendedora'] },
    { title: 'Relatórios', icon: BarChart3, path: '/relatorios', roles: ['master', 'loja', 'vendedora'] },
  ];

  // Extra items for Master/Loja if needed, but keeping it simple for now as requested.
  if (role === 'master') {
    // We could add Master-specific items here if they weren't in the dashboards
  }

  const toggleSidebar = () => setIsCollapsed(!isCollapsed);
  const toggleMobile = () => setIsMobileOpen(!isMobileOpen);

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
              <span className="font-display text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
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
          <nav className="flex-1 space-y-1 px-3">
            {menuItems.filter(item => item.roles.includes(role || '')).map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={() => setIsMobileOpen(false)}
                className={({ isActive }) => cn(
                  "flex items-center gap-3 px-3 py-2 rounded-lg transition-colors group",
                  isActive 
                    ? "bg-primary text-primary-foreground shadow-sm" 
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                  isCollapsed && "justify-center px-0"
                )}
              >
                <item.icon className={cn("h-5 w-5", isCollapsed ? "h-6 w-6" : "")} />
                {!isCollapsed && <span className="font-medium">{item.title}</span>}
                {isCollapsed && (
                  <div className="absolute left-full ml-2 px-2 py-1 bg-popover text-popover-foreground rounded text-xs opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap shadow-md">
                    {item.title}
                  </div>
                )}
              </NavLink>
            ))}
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
