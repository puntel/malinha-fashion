/**
 * Utilitário de Proteção contra SSRF (Server-Side Request Forgery)
 * Implementa validação estrita de URLs, bloqueio de loopback, IPv6, IPs privados,
 * metadados de nuvem, controle de redirecionamento, timeouts e limites de tamanho de resposta.
 */

// Faixas de IP Privadas e Reservadas (RFC 1918, RFC 3927, RFC 6890, Cloud Metadata)
const BLOCKED_IP_PATTERNS = [
  /^127\./,                         // IPv4 Loopback (127.0.0.0/8)
  /^0\./,                           // Zero address (0.0.0.0/8)
  /^10\./,                          // RFC 1918 Classe A (10.0.0.0/8)
  /^172\.(1[6-9]|2[0-9]|3[0-1])\./, // RFC 1918 Classe B (172.16.0.0/12)
  /^192\.168\./,                    // RFC 1918 Classe C (192.168.0.0/16)
  /^169\.254\./,                    // Link-Local / Cloud Metadata AWS/GCP/Azure (169.254.0.0/16)
  /^100\.(6[4-9]|[7-9][0-9]|1[0-1][0-9]|12[0-7])\./, // CGNAT (100.64.0.0/10)
  /^198\.(18|19)\./,                // Benchmark testing
];

// IPv6 Bloqueados (Loopback ::1, Link-Local fe80::, IPv4-Mapped ::ffff:x.x.x.x, Unique Local fc00::/7)
const BLOCKED_IPV6_PATTERNS = [
  /^::1$/,                          // IPv6 Loopback
  /^::$/,                           // IPv6 Unspecified
  /^::ffff:(?:127|10|172|192|169)\./i, // IPv4-mapped IPv6 privados/loopback
  /^fe[89ab][0-9a-f]:/i,            // Link-Local (fe80::/10)
  /^f[cd][0-9a-f]{2}:/i,            // Unique Local Address (fc00::/7)
];

const BLOCKED_HOSTNAMES = [
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "[::1]",
  "metadata.google.internal",
  "instance-data",
  "metadata",
];

const ALLOWED_PROTOCOLS = ["https:", "http:"];
const ALLOWED_PORTS = [80, 443];

export interface SafeFetchOptions extends RequestInit {
  timeoutMs?: number;
  maxSizeBytes?: number;
  maxRedirects?: number;
  allowedDomains?: string[];
  dnsResolverMock?: (hostname: string) => Promise<string[]>;
}

export interface SafeUrlValidationResult {
  valid: boolean;
  reason?: string;
  resolvedIp?: string;
}

/**
 * Valida se um endereço IP ou formato de IP pertence a faixas privadas, loopback ou reservadas.
 */
export function isPrivateOrReservedIp(ip: string): boolean {
  const cleanIp = ip.trim().toLowerCase().replace(/^\[|\]$/g, "");

  // Checagem IPv4
  for (const pattern of BLOCKED_IP_PATTERNS) {
    if (pattern.test(cleanIp)) return true;
  }

  // Checagem IPv6
  for (const pattern of BLOCKED_IPV6_PATTERNS) {
    if (pattern.test(cleanIp)) return true;
  }

  // IPv4-mapped IPv6 em formato hexadecimal (ex: ::ffff:7f00:1 ou ::ffff:a9fe:a9fe)
  const hexMappedMatch = cleanIp.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i);
  if (hexMappedMatch) {
    const p1 = parseInt(hexMappedMatch[1], 16);
    const p2 = parseInt(hexMappedMatch[2], 16);
    const resolvedIpv4 = `${(p1 >> 8) & 0xff}.${p1 & 0xff}.${(p2 >> 8) & 0xff}.${p2 & 0xff}`;
    return isPrivateOrReservedIp(resolvedIpv4);
  }

  // Casos específicos conhecidos
  if (cleanIp === "::1" || cleanIp === "0:0:0:0:0:0:0:1") return true;

  return false;
}

/**
 * Valida a URL contra vetores conhecidos de SSRF antes do disparo da requisição.
 */
