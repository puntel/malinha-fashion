import { describe, it, expect, beforeEach } from "vitest";
import {
  RateLimiterGuard,
  MemoryRateLimitStore,
  DistributedRateLimitStore,
  extractClientIdentity,
  CRITICAL_ROUTES_LIMITS,
  RateLimitConfig,
} from "@/lib/rate-limiter";

describe("Auditoria de Rate Limiting, TTL, Identidade e Armazenamento Multi-Instância", () => {
  let memoryStore: MemoryRateLimitStore;
  let guard: RateLimiterGuard;

  beforeEach(() => {
    memoryStore = new MemoryRateLimitStore();
    guard = new RateLimiterGuard(memoryStore);
  });

  describe("1. Teste Local com Limite Baixo: Confirmação de HTTP 429 e Headers Padrão", () => {
    const configBaixoLimite: RateLimitConfig = {
      actionName: "test_low_limit",
      windowSeconds: 2, // Janela de 2 segundos
      maxRequests: 3,   // Limite estrito de 3 requisições
    };

    it("deve permitir as 3 primeiras requisições com status 200 e decrementar o X-RateLimit-Remaining", async () => {
      const identity = "ip:203.0.113.195";
      const startTime = 1700000000000;

      // 1ª requisição
      const res1 = await guard.check(identity, configBaixoLimite, startTime);
      expect(res1.allowed).toBe(true);
      expect(res1.status).toBe(200);
      expect(res1.remaining).toBe(2);
      expect(res1.headers["X-RateLimit-Remaining"]).toBe("2");
      expect(res1.headers["X-RateLimit-Limit"]).toBe("3");

      // 2ª requisição
      const res2 = await guard.check(identity, configBaixoLimite, startTime + 100);
      expect(res2.allowed).toBe(true);
      expect(res2.status).toBe(200);
      expect(res2.remaining).toBe(1);

      // 3ª requisição (última da quota)
      const res3 = await guard.check(identity, configBaixoLimite, startTime + 200);
      expect(res3.allowed).toBe(true);
      expect(res3.status).toBe(200);
      expect(res3.remaining).toBe(0);
      expect(res3.headers["X-RateLimit-Remaining"]).toBe("0");
    });

    it("deve BLOQUEAR a 4ª requisição com HTTP 429 e cabeçalho Retry-After", async () => {
      const identity = "ip:203.0.113.195";
      const startTime = 1700000000000;

      // Esgota as 3 requisições
      await guard.check(identity, configBaixoLimite, startTime);
      await guard.check(identity, configBaixoLimite, startTime + 50);
      await guard.check(identity, configBaixoLimite, startTime + 100);

      // 4ª requisição (excede o limite)
      const res4 = await guard.check(identity, configBaixoLimite, startTime + 200);

      expect(res4.allowed).toBe(false);
      expect(res4.status).toBe(429);
      expect(res4.remaining).toBe(0);
      expect(res4.retryAfterSeconds).toBeGreaterThanOrEqual(1);
      expect(res4.headers["Retry-After"]).toBeDefined();
      expect(res4.headers["X-RateLimit-Remaining"]).toBe("0");
    });

    it("deve RECUPERAR e permitir novas requisições após a expiração da janela (TTL)", async () => {
      const identity = "ip:203.0.113.195";
      const startTime = 1700000000000;

      // Consome toda a quota
      await guard.check(identity, configBaixoLimite, startTime);
      await guard.check(identity, configBaixoLimite, startTime + 10);
      await guard.check(identity, configBaixoLimite, startTime + 20);

      // Bloqueado aos 500ms
      const resBloqueado = await guard.check(identity, configBaixoLimite, startTime + 500);
      expect(resBloqueado.status).toBe(429);

      // Avança o tempo além da janela de 2 segundos (TTL de 2.000ms expirou)
      const tempoAposJanela = startTime + 2500;
      const resRecuperado = await guard.check(identity, configBaixoLimite, tempoAposJanela);

      expect(resRecuperado.allowed).toBe(true);
      expect(resRecuperado.status).toBe(200);
      expect(resRecuperado.remaining).toBe(2); // Nova janela iniciada
    });
  });

  describe("2. Unidade do TTL e Cálculo de Expiração", () => {
    it("confirma que a janela é declarada em segundos e convertida com precisão em milissegundos para os headers", async () => {
      const configTtl: RateLimitConfig = {
        actionName: "ttl_precision_check",
        windowSeconds: 60, // 60 segundos
        maxRequests: 1,
      };

      const baseNow = 1700000000000;
      const res = await guard.check("ip:1.1.1.1", configTtl, baseNow);

      // Reset deve ser exatamente baseNow + 60.000 ms
      expect(res.resetTimeMs).toBe(baseNow + 60000);
      expect(res.headers["X-RateLimit-Reset"]).toBe(Math.ceil((baseNow + 60000) / 1000).toString());
    });
  });

  describe("3. Resolução de Identidade e Prevenção contra Spoofing de Proxies", () => {
    it("deve priorizar o User ID autenticado para não penalizar múltiplos usuários em mesma rede/NAT", () => {
      const identity = extractClientIdentity({
        reqHeaders: { "x-forwarded-for": "198.51.100.5" },
        userId: "user-uuid-12345",
      });

      expect(identity).toBe("usr:user-uuid-12345");
    });

    it("deve extrair IP do cabeçalho confiável de borda (CF-Connecting-IP)", () => {
      const identity = extractClientIdentity({
        reqHeaders: {
          "cf-connecting-ip": "203.0.113.77",
          "x-forwarded-for": "10.0.0.1, 192.168.1.1", // Tentativa de forjar header
        },
      });

      expect(identity).toBe("ip:203.0.113.77");
    });

    it("deve descartar IPs de proxies intermediários confiáveis da direita para a esquerda", () => {
      const trustedReverseProxy = "10.0.0.100";
      const identity = extractClientIdentity({
        reqHeaders: {
          "x-forwarded-for": "198.51.100.42, 10.0.0.100",
        },
        trustedProxyIps: [trustedReverseProxy],
      });

      // O IP do cliente real é 198.51.100.42, não o proxy reverso interno
      expect(identity).toBe("ip:198.51.100.42");
    });

    it("garante isolamento: o esgotamento de quota de um cliente NÃO afeta outros clientes", async () => {
      const config: RateLimitConfig = { actionName: "user_isolation", windowSeconds: 10, maxRequests: 1 };

      // Cliente A consome sua quota
      const resA1 = await guard.check("ip:100.0.0.1", config);
      expect(resA1.status).toBe(200);

      const resA2 = await guard.check("ip:100.0.0.1", config);
      expect(resA2.status).toBe(429);

      // Cliente B faz requisição e NÃO é afetado
      const resB = await guard.check("ip:100.0.0.2", config);
      expect(resB.status).toBe(200);
      expect(resB.allowed).toBe(true);
    });
  });

  describe("4. Armazenamento em Múltiplas Instâncias (Cluster Distribuído)", () => {
    it("deve somar requisições entre instâncias diferentes compartilhando o mesmo storage", async () => {
      // Simula uma tabela/cache compartilhado (ex: Redis / Postgres Key-Value)
      const sharedStorage = new Map<string, any>();

      const storeInstancia1 = new DistributedRateLimitStore(sharedStorage);
      const storeInstancia2 = new DistributedRateLimitStore(sharedStorage);

      const guardInstancia1 = new RateLimiterGuard(storeInstancia1);
      const guardInstancia2 = new RateLimiterGuard(storeInstancia2);

      const clusterConfig: RateLimitConfig = {
        actionName: "distributed_api",
        windowSeconds: 5,
        maxRequests: 3, // Total máximo de 3 no cluster
      };

      const identity = "ip:203.0.113.88";

      // Instância 1 processa 2 requisições
      await guardInstancia1.check(identity, clusterConfig);
      await guardInstancia1.check(identity, clusterConfig);

      // Instância 2 processa a 3ª requisição
      const res3 = await guardInstancia2.check(identity, clusterConfig);
      expect(res3.allowed).toBe(true);
      expect(res3.remaining).toBe(0);

      // 4ª requisição chega na Instância 1 e é BLOQUEADA em nível de cluster
      const res4 = await guardInstancia1.check(identity, clusterConfig);
      expect(res4.allowed).toBe(false);
      expect(res4.status).toBe(429);
    });
  });

  describe("5. Inspecção e Mapeamento de Rotas Críticas / Caras", () => {
    it("confirma regras estritas para login_by_email (Prevenção de Brute-Force e CPU exhaustion)", () => {
      const cfg = CRITICAL_ROUTES_LIMITS.LOGIN_BY_EMAIL;
      expect(cfg.maxRequests).toBe(5);
      expect(cfg.windowSeconds).toBe(60);
    });

    it("confirma regras estritas para manage_users e send_email (Prevenção de custos de terceiros)", () => {
      expect(CRITICAL_ROUTES_LIMITS.MANAGE_USERS.maxRequests).toBe(10);
      expect(CRITICAL_ROUTES_LIMITS.SEND_EMAIL.maxRequests).toBe(10);
      expect(CRITICAL_ROUTES_LIMITS.CREATE_CHECKOUT.maxRequests).toBe(15);
    });
  });
});
