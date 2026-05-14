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
import logoSrc from '@/assets/logo.png';

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
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleMobile}
          className="bg-[#3D1A5C] text-[#F8EFE2] hover:bg-[#5E2A84] border border-[#A87BC9]/30 shadow-lg"
        >
          {isMobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </Button>
      </div>

      {/* Sidebar Overlay (Mobile) */}
      {isMobileOpen && (
        <div 
          className="fixed inset-0 bg-[#2B1B33]/60 backdrop-blur-sm z-40 lg:hidden"
          onClick={toggleMobile}
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "fixed top-0 left-0 z-40 h-screen transition-all duration-300 flex flex-col",
        "border-r border-[#A87BC9]/20 shadow-2xl",
        "bg-[#3D1A5C]",
        isCollapsed ? "w-20" : "w-64",
        isMobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
      )}>
        <div className="flex flex-col h-full py-6">

          {/* ── Logo Area ─────────────────────────────────────── */}
          <div className={cn(
            "flex items-center mb-8 px-4",
            isCollapsed ? "justify-center" : "justify-between"
          )}>
            {!isCollapsed ? (
              <div className="flex items-center gap-2 flex-1">
                <img
                  src={logoSrc}
                  alt="BagSync"
                  className="h-9 w-auto object-contain rounded-md"
                  style={{ filter: 'brightness(0) invert(1)' }}
                />
              </div>
            ) : (
              /* Collapsed: logo icon only */
              <div className="h-9 w-9 rounded-lg overflow-hidden flex items-center justify-center bg-[#5E2A84]/60 border border-[#A87BC9]/30">
                <img
                  src={logoSrc}
                  alt="B"
                  className="h-7 w-7 object-contain"
                  style={{ filter: 'brightness(0) invert(1)' }}
                />
              </div>
            )}

            {!isCollapsed && (
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleSidebar}
                className="hidden lg:flex h-7 w-7 text-[#A87BC9] hover:text-[#F8EFE2] hover:bg-[#5E2A84]/50"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
            )}
          </div>

          {/* Divider */}
          <div className="mx-4 mb-5 h-px bg-gradient-to-r from-transparent via-[#A87BC9]/40 to-transparent" />

          {/* ── Navigation Links ──────────────────────────────── */}
          <nav className="flex-1 space-y-0.5 px-3 overflow-y-auto">

            {/* Main menu */}
            {visibleMenu.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={() => setIsMobileOpen(false)}
                className={({ isActive }) => cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group relative",
                  isActive
                    ? "bg-[#5E2A84] text-[#F8EFE2] shadow-md shadow-[#2B1B33]/40"
                    : "text-[#A87BC9] hover:bg-[#5E2A84]/50 hover:text-[#F8EFE2]",
                  isCollapsed && "justify-center px-0"
                )}
              >
                {({ isActive }) => (
                  <>
                    <item.icon className={cn(
                      "shrink-0 transition-all",
                      isCollapsed ? "h-6 w-6" : "h-5 w-5",
                      isActive ? "text-[#E8CFA3]" : ""
                    )} />
                    {!isCollapsed && <span className="font-medium text-sm">{item.title}</span>}
                    {!isCollapsed && isActive && (
                      <div className="ml-auto h-1.5 w-1.5 rounded-full bg-[#E8CFA3]" />
                    )}
                    {isCollapsed && (
                      <div className="absolute left-full ml-3 px-2 py-1 bg-[#2B1B33] text-[#F8EFE2] rounded text-xs opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap shadow-xl z-50 border border-[#A87BC9]/20">
                        {item.title}
                      </div>
                    )}
                  </>
                )}
              </NavLink>
            ))}

            {/* Gestão (master + loja) */}
            {visibleManagement.length > 0 && (
              <div className="pt-4 pb-1 mt-2">
                <div className="mx-0 mb-3 h-px bg-gradient-to-r from-transparent via-[#A87BC9]/30 to-transparent" />
                {!isCollapsed && (
                  <p className="px-3 text-[10px] font-bold text-[#A87BC9]/70 uppercase tracking-widest mb-2">
                    Gestão
                  </p>
                )}
                {visibleManagement.map((item) => (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    onClick={() => setIsMobileOpen(false)}
                    className={({ isActive }) => cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group relative",
                      isActive
                        ? "bg-[#5E2A84]/70 text-[#F8EFE2]"
                        : "text-[#A87BC9] hover:bg-[#5E2A84]/40 hover:text-[#F8EFE2]",
                      isCollapsed && "justify-center px-0"
                    )}
                  >
                    {({ isActive }) => (
                      <>
                        <item.icon className={cn(
                          "shrink-0",
                          isCollapsed ? "h-6 w-6" : "h-5 w-5",
                          isActive ? "text-[#E8CFA3]" : ""
                        )} />
                        {!isCollapsed && <span className="font-medium text-sm">{item.title}</span>}
                        {isCollapsed && (
                          <div className="absolute left-full ml-3 px-2 py-1 bg-[#2B1B33] text-[#F8EFE2] rounded text-xs opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap shadow-xl z-50 border border-[#A87BC9]/20">
                            {item.title}
                          </div>
                        )}
                      </>
                    )}
                  </NavLink>
                ))}
              </div>
            )}

            {/* Recursos */}
            {visibleResources.length > 0 && (
              <div className="pt-4 pb-1 mt-2">
                <div className="mx-0 mb-3 h-px bg-gradient-to-r from-transparent via-[#A87BC9]/30 to-transparent" />
                {!isCollapsed && (
                  <p className="px-3 text-[10px] font-bold text-[#A87BC9]/70 uppercase tracking-widest mb-2">
                    Recursos
                  </p>
                )}
                {visibleResources.map((item) => (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    onClick={() => setIsMobileOpen(false)}
                    className={({ isActive }) => cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group relative",
                      isActive
                        ? "bg-[#5E2A84] text-[#F8EFE2] shadow-md shadow-[#2B1B33]/40"
                        : "text-[#A87BC9] hover:bg-[#5E2A84]/50 hover:text-[#F8EFE2]",
                      isCollapsed && "justify-center px-0"
                    )}
                  >
                    {({ isActive }) => (
                      <>
                        <item.icon className={cn(
                          "shrink-0",
                          isCollapsed ? "h-6 w-6" : "h-5 w-5",
                          isActive ? "text-[#E8CFA3]" : ""
                        )} />
                        {!isCollapsed && <span className="font-medium text-sm">{item.title}</span>}
                        {isCollapsed && (
                          <div className="absolute left-full ml-3 px-2 py-1 bg-[#2B1B33] text-[#F8EFE2] rounded text-xs opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap shadow-xl z-50 border border-[#A87BC9]/20">
                            {item.title}
                          </div>
                        )}
                      </>
                    )}
                  </NavLink>
                ))}
              </div>
            )}
          </nav>

          {/* ── Bottom Actions ────────────────────────────────── */}
          <div className="px-3 pt-4 space-y-1">
            <div className="mx-0 mb-3 h-px bg-gradient-to-r from-transparent via-[#A87BC9]/30 to-transparent" />
            <Button 
              variant="ghost" 
              className={cn(
                "w-full justify-start gap-3 text-[#A87BC9] hover:text-[#F8EFE2] hover:bg-red-900/40 transition-colors",
                isCollapsed && "justify-center px-0"
              )}
              onClick={() => {
                signOut();
                navigate('/login');
              }}
            >
              <LogOut className="h-5 w-5" />
              {!isCollapsed && <span className="text-sm font-medium">Sair</span>}
            </Button>
            
            {isCollapsed && (
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleSidebar}
                className="mx-auto hidden lg:flex mt-2 text-[#A87BC9] hover:text-[#F8EFE2] hover:bg-[#5E2A84]/50"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}
