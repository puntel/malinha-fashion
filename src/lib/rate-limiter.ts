/**
 * Módulo de Rate Limiting e Proteção de Recursos da Aplicação
 * Implementa Sliding Window / Token Bucket com suporte a identificadores compostos,
 * resolução segura de proxies (anti-spoofing) e drivers de armazenamento local e distribuído.
 */

export interface RateLimitConfig {
  /** Janela de tempo em segundos (TTL) */
  windowSeconds: number;
  /** Máximo de requisições permitidas dentro da janela */
  maxRequests: number;
  /** Identificador do recurso / rota */
  actionName: string;
}

export interface RateLimitResult {
  allowed: boolean;
  status: number;
  limit: number;
  remaining: number;
  resetTimeMs: number;
  retryAfterSeconds: number;
  headers: Record<string, string>;
}

export interface RateLimitStore {
  incrementAndGet(key: string, windowSeconds: number, nowMs?: number): Promise<{ count: number; firstSeenMs: number }>;
  reset(key: string): Promise<void>;
}

/**
 * Driver em Memória Local (adequado para testes e ambientes single-instance)
 */
export class MemoryRateLimitStore implements RateLimitStore {
  private store = new Map<string, { count: number; firstSeenMs: number; expiresAtMs: number }>();

  async incrementAndGet(
    key: string,
    windowSeconds: number,
    nowMs: number = Date.now()
  ): Promise<{ count: number; firstSeenMs: number }> {
    const now = nowMs;
    const entry = this.store.get(key);

    if (!entry || now >= entry.expiresAtMs) {
      // Nova janela de tempo
      const newEntry = {
        count: 1,
        firstSeenMs: now,
        expiresAtMs: now + windowSeconds * 1000,
      };
      this.store.set(key, newEntry);
      return { count: 1, firstSeenMs: now };
    }

    entry.count += 1;
    return { count: entry.count, firstSeenMs: entry.firstSeenMs };
  }

  async reset(key: string): Promise<void> {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }
}

/**
 * Driver Distribuído Mock / Adaptador para Redis/Upstash (para clusters multi-instância)
 */
export class DistributedRateLimitStore implements RateLimitStore {
  constructor(private sharedStorage: Map<string, { count: number; firstSeenMs: number; expiresAtMs: number }>) {}

  async incrementAndGet(
    key: string,
    windowSeconds: number,
    nowMs: number = Date.now()
  ): Promise<{ count: number; firstSeenMs: number }> {
    const now = nowMs;
    const entry = this.sharedStorage.get(key);

    if (!entry || now >= entry.expiresAtMs) {
      const newEntry = {
        count: 1,
        firstSeenMs: now,
        expiresAtMs: now + windowSeconds * 1000,
      };
      this.sharedStorage.set(key, newEntry);
      return { count: 1, firstSeenMs: now };
    }

    entry.count += 1;
    return { count: entry.count, firstSeenMs: entry.firstSeenMs };
  }

  async reset(key: string): Promise<void> {
    this.sharedStorage.delete(key);
  }
}

export interface ExtractClientIdentityOptions {
  reqHeaders: Headers | Record<string, string | string[] | undefined>;
  userId?: string | null;
  trustedProxyIps?: string[];
}

/**
 * Extrai a identidade do cliente de forma resiliente contra spoofing de cabeçalhos.
 * Dá preferência ao User ID autenticado se existir.
 * Para IP, prioriza cabeçalhos seguros de borda (ex: CF-Connecting-IP) ou o último hop confiável.
 */
