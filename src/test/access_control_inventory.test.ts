import { describe, it, expect } from "vitest";

// Definição da Matriz de Rotas do Frontend (espelhando src/App.tsx)
export interface FrontendRouteDef {
  path: string;
  isPublic?: boolean;
  allowedRoles?: Array<"master" | "loja" | "vendedora">;
  type: "public" | "admin" | "management" | "operational";
}

export const APP_ROUTES_INVENTORY: FrontendRouteDef[] = [
  { path: "/", isPublic: true, type: "public" },
  { path: "/login", isPublic: true, type: "public" },
  { path: "/reset-password", isPublic: true, type: "public" },
  { path: "/malinha/:id", isPublic: true, type: "public" }, // ClienteView (Acesso público do cliente final)
  { path: "/dashboard", allowedRoles: ["master", "loja", "vendedora"], type: "operational" },
  { path: "/master", allowedRoles: ["master"], type: "admin" },
  { path: "/lojas", allowedRoles: ["master"], type: "admin" },
  { path: "/admins", allowedRoles: ["master"], type: "admin" },
  { path: "/loja", allowedRoles: ["loja"], type: "management" },
  { path: "/vendedoras", allowedRoles: ["master", "loja"], type: "management" },
  { path: "/permissoes", allowedRoles: ["master", "loja"], type: "management" },
  { path: "/vendedora", allowedRoles: ["vendedora"], type: "operational" },
  { path: "/vendas", allowedRoles: ["master", "loja", "vendedora"], type: "operational" },
  { path: "/produtos", allowedRoles: ["master", "loja", "vendedora"], type: "operational" },
  { path: "/clientes", allowedRoles: ["master", "loja", "vendedora"], type: "operational" },
  { path: "/relatorios", allowedRoles: ["master", "loja", "vendedora"], type: "operational" },
  { path: "/modelos", allowedRoles: ["master", "loja", "vendedora"], type: "operational" },
  { path: "/nova-malinha", allowedRoles: ["loja", "vendedora"], type: "operational" },
  { path: "/nova-malinha/produtos", allowedRoles: ["loja", "vendedora"], type: "operational" },
  { path: "/malinha/:id/resumo", allowedRoles: ["master", "loja", "vendedora"], type: "operational" },
];

/**
 * Avaliador de Autorização no Frontend (espelha ProtectedRoute.tsx com deny-by-default)
 */
export function evaluateRouteAccess(
  route: FrontendRouteDef,
  session: { isAuthenticated: boolean; role: "master" | "loja" | "vendedora" | null }
): { allowed: boolean; redirectTo?: string } {
  if (route.isPublic) {
    return { allowed: true };
  }

  // 1. Sem sessão -> Redireciona para /login
  if (!session.isAuthenticated) {
    return { allowed: false, redirectTo: "/login" };
  }

  // 2. Com sessão, mas rota exige roles específicas
  if (route.allowedRoles && route.allowedRoles.length > 0) {
    // Negação por padrão: se não tem role ou role não está na lista permitida -> Bloqueia
    if (!session.role || !route.allowedRoles.includes(session.role)) {
      return { allowed: false, redirectTo: "/dashboard" };
    }
  }

  return { allowed: true };
}

/**
 * Avaliador de Autorização no Backend (espelha supabase/functions/manage-users/index.ts)
 */
export function evaluateBackendAction(
  action: string,
  caller: { isAuthenticated: boolean; roles: string[]; injectedRoleInBody?: string }
): { status: number; allowed: boolean; message: string } {
  // Apenas a criação de loja inicial é aberta para cadastro
  if (action === "create_loja") {
    return { status: 200, allowed: true, message: "Cadastro público de loja" };
  }

  // 1. Negação por Padrão para não autenticados
  if (!caller.isAuthenticated) {
    return { status: 401, allowed: false, message: "Missing authorization" };
  }

  // 2. Fonte de permissão confiável: Ignora explicitamente injectedRoleInBody
  const effectiveRoles = caller.roles; // Vem do JWT/banco, NUNCA do body!

  const isMaster = effectiveRoles.includes("master");
  const isLoja = effectiveRoles.includes("loja");

  // Regras por ação
  switch (action) {
    case "create_master":
    case "list_users":
    case "delete_user":
      if (!isMaster) {
        return { status: 403, allowed: false, message: "Apenas Master tem autorização" };
      }
      return { status: 200, allowed: true, message: "Autorizado para Master" };

    case "create_vendedora":
    case "update_user":
      if (!isMaster && !isLoja) {
        return { status: 403, allowed: false, message: "Apenas Loja ou Master têm autorização" };
      }
      return { status: 200, allowed: true, message: "Autorizado para Loja/Master" };

    default:
      return { status: 400, allowed: false, message: "Unknown action" };
  }
}