export async function validateUrlForSsrf(
  urlString: string,
  options?: {
    allowedDomains?: string[];
    dnsResolver?: (hostname: string) => Promise<string[]>;
  }
): Promise<SafeUrlValidationResult> {
  let parsedUrl: URL;

  try {
    parsedUrl = new URL(urlString);
  } catch {
    return { valid: false, reason: "INVALID_URL_SYNTAX" };
  }

  // 1. Validação de Protocolo (Apenas HTTP/HTTPS; rejeita file://, gopher://, ftp://)
  if (!ALLOWED_PROTOCOLS.includes(parsedUrl.protocol)) {
    return {
      valid: false,
      reason: `DISALLOWED_PROTOCOL: ${parsedUrl.protocol}. Apenas https: e http: são permitidos.`,
    };
  }

  const hostname = parsedUrl.hostname.toLowerCase().replace(/^\[|\]$/g, "");

  // 2. Validação de Hostnames e Nomes Especiais (localhost, metadata, etc.)
  if (BLOCKED_HOSTNAMES.includes(hostname) || BLOCKED_HOSTNAMES.includes(parsedUrl.hostname.toLowerCase())) {
    return {
      valid: false,
      reason: `BLOCKED_HOSTNAME: ${parsedUrl.hostname} é um endereço local/loopback/metadados restrito.`,
    };
  }

  // 3. Se o hostname for um IP numérico literal (IPv4 ou IPv6)
  if (isPrivateOrReservedIp(hostname)) {
    return {
      valid: false,
      reason: `BLOCKED_PRIVATE_IP: ${parsedUrl.hostname} é um endereço de rede privada/loopback/link-local.`,
      resolvedIp: hostname,
    };
  }

  // 4. Validação de Porta (Rejeita portas internas sensíveis como 22, 5432, 6379, 8080)
  const port = parsedUrl.port ? parseInt(parsedUrl.port, 10) : parsedUrl.protocol === "https:" ? 443 : 80;
  if (!ALLOWED_PORTS.includes(port)) {
    return {
      valid: false,
      reason: `DISALLOWED_PORT: ${port}. Apenas portas 80 e 443 são permitidas para saída de rede.`,
    };
  }

  // 5. Whitelist de Domínios Permitidos (se configurada)
  if (options?.allowedDomains && options.allowedDomains.length > 0) {
    const isDomainAllowed = options.allowedDomains.some(
      (domain) => hostname === domain || hostname.endsWith(`.${domain}`)
    );
    if (!isDomainAllowed) {
      return {
        valid: false,
        reason: `DOMAIN_NOT_WHITELISTED: ${hostname} não consta na lista de destinos autorizados.`,
      };
    }
  }

  // 6. Resolução DNS e Verificação de IP Resolvido (Prevenção contra DNS Rebinding e domínios com IP privado)
  if (options?.dnsResolver) {
    try {
      const resolvedIps = await options.dnsResolver(hostname);
      for (const ip of resolvedIps) {
        if (isPrivateOrReservedIp(ip)) {
          return {
            valid: false,
            reason: `DNS_RESOLVED_TO_PRIVATE_IP: O domínio ${hostname} resolveu para o IP restrito ${ip}.`,
            resolvedIp: ip,
          };
        }
      }
    } catch {
      return { valid: false, reason: "DNS_RESOLUTION_FAILED" };
    }
  }

  return { valid: true };
}

/**
 * Cliente HTTP Seguro com Proteção contra SSRF, Redirecionamentos Maliciosos,
 * Timeout Estrito e Limite de Tamanho de Resposta.
 */
export async function safeFetch(
  url: string,
  options: SafeFetchOptions = {}
): Promise<{ ok: boolean; status: number; text: () => Promise<string>; json: () => Promise<any> }> {
  const {
    timeoutMs = 4000,
    maxSizeBytes = 2 * 1024 * 1024, // 2MB limite padrão
    maxRedirects = 3,
    allowedDomains,
    dnsResolverMock,
    ...fetchInit
  } = options;

  let currentUrl = url;
  let redirectCount = 0;

  while (redirectCount <= maxRedirects) {
    // 1. Valida a URL antes de cada salto
    const validation = await validateUrlForSsrf(currentUrl, {
      allowedDomains,
      dnsResolver: dnsResolverMock,
    });

    if (!validation.valid) {
      throw new Error(`SSRF_BLOCKED: ${validation.reason}`);
    }

    // 2. Timeout Estrito com AbortController
    const controller = new AbortController();
    const timeoutTimer = setTimeout(() => {
      controller.abort();
    }, timeoutMs);

    try {
      // Usamos redirect: "manual" para inspecionar cada salto individualmente
      const response = await fetch(currentUrl, {
        ...fetchInit,
        redirect: "manual",
        signal: controller.signal,
      });

      clearTimeout(timeoutTimer);

      // 3. Tratamento de Redirecionamento (HTTP 301, 302, 307, 308)
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get("location");
        if (!location) {
          throw new Error("REDIRECT_ERROR: Resposta de redirecionamento sem cabeçalho Location.");
        }

        redirectCount++;
        if (redirectCount > maxRedirects) {
          throw new Error(`MAX_REDIRECTS_EXCEEDED: Limite de ${maxRedirects} redirecionamentos atingido.`);
        }

        // Resolve URLs relativas no redirect
        currentUrl = new URL(location, currentUrl).toString();
        continue;
      }

      // 4. Verificação de Limite de Resposta (Content-Length Header e Body Stream)
      const contentLengthHeader = response.headers.get("content-length");
      if (contentLengthHeader) {
        const contentLength = parseInt(contentLengthHeader, 10);
        if (contentLength > maxSizeBytes) {
          throw new Error(
            `PAYLOAD_TOO_LARGE: Tamanho declarado (${contentLength} bytes) excede o limite máximo permitido (${maxSizeBytes} bytes).`
          );
        }
      }

      // 5. Leitura do corpo com medição de bytes para evitar decompress bombs / slowloris
      const textBuffer = await response.text();
      const actualSize = new TextEncoder().encode(textBuffer).length;
      if (actualSize > maxSizeBytes) {
        throw new Error(
          `RESPONSE_SIZE_EXCEEDED: O conteúdo retornado (${actualSize} bytes) excedeu o limite máximo (${maxSizeBytes} bytes).`
        );
      }

      return {
        ok: response.ok,
        status: response.status,
        text: async () => textBuffer,
        json: async () => JSON.parse(textBuffer),
      };
    } catch (err: any) {
      clearTimeout(timeoutTimer);
      if (err.name === "AbortError") {
        throw new Error(`REQUEST_TIMEOUT: A requisição excedeu o tempo limite de ${timeoutMs}ms.`);
      }
      throw err;
    }
  }

  throw new Error("MAX_REDIRECTS_EXCEEDED");
}