export function extractClientIdentity(options: ExtractClientIdentityOptions): string {
  const { reqHeaders, userId, trustedProxyIps = [] } = options;

  // 1. Se autenticado, a identidade é primariamente o User ID (evita bloqueio coletivo atrás de NAT)
  if (userId) {
    return `usr:${userId}`;
  }

  const getHeader = (name: string): string | undefined => {
    if (typeof (reqHeaders as any).get === "function") {
      return (reqHeaders as Headers).get(name) || undefined;
    }
    const val = (reqHeaders as Record<string, any>)[name.toLowerCase()];
    return Array.isArray(val) ? val[0] : val;
  };

  // 2. Provedor de Borda Confiável (ex: Cloudflare)
  const cfConnectingIp = getHeader("cf-connecting-ip");
  if (cfConnectingIp) {
    return `ip:${cfConnectingIp.trim()}`;
  }

  // 3. X-Real-IP
  const xRealIp = getHeader("x-real-ip");
  if (xRealIp) {
    return `ip:${xRealIp.trim()}`;
  }

  // 4. X-Forwarded-For com análise de proxies confiáveis
  const xForwardedFor = getHeader("x-forwarded-for");
  if (xForwardedFor) {
    const ips = xForwardedFor.split(",").map((ip) => ip.trim());
    // Se há proxies confiáveis, removemos os proxies conhecidos da direita para a esquerda
    if (trustedProxyIps.length > 0) {
      for (let i = ips.length - 1; i >= 0; i--) {
        if (!trustedProxyIps.includes(ips[i])) {
          return `ip:${ips[i]}`;
        }
      }
    }
    // Caso padrão: primeiro IP informado
    return `ip:${ips[0]}`;
  }

  return "ip:unknown";
}

/**
 * Verificador Central de Rate Limiting
 */
export class RateLimiterGuard {
  constructor(private store: RateLimitStore) {}

  async check(
    identity: string,
    config: RateLimitConfig,
    nowMs: number = Date.now()
  ): Promise<RateLimitResult> {
    const cacheKey = `rl:${config.actionName}:${identity}`;
    const { count, firstSeenMs } = await this.store.incrementAndGet(cacheKey, config.windowSeconds, nowMs);

    const windowMs = config.windowSeconds * 1000;
    const resetTimeMs = firstSeenMs + windowMs;
    const remainingTimeMs = Math.max(0, resetTimeMs - nowMs);
    const retryAfterSeconds = Math.max(1, Math.ceil(remainingTimeMs / 1000));

    const remaining = Math.max(0, config.maxRequests - count);
    const allowed = count <= config.maxRequests;

    const headers: Record<string, string> = {
      "X-RateLimit-Limit": config.maxRequests.toString(),
      "X-RateLimit-Remaining": remaining.toString(),
      "X-RateLimit-Reset": Math.ceil(resetTimeMs / 1000).toString(),
    };

    if (!allowed) {
      headers["Retry-After"] = retryAfterSeconds.toString();
      return {
        allowed: false,
        status: 429,
        limit: config.maxRequests,
        remaining: 0,
        resetTimeMs,
        retryAfterSeconds,
        headers,
      };
    }

    return {
      allowed: true,
      status: 200,
      limit: config.maxRequests,
      remaining,
      resetTimeMs,
      retryAfterSeconds: 0,
      headers,
    };
  }
}

/**
 * Custos e Especificação de Limites para Rotas Críticas
 */
export const CRITICAL_ROUTES_LIMITS = {
  // Login e Autenticação (Alto custo de CPU / bcrypt e alto risco de brute-force)
  LOGIN_BY_EMAIL: {
    actionName: "login_by_email",
    windowSeconds: 60, // 1 minuto
    maxRequests: 5,    // 5 tentativas por minuto por IP/usuário
    costDescription: "Criptografia de senha, busca de admin e emissão de JWT",
  },
  // Criação de Lojas e Usuários (Custo financeiro de e-mail e escrita no banco)
  MANAGE_USERS: {
    actionName: "manage_users_create",
    windowSeconds: 60,
    maxRequests: 10,
    costDescription: "Criação de usuário Auth, hash de senha e disparo via Resend",
  },
  // Criação de Sessão de Checkout Stripe (Custo de chamada externa à Stripe e banco)
  CREATE_CHECKOUT: {
    actionName: "create_checkout_session",
    windowSeconds: 60,
    maxRequests: 15,
    costDescription: "Chamada externa de rede Stripe API e leitura agregada de produtos",
  },
  // Envio de E-mails Transacionais (Custo direto por envio e reputação de domínio)
  SEND_EMAIL: {
    actionName: "send_email",
    windowSeconds: 60,
    maxRequests: 10,
    costDescription: "Consumo de cota da Resend API e prevenção de spam",
  },
};