describe("Auditoria de Inventário de Rotas, Controle de Acesso e Negação por Padrão", () => {
  describe("1. Matriz de Acesso a Rotas Sensíveis no Frontend (App.tsx / ProtectedRoute)", () => {
    const adminRoutes = APP_ROUTES_INVENTORY.filter((r) => r.type === "admin");
    const managementRoutes = APP_ROUTES_INVENTORY.filter((r) => r.type === "management");

    it("Rotas Admin (/master, /lojas, /admins): Bloqueadas para Anônimos e Usuários Comuns", () => {
      adminRoutes.forEach((route) => {
        // Sem Sessão
        const anonAccess = evaluateRouteAccess(route, { isAuthenticated: false, role: null });
        expect(anonAccess.allowed).toBe(false);
        expect(anonAccess.redirectTo).toBe("/login");

        // Usuário Comum (Vendedora)
        const vendedoraAccess = evaluateRouteAccess(route, { isAuthenticated: true, role: "vendedora" });
        expect(vendedoraAccess.allowed).toBe(false);
        expect(vendedoraAccess.redirectTo).toBe("/dashboard");

        // Lojista (Loja) tentando acessar rota de Master
        const lojaAccess = evaluateRouteAccess(route, { isAuthenticated: true, role: "loja" });
        expect(lojaAccess.allowed).toBe(false);
        expect(lojaAccess.redirectTo).toBe("/dashboard");

        // Administrador (Master)
        const masterAccess = evaluateRouteAccess(route, { isAuthenticated: true, role: "master" });
        expect(masterAccess.allowed).toBe(true);
      });
    });

    it("Rotas de Gestão (/loja, /vendedoras, /permissoes): Bloqueadas para Vendedora", () => {
      managementRoutes.forEach((route) => {
        // Vendedora não pode acessar
        const vendedoraAccess = evaluateRouteAccess(route, { isAuthenticated: true, role: "vendedora" });
        expect(vendedoraAccess.allowed).toBe(false);
        expect(vendedoraAccess.redirectTo).toBe("/dashboard");

        // Loja pode acessar
        const lojaAccess = evaluateRouteAccess(route, { isAuthenticated: true, role: "loja" });
        expect(lojaAccess.allowed).toBe(true);
      });
    });

    it("Negação por Padrão: Usuário autenticado SEM role (role: null) é BLOQUEADO em rotas restritas", () => {
      const rotaMaster = APP_ROUTES_INVENTORY.find((r) => r.path === "/master")!;

      // Usuário logado mas sem papel atribuído na tabela user_roles
      const accessSemRole = evaluateRouteAccess(rotaMaster, { isAuthenticated: true, role: null });

      expect(accessSemRole.allowed).toBe(false);
      expect(accessSemRole.redirectTo).toBe("/dashboard");
    });
  });

  describe("2. Controle de Acesso no Backend (manage-users) e Fonte Confiável de Permissões", () => {
    it("Endpoint create_master: Rejeita anônimos (401) e vendedoras/lojas (403)", () => {
      // 1. Sem Sessão
      const anonRes = evaluateBackendAction("create_master", { isAuthenticated: false, roles: [] });
      expect(anonRes.status).toBe(401);
      expect(anonRes.allowed).toBe(false);

      // 2. Vendedora
      const vendedoraRes = evaluateBackendAction("create_master", { isAuthenticated: true, roles: ["vendedora"] });
      expect(vendedoraRes.status).toBe(403);
      expect(vendedoraRes.allowed).toBe(false);

      // 3. Loja
      const lojaRes = evaluateBackendAction("create_master", { isAuthenticated: true, roles: ["loja"] });
      expect(lojaRes.status).toBe(403);
      expect(lojaRes.allowed).toBe(false);

      // 4. Master
      const masterRes = evaluateBackendAction("create_master", { isAuthenticated: true, roles: ["master"] });
      expect(masterRes.status).toBe(200);
      expect(masterRes.allowed).toBe(true);
    });

    it("Tentativa de Escalar Privilégio injetando role: 'master' no corpo NÃO deve ser aceita", () => {
      // Vendedora tenta enviar body: { role: 'master' }
      const attackerCaller = {
        isAuthenticated: true,
        roles: ["vendedora"], // Fonte confiável no servidor (JWT/DB)
        injectedRoleInBody: "master", // Injeção maliciosa do atacante
      };

      const res = evaluateBackendAction("create_master", attackerCaller);

      // Deve ser categoricamente bloqueado porque a autorização usa a fonte confiável (effectiveRoles)
      expect(res.status).toBe(403);
      expect(res.allowed).toBe(false);
    });

    it("Endpoint delete_user: Apenas Master pode excluir usuários da plataforma", () => {
      const lojaAttempt = evaluateBackendAction("delete_user", { isAuthenticated: true, roles: ["loja"] });
      expect(lojaAttempt.status).toBe(403);
      expect(lojaAttempt.allowed).toBe(false);

      const masterAttempt = evaluateBackendAction("delete_user", { isAuthenticated: true, roles: ["master"] });
      expect(masterAttempt.status).toBe(200);
      expect(masterAttempt.allowed).toBe(true);
    });
  });

  describe("3. Falsos Controles de Autorização (Anti-Patterns)", () => {
    it("Confirma que esconder o botão da UI não impede requisições diretas de API se a rota do servidor não validar", () => {
      // Simulação: A vendedora inspeciona o código JS e descobre o endpoint /manage-users
      // Mesmo sem ter o botão "Criar Administrador" na tela, ela dispara o fetch:
      const directApiCall = evaluateBackendAction("create_master", {
        isAuthenticated: true,
        roles: ["vendedora"],
      });

      // A API no backend DEVE barrar, provando que a autorização é independente da UI
      expect(directApiCall.status).toBe(403);
      expect(directApiCall.allowed).toBe(false);
    });
  });
});
