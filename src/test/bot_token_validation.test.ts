import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  verifyBotProtectionToken,
  sanitizeLoginErrorMessage,
  GENERIC_LOGIN_ERROR_MESSAGE,
} from "@/lib/bot-protection";

describe("Auditoria de Proteção Anti-Bot, Validação de Tokens de Desafio e Anti-Enumeração", () => {
  const EXPECTED_ACTION = "create_loja";
  const EXPECTED_HOSTNAMES = ["malinhafashion.com.br", "localhost"];
  const TEST_SECRET_KEY = "1x0000000000000000000000000000000AA"; // Chave de teste oficial Cloudflare

  // Banco de dados simulado para confirmar se contas foram criadas
  let simulatedUserAccounts: Array<{ email: string; lojaName: string }>;

  beforeEach(() => {
    vi.restoreAllMocks();
    simulatedUserAccounts = [];
  });

  // Handler simulado do endpoint /manage-users (action: create_loja) com validação de token
  async function handleCreateLojaEndpoint(
    body: {
      loja_name: string;
      owner_email: string;
      captcha_token?: string | null;
    },
    fetchClient: typeof fetch
  ) {
    // 1. Validação obrigatória do token anti-bot no backend
    const verification = await verifyBotProtectionToken({
      token: body.captcha_token,
      expectedAction: EXPECTED_ACTION,
      expectedHostnames: EXPECTED_HOSTNAMES,
      secretKey: TEST_SECRET_KEY,
      fetchClient,
    });

    if (!verification.valid) {
      return {
        status: 400,
        error: verification.errorCode,
        message: verification.errorMessage,
        accountCreated: false,
      };
    }

    // 2. Se e somente se o token for válido, persiste a conta no banco
    simulatedUserAccounts.push({
      email: body.owner_email,
      lojaName: body.loja_name,
    });

    return {
      status: 200,
      accountCreated: true,
      data: { id: "loja-uuid-123" },
    };
  }

  describe("1. Token Ausente", () => {
    it("deve REJEITAR requisições sem token anti-bot e NÃO criar conta", async () => {
      const mockFetch = vi.fn();

      const res = await handleCreateLojaEndpoint(
        {
          loja_name: "Loja Bot Atacante",
          owner_email: "bot@spam.com",
          captcha_token: null, // Ausência total do token
        },
        mockFetch
      );

      expect(res.status).toBe(400);
      expect(res.error).toBe("MISSING_CAPTCHA_TOKEN");
      expect(res.accountCreated).toBe(false);
      // Nenhuma conta foi persistida no banco
      expect(simulatedUserAccounts.length).toBe(0);
      // O backend sequer gasta requisição externa com o provedor se o token não veio
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("deve rejeitar tokens vazios ou contendo apenas espaços em branco", async () => {
      const mockFetch = vi.fn();

      const res = await handleCreateLojaEndpoint(
        {
          loja_name: "Loja Bot",
          owner_email: "bot2@spam.com",
          captcha_token: "   ",
        },
        mockFetch
      );

      expect(res.status).toBe(400);
      expect(res.error).toBe("MISSING_CAPTCHA_TOKEN");
      expect(simulatedUserAccounts.length).toBe(0);
    });
  });

  describe("2. Token Inválido", () => {
    it("deve REJEITAR quando a API do provedor retornar success: false e NÃO criar conta", async () => {
      // Mock do provedor retornando token forjado / inválido
      const mockFetch = vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            success: false,
            "error-codes": ["invalid-input-response"],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      );

      const res = await handleCreateLojaEndpoint(
        {
          loja_name: "Loja Forjada",
          owner_email: "fake@domain.com",
          captcha_token: "token_forjado_aleatorio_xyz",
        },
        mockFetch
      );

      expect(res.status).toBe(400);
      expect(res.error).toBe("invalid-input-response");
      expect(res.accountCreated).toBe(false);
      expect(simulatedUserAccounts.length).toBe(0);
    });
  });

  describe("3. Token Expirado (challenge_ts)", () => {
    it("deve REJEITAR token com data de desafio superior ao limite de 300 segundos", async () => {
      const expiredTimestamp = new Date(Date.now() - 600 * 1000).toISOString(); // 10 minutos atrás

      const mockFetch = vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            success: true,
            action: EXPECTED_ACTION,
            hostname: "localhost",
            challenge_ts: expiredTimestamp,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      );

      const res = await handleCreateLojaEndpoint(
        {
          loja_name: "Loja Token Velho",
          owner_email: "velho@domain.com",
          captcha_token: "token_expirado_123",
        },
        mockFetch
      );

      expect(res.status).toBe(400);
      expect(res.error).toBe("TOKEN_EXPIRED");
      expect(res.accountCreated).toBe(false);
      expect(simulatedUserAccounts.length).toBe(0);
    });
  });

  describe("4. Token Reutilizado (Replay Attack)", () => {
    it("deve bloquear a segunda submissão do mesmo token anti-bot", async () => {
      const singleUseToken = "valid_token_single_use_abc_999";
      const validTimestamp = new Date().toISOString();

      const mockFetch = vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            success: true,
            action: EXPECTED_ACTION,
            hostname: "localhost",
            challenge_ts: validTimestamp,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      );

      // 1ª requisição (legítima)
      const res1 = await handleCreateLojaEndpoint(
        {
          loja_name: "Loja Legítima",
          owner_email: "loja1@domain.com",
          captcha_token: singleUseToken,
        },
        mockFetch
      );
      expect(res1.status).toBe(200);
      expect(res1.accountCreated).toBe(true);
      expect(simulatedUserAccounts.length).toBe(1);

      // 2ª requisição (tentativa de replay do mesmo token)
      const res2 = await handleCreateLojaEndpoint(
        {
          loja_name: "Segunda Loja Replay",
          owner_email: "loja2@domain.com",
          captcha_token: singleUseToken,
        },
        mockFetch
      );

      expect(res2.status).toBe(400);
      expect(res2.error).toBe("TOKEN_ALREADY_USED");
      expect(res2.accountCreated).toBe(false);
      // Nenhuma conta adicional foi criada
      expect(simulatedUserAccounts.length).toBe(1);
    });
  });

  describe("5. Falha do Provedor de Verificação (Fail Closed)", () => {
    it("deve REJEITAR a criação de conta se o provedor retornar erro HTTP 500", async () => {
      const mockFetch = vi.fn().mockResolvedValue(
        new Response("Internal Server Error", { status: 500 })
      );

      const res = await handleCreateLojaEndpoint(
        {
          loja_name: "Loja Teste",
          owner_email: "teste@domain.com",
          captcha_token: "any_token",
        },
        mockFetch
      );

      expect(res.status).toBe(400);
      expect(res.error).toBe("PROVIDER_HTTP_ERROR");
      expect(res.accountCreated).toBe(false);
      expect(simulatedUserAccounts.length).toBe(0);
    });

    it("deve REJEITAR se houver falha de rede/timeout na conexão com o provedor", async () => {
      const mockFetch = vi.fn().mockRejectedValue(new Error("Connection reset by peer"));

      const res = await handleCreateLojaEndpoint(
        {
          loja_name: "Loja Teste",
          owner_email: "teste@domain.com",
          captcha_token: "any_token",
        },
        mockFetch
      );

      expect(res.status).toBe(400);
      expect(res.error).toBe("PROVIDER_CONNECTION_FAILED");
      expect(res.accountCreated).toBe(false);
      expect(simulatedUserAccounts.length).toBe(0);
    });
  });

  describe("6. Validação de Hostname e Action", () => {
    it("deve REJEITAR token gerado para hostname não autorizado (ex: phishing ou outro domínio)", async () => {
      const mockFetch = vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            success: true,
            action: EXPECTED_ACTION,
            hostname: "evil-phishing-site.com", // Hostname divergente
            challenge_ts: new Date().toISOString(),
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      );

      const res = await handleCreateLojaEndpoint(
        {
          loja_name: "Loja Phishing",
          owner_email: "phish@domain.com",
          captcha_token: "token_outro_site",
        },
        mockFetch
      );

      expect(res.status).toBe(400);
      expect(res.error).toBe("HOSTNAME_MISMATCH");
      expect(res.accountCreated).toBe(false);
      expect(simulatedUserAccounts.length).toBe(0);
    });

    it("deve REJEITAR token gerado para uma Action diferente (ex: contact_form usado em create_loja)", async () => {
      const mockFetch = vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            success: true,
            action: "contact_form", // Ação diferente da esperada
            hostname: "localhost",
            challenge_ts: new Date().toISOString(),
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      );

      const res = await handleCreateLojaEndpoint(
        {
          loja_name: "Loja Action Incorreta",
          owner_email: "action@domain.com",
          captcha_token: "token_contact_form",
        },
        mockFetch
      );

      expect(res.status).toBe(400);
      expect(res.error).toBe("ACTION_MISMATCH");
      expect(res.accountCreated).toBe(false);
      expect(simulatedUserAccounts.length).toBe(0);
    });
  });

  describe("7. Caso Válido (Happy Path)", () => {
    it("deve ACEITAR requisição com token íntegro e criar a conta no banco com sucesso", async () => {
      const mockFetch = vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            success: true,
            action: EXPECTED_ACTION,
            hostname: "malinhafashion.com.br",
            challenge_ts: new Date().toISOString(),
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      );

      const res = await handleCreateLojaEndpoint(
        {
          loja_name: "Boutique Elegance",
          owner_email: "contato@elegance.com.br",
          captcha_token: "valid_turnstile_token_success_777",
        },
        mockFetch
      );

      expect(res.status).toBe(200);
      expect(res.accountCreated).toBe(true);
      expect(simulatedUserAccounts.length).toBe(1);
      expect(simulatedUserAccounts[0].email).toBe("contato@elegance.com.br");
    });
  });

  describe("8. Revisão de Mensagens de Login e Prevenção de Enumeração de Usuários", () => {
    it("deve retornar mensagem genérica e idêntica tanto para e-mail inexistente quanto para senha incorreta", () => {
      // Simula erros internos de autenticação
      const erroEmailInexistente = "E-mail não cadastrado no sistema.";
      const erroSenhaIncorreta = "Invalid login credentials: password incorrect";

      const msg1 = sanitizeLoginErrorMessage(erroEmailInexistente);
      const msg2 = sanitizeLoginErrorMessage(erroSenhaIncorreta);

      // Ambas as respostas devem ser indistinguíveis para o atacante
      expect(msg1).toBe(GENERIC_LOGIN_ERROR_MESSAGE);
      expect(msg2).toBe(GENERIC_LOGIN_ERROR_MESSAGE);
      expect(msg1).toBe(msg2);
      expect(msg1).not.toContain("não cadastrado");
      expect(msg1).not.toContain("password");
    });
  });
});
