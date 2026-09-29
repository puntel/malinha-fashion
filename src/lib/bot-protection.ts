/**
 * Módulo de Proteção Anti-Bot e Validação de Tokens de Desafio (Cloudflare Turnstile / reCAPTCHA)
 * Garante validação obrigatória no servidor antes da criação de contas ou autenticação.
 */

export interface VerifyTokenOptions {
  token?: string | null;
  expectedAction: string;
  expectedHostnames: string[];
  clientIp?: string;
  secretKey?: string;
  maxAgeSeconds?: number;
  fetchClient?: typeof fetch;
}

export interface VerificationResult {
  valid: boolean;
  errorCode?: string;
  errorMessage?: string;
  challengeTs?: string;
  hostname?: string;
  action?: string;
}

// Cache local para prevenção de Replay Attacks (reutilização de tokens)
const USED_TOKENS_CACHE = new Map<string, number>();

/**
 * Limpa tokens expirados do cache de reutilização
 */
export function pruneUsedTokens(nowMs: number = Date.now(), ttlMs: number = 300_000): void {
  for (const [token, timestamp] of USED_TOKENS_CACHE.entries()) {
    if (nowMs - timestamp > ttlMs) {
      USED_TOKENS_CACHE.delete(token);
    }
  }
}

/**
 * Valida o token do desafio no backend junto à API do provedor (Cloudflare Turnstile / reCAPTCHA).
 */
export async function verifyBotProtectionToken(
  options: VerifyTokenOptions
): Promise<VerificationResult> {
  const {
    token,
    expectedAction,
    expectedHostnames,
    clientIp,
    secretKey = "1x0000000000000000000000000000000AA", // Chave de teste padrão
    maxAgeSeconds = 300, // 5 minutos de validade máxima
    fetchClient = globalThis.fetch,
  } = options;

  // 1. Verificação de Token Ausente
  if (!token || typeof token !== "string" || token.trim().length === 0) {
    return {
      valid: false,
      errorCode: "MISSING_CAPTCHA_TOKEN",
      errorMessage: "Token de verificação anti-bot ausente na requisição.",
    };
  }

  const trimmedToken = token.trim();

  // 2. Prevenção de Reutilização de Token (Replay Attack)
  pruneUsedTokens();
  if (USED_TOKENS_CACHE.has(trimmedToken)) {
    return {
      valid: false,
      errorCode: "TOKEN_ALREADY_USED",
      errorMessage: "Este token de verificação já foi utilizado anteriormente.",
    };
  }

  // 3. Chamada à API de Validação do Provedor (ex: Cloudflare Turnstile siteverify)
  let providerResponse: any;
  try {
    const formData = new URLSearchParams();
    formData.append("secret", secretKey);
    formData.append("response", trimmedToken);
    if (clientIp) {
      formData.append("remoteip", clientIp);
    }

    const res = await fetchClient("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body: formData,
    });

    if (!res.ok) {
      return {
        valid: false,
        errorCode: "PROVIDER_HTTP_ERROR",
        errorMessage: `Falha na comunicação com o provedor de verificação (HTTP ${res.status}).`,
      };
    }

    providerResponse = await res.json();
  } catch (err: any) {
    // Fail Closed: Em caso de falha de infraestrutura, bloqueia a criação de contas críticas
    return {
      valid: false,
      errorCode: "PROVIDER_CONNECTION_FAILED",
      errorMessage: `Erro de rede ao validar token com o provedor: ${err.message}`,
    };
  }

  // 4. Verificação de Sucesso Retornado pelo Provedor
  if (!providerResponse || !providerResponse.success) {
    const errorCodes = providerResponse?.["error-codes"] || ["INVALID_TOKEN"];
    return {
      valid: false,
      errorCode: errorCodes[0] || "TOKEN_VERIFICATION_FAILED",
      errorMessage: "O token anti-bot informado é inválido ou foi rejeitado pelo provedor.",
    };
  }

  // 5. Verificação da Action do Widget
  if (providerResponse.action && providerResponse.action !== expectedAction) {
    return {
      valid: false,
      errorCode: "ACTION_MISMATCH",
      errorMessage: `A ação do token (${providerResponse.action}) não corresponde à ação esperada (${expectedAction}).`,
      action: providerResponse.action,
    };
  }

  // 6. Verificação do Hostname
  if (providerResponse.hostname) {
    const normalizedHost = providerResponse.hostname.toLowerCase();
    const isHostAllowed = expectedHostnames.some(
      (h) => normalizedHost === h.toLowerCase() || normalizedHost.endsWith(`.${h.toLowerCase()}`)
    );

    if (!isHostAllowed) {
      return {
        valid: false,
        errorCode: "HOSTNAME_MISMATCH",
        errorMessage: `O token foi gerado para o hostname não autorizado '${providerResponse.hostname}'.`,
        hostname: providerResponse.hostname,
      };
    }
  }

  // 7. Verificação de Expiração Temporal (challenge_ts)
  if (providerResponse.challenge_ts) {
    const challengeTime = new Date(providerResponse.challenge_ts).getTime();
    const now = Date.now();
    const ageSeconds = (now - challengeTime) / 1000;

    if (ageSeconds > maxAgeSeconds) {
      return {
        valid: false,
        errorCode: "TOKEN_EXPIRED",
        errorMessage: `Token expirado (gerado há ${Math.round(ageSeconds)}s, limite ${maxAgeSeconds}s).`,
        challengeTs: providerResponse.challenge_ts,
      };
    }
  }

  // Registra o token no cache para impedir reutilização
  USED_TOKENS_CACHE.set(trimmedToken, Date.now());

  return {
    valid: true,
    action: providerResponse.action,
    hostname: providerResponse.hostname,
    challengeTs: providerResponse.challenge_ts,
  };
}

/**
 * Mensagem de erro de login genérica e resistente a enumeração de usuários.
 */
export const GENERIC_LOGIN_ERROR_MESSAGE = "Credenciais inválidas ou conta não encontrada.";

/**
 * Validador de resposta de autenticação: Sanitiza mensagens para evitar enumeração.
 */
export function sanitizeLoginErrorMessage(rawError?: string): string {
  if (!rawError) return GENERIC_LOGIN_ERROR_MESSAGE;

  const lower = rawError.toLowerCase();
  // Se o erro interno indicar usuário inexistente ou senha incorreta, substitui pela mensagem genérica
  if (
    lower.includes("não cadastrado") ||
    lower.includes("not found") ||
    lower.includes("invalid password") ||
    lower.includes("user not found") ||
    lower.includes("incorrect password")
  ) {
    return GENERIC_LOGIN_ERROR_MESSAGE;
  }

  return GENERIC_LOGIN_ERROR_MESSAGE;
}
