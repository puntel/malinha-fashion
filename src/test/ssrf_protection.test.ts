import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  validateUrlForSsrf,
  isPrivateOrReservedIp,
  safeFetch,
} from "@/lib/safe-fetch";

describe("Auditoria de SSRF: Validação de Destinos Externos, Loopback, IPv6, Redirecionamento e DNS", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe("1. Bloqueio de Endereços de Loopback (IPv4)", () => {
    it("deve bloquear http://127.0.0.1 e localhost", async () => {
      const res1 = await validateUrlForSsrf("http://127.0.0.1/admin");
      expect(res1.valid).toBe(false);
      expect(res1.reason).toContain("BLOCKED_HOSTNAME");

      const res2 = await validateUrlForSsrf("http://localhost:8080/internal");
      expect(res2.valid).toBe(false);
      expect(res2.reason).toContain("BLOCKED_HOSTNAME");
    });

    it("deve bloquear variações de loopback como 127.0.0.2, 127.127.127.127 e 0.0.0.0", async () => {
      const res1 = await validateUrlForSsrf("http://127.0.0.2/api");
      expect(res1.valid).toBe(false);
      expect(res1.reason).toContain("BLOCKED_PRIVATE_IP");

      const res2 = await validateUrlForSsrf("http://127.127.127.127:80/");
      expect(res2.valid).toBe(false);
      expect(res2.reason).toContain("BLOCKED_PRIVATE_IP");

      const res3 = await validateUrlForSsrf("http://0.0.0.0/");
      expect(res3.valid).toBe(false);
      expect(res3.reason).toContain("BLOCKED_HOSTNAME");
    });
  });

  describe("2. Bloqueio de Endereços IPv6 (Loopback, Link-Local, Mapped IPv4)", () => {
    it("deve bloquear loopback IPv6 [::1]", async () => {
      const res = await validateUrlForSsrf("http://[::1]/internal-dashboard");
      expect(res.valid).toBe(false);
      expect(res.reason).toMatch(/BLOCKED_HOSTNAME|BLOCKED_PRIVATE_IP/);
    });

    it("deve bloquear IPv6 link-local fe80::", async () => {
      const isBlocked = isPrivateOrReservedIp("fe80::1");
      expect(isBlocked).toBe(true);

      const res = await validateUrlForSsrf("http://[fe80::1]/secrets");
      expect(res.valid).toBe(false);
    });

    it("deve bloquear IPv4-mapped IPv6 (ex: ::ffff:127.0.0.1 e ::ffff:169.254.169.254)", async () => {
      expect(isPrivateOrReservedIp("::ffff:127.0.0.1")).toBe(true);
      expect(isPrivateOrReservedIp("::ffff:169.254.169.254")).toBe(true);

      const res = await validateUrlForSsrf("http://[::ffff:127.0.0.1]/");
      expect(res.valid).toBe(false);
    });
  });

  describe("3. Bloqueio de Redes Privadas (RFC 1918) e Metadados da Nuvem (Link-Local)", () => {
    it("deve bloquear rede 10.0.0.0/8 (Classe A privada)", async () => {
      const res = await validateUrlForSsrf("http://10.0.0.1:80/status");
      expect(res.valid).toBe(false);
      expect(res.reason).toContain("BLOCKED_PRIVATE_IP");
    });

    it("deve bloquear rede 172.16.0.0/12 (Classe B privada)", async () => {
      const res1 = await validateUrlForSsrf("http://172.16.0.10:80/db");
      expect(res1.valid).toBe(false);
      expect(res1.reason).toContain("BLOCKED_PRIVATE_IP");

      const res2 = await validateUrlForSsrf("http://172.31.255.254:80/");
      expect(res2.valid).toBe(false);
    });

    it("deve bloquear rede 192.168.0.0/16 (Classe C privada)", async () => {
      const res = await validateUrlForSsrf("http://192.168.1.1:80/router");
      expect(res.valid).toBe(false);
      expect(res.reason).toContain("BLOCKED_PRIVATE_IP");
    });

    it("deve bloquear endpoint de metadados de nuvem 169.254.169.254 e hostnames de metadados", async () => {
      const res1 = await validateUrlForSsrf("http://169.254.169.254/latest/meta-data/");
      expect(res1.valid).toBe(false);
      expect(res1.reason).toContain("BLOCKED_PRIVATE_IP");

      const res2 = await validateUrlForSsrf("http://metadata.google.internal/computeMetadata/v1/");
      expect(res2.valid).toBe(false);
      expect(res2.reason).toContain("BLOCKED_HOSTNAME");
    });
  });

  describe("4. Restrição de Protocolos e Portas de Saída de Rede", () => {
    it("deve rejeitar protocolos inseguros (file://, gopher://, ftp://)", async () => {
      const res1 = await validateUrlForSsrf("file:///etc/passwd");
      expect(res1.valid).toBe(false);
      expect(res1.reason).toContain("DISALLOWED_PROTOCOL");

      const res2 = await validateUrlForSsrf("gopher://127.0.0.1:6379/_flushall");
      expect(res2.valid).toBe(false);
      expect(res2.reason).toContain("DISALLOWED_PROTOCOL");

      const res3 = await validateUrlForSsrf("ftp://example.com/file.png");
      expect(res3.valid).toBe(false);
      expect(res3.reason).toContain("DISALLOWED_PROTOCOL");
    });

    it("deve rejeitar portas internas sensíveis (SSH 22, Postgres 5432, Redis 6379, etc)", async () => {
      const res1 = await validateUrlForSsrf("http://example.com:22/banner");
      expect(res1.valid).toBe(false);
      expect(res1.reason).toContain("DISALLOWED_PORT");

      const res2 = await validateUrlForSsrf("https://example.com:5432/");
      expect(res2.valid).toBe(false);
      expect(res2.reason).toContain("DISALLOWED_PORT");

      const res3 = await validateUrlForSsrf("http://example.com:6379/");
      expect(res3.valid).toBe(false);
      expect(res3.reason).toContain("DISALLOWED_PORT");
    });
  });

  describe("5. Prevenção de Redirecionamento Malicioso (Open Redirect / 302 Bypass)", () => {
    it("deve interceptar redirect 302 para IP privado e abortar com erro de SSRF", async () => {
      // Mock do fetch: 1ª chamada retorna redirect 302 para 127.0.0.1
      globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
        if (url === "https://public-service.example.com/redirect-me") {
          return new Response(null, {
            status: 302,
            headers: { Location: "http://127.0.0.1/admin-secret" },
          });
        }
        return new Response("OK", { status: 200 });
      });

      await expect(
        safeFetch("https://public-service.example.com/redirect-me")
      ).rejects.toThrow("SSRF_BLOCKED: BLOCKED_HOSTNAME: 127.0.0.1");
    });

    it("deve interceptar redirect 301 para link-local de metadados 169.254.169.254", async () => {
      globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
        if (url === "https://public-service.example.com/metadata-jump") {
          return new Response(null, {
            status: 301,
            headers: { Location: "http://169.254.169.254/latest/meta-data/" },
          });
        }
        return new Response("OK", { status: 200 });
      });

      await expect(
        safeFetch("https://public-service.example.com/metadata-jump")
      ).rejects.toThrow("SSRF_BLOCKED: BLOCKED_PRIVATE_IP: 169.254.169.254");
    });
  });

  describe("6. Prevenção de DNS Rebinding / Mudança de DNS", () => {
    it("deve bloquear domínio com aparência pública cujo DNS resolve para IP privado", async () => {
      // Mock do resolver DNS que simula rebinding para 192.168.1.50
      const mockedDnsResolver = async (hostname: string) => {
        if (hostname === "rebind.attacker.example.com") {
          return ["192.168.1.50"];
        }
        return ["93.184.216.34"];
      };

      const res = await validateUrlForSsrf("http://rebind.attacker.example.com/api", {
        dnsResolver: mockedDnsResolver,
      });

      expect(res.valid).toBe(false);
      expect(res.reason).toContain("DNS_RESOLVED_TO_PRIVATE_IP");
      expect(res.resolvedIp).toBe("192.168.1.50");
    });
  });

  describe("7. Controle de Timeout e Proteção contra Slowloris", () => {
    it("deve abortar requisição quando o servidor de destino excede o tempo limite", async () => {
      // Mock de servidor que nunca responde (hanging connection)
      globalThis.fetch = vi.fn().mockImplementation((_url, init) => {
        return new Promise((_resolve, reject) => {
          if (init?.signal) {
            init.signal.addEventListener("abort", () => {
              const err = new Error("The operation was aborted");
              err.name = "AbortError";
              reject(err);
            });
          }
        });
      });

      await expect(
        safeFetch("https://public-service.example.com/slow-endpoint", {
          timeoutMs: 80, // Limite curto para o teste
        })
      ).rejects.toThrow("REQUEST_TIMEOUT: A requisição excedeu o tempo limite de 80ms.");
    });
  });

  describe("8. Limite de Tamanho de Resposta (Max Response Size / Anti-DoS)", () => {
    it("deve rejeitar respostas cujo Content-Length declarado exceda o limite máximo", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(
        new Response("Large body", {
          status: 200,
          headers: { "Content-Length": "10485760" }, // 10MB
        })
      );

      await expect(
        safeFetch("https://public-service.example.com/huge-image.jpg", {
          maxSizeBytes: 1024 * 1024, // Limite de 1MB
        })
      ).rejects.toThrow("PAYLOAD_TOO_LARGE: Tamanho declarado (10485760 bytes)");
    });

    it("deve rejeitar quando o corpo retornado sem Content-Length excede o limite de bytes", async () => {
      const hugeString = "X".repeat(50000); // 50KB

      globalThis.fetch = vi.fn().mockResolvedValue(
        new Response(hugeString, {
          status: 200,
          headers: {}, // Sem Content-Length
        })
      );

      await expect(
        safeFetch("https://public-service.example.com/stream-data", {
          maxSizeBytes: 10000, // Limite de 10KB
        })
      ).rejects.toThrow("RESPONSE_SIZE_EXCEEDED");
    });
  });

  describe("9. Destino Legítimo Autorizado", () => {
    it("deve permitir requisições para domínios públicos válidos dentro das regras", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ id: "resend-msg-123" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      );

      const res = await safeFetch("https://api.resend.com/emails", {
        allowedDomains: ["resend.com"],
        timeoutMs: 2000,
      });

      expect(res.ok).toBe(true);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.id).toBe("resend-msg-123");
    });
  });
});
