import { describe, it, expect } from "vitest";
import {
  formatErrorResponse,
  sanitizeLogData,
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  InternalServerError,
} from "@/lib/error-handler";

describe("Auditoria de Tratamento de Erros, Sanitização de Respostas e Auditoria de Logs", () => {
  describe("1. Exceção Controlada de Banco de Dados: Inspeção de Status, Corpo e Headers", () => {
    it("deve responder com status 500, header X-Request-Id e corpo limpo sem vazar SQL, stack ou credenciais", () => {
      // Força uma exceção crítica contendo dados altamente sensíveis
      const rawDbException = new Error(
        "QueryFailed: Connection to postgresql://postgres:SuperSecretPassword123@db.supabase.co:5432/postgres failed while executing:\n" +
          "SELECT id, owner_email, hashed_password FROM public.lojas WHERE secret_key = 'sk_live_xyz';\n" +
          "at Connection.parse (/app/node_modules/pg/lib/connection.js:614:11)\n" +
          "at Query.handleError (/app/src/db/client.ts:45:9)"
      );

      const requestHeaders = {
        "x-request-id": "req-auditoria-5555",
      };

      const contextPayload = {
        owner_email: "proprietario@loja.com",
        owner_password: "SenhaSuperSecreta!2026",
        authorization: "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.fake_token_payload",
      };

      const result = formatErrorResponse(rawDbException, requestHeaders, contextPayload);

      // --- INSPEÇÃO DE STATUS ---
      expect(result.status).toBe(500);

      // --- INSPEÇÃO DE HEADERS ---
      expect(result.headers["Content-Type"]).toBe("application/json");
      expect(result.headers["X-Request-Id"]).toBe("req-auditoria-5555");

      // --- INSPEÇÃO DO CORPO ENVIADO AO CLIENTE ---
      const bodyJson = JSON.stringify(result.body);

      // 1. Confirma presença de campos seguros
      expect(result.body.error).toBe("InternalServerError");
      expect(result.body.message).toBe("Ocorreu um erro interno. Por favor, tente novamente mais tarde.");
      expect(result.body.requestId).toBe("req-auditoria-5555");

      // 2. Garante ausência total de vazamento de SQL
      expect(bodyJson).not.toContain("SELECT");
      expect(bodyJson).not.toContain("FROM public.lojas");
      expect(bodyJson).not.toContain("hashed_password");

      // 3. Garante ausência total de Stack Trace e caminhos de arquivos
      expect(bodyJson).not.toContain("at Connection.parse");
      expect(bodyJson).not.toContain("/app/node_modules");
      expect(bodyJson).not.toContain("client.ts");
      expect(bodyJson).not.toContain(".js:");

      // 4. Garante ausência de credenciais e strings de conexão
      expect(bodyJson).not.toContain("SuperSecretPassword123");
      expect(bodyJson).not.toContain("postgresql://");
      expect(bodyJson).not.toContain("sk_live_xyz");
    });
  });

  describe("2. Correlação por RequestId em Logs Restritos", () => {
    it("deve permitir que o requestId correlacione a ocorrência nos logs internos para auditoria", () => {
      const internalError = new Error("Deadlock detected on table sales_transactions");
      const clientHeaders = { "x-request-id": "req-trace-uuid-999" };

      const result = formatErrorResponse(internalError, clientHeaders);

      // O cliente recebe apenas o ID de correlação
      expect(result.body.requestId).toBe("req-trace-uuid-999");

      // No log interno restrito, o evento completo é indexado pelo mesmo ID
      expect(result.internalLog.requestId).toBe("req-trace-uuid-999");
      expect(result.internalLog.level).toBe("ERROR");
      expect(result.internalLog.statusCode).toBe(500);
      expect(result.internalLog.rawMessage).toBe("Deadlock detected on table sales_transactions");
      expect(result.internalLog.timestamp).toBeDefined();
    });

    it("deve gerar automaticamente um UUID de requestId caso a requisição não envie", () => {
      const error = new Error("Generic failure");
      const result = formatErrorResponse(error); // Sem headers

      expect(result.body.requestId).toBeDefined();
      expect(result.body.requestId).toMatch(/^req-[0-9a-f-]{36}$/);
      expect(result.headers["X-Request-Id"]).toBe(result.body.requestId);
      expect(result.internalLog.requestId).toBe(result.body.requestId);
    });
  });

  describe("3. Mascaramento e Sanitização de Logs (Tokens, Senhas e Dados Pessoais)", () => {
    it("deve mascarar senhas, tokens Bearer, chaves e CPFs nos dados gravados em log", () => {
      const sensitiveContext = {
        owner_name: "Ana Oliveira",
        owner_email: "ana@moda.com.br",
        cpf: "123.456.789-01",
        owner_password: "PlainTextPassword#123",
        temporaryPassword: "Ml#temp123A1",
        authorization: "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.token_sensivel_completo",
        credit_card: "4532111122223333",
        cvv: "888",
        connectionString: "postgres://admin:MasterPassSecret@cluster-pg.internal:5432/db",
      };

      const sanitized = sanitizeLogData(sensitiveContext);

      // Senhas e credenciais mascaradas
      expect(sanitized.owner_password).toBe("[REDACTED]");
      expect(sanitized.temporaryPassword).toBe("[REDACTED]");
      expect(sanitized.cvv).toBe("[REDACTED]");
      expect(sanitized.credit_card).toBe("[REDACTED]");

      // Token mascarado
      expect(sanitized.authorization).toBe("[REDACTED_TOKEN]");

      // CPF parcialmente mascarado para proteção de dados pessoais
      expect(sanitized.cpf).toBe("***.***.789-**");

      // Senha dentro de URL mascarada
      expect(sanitized.connectionString).toBe("postgres://admin:[REDACTED_PASSWORD]@cluster-pg.internal:5432/db");

      // Dados não sensíveis de auditoria mantidos
      expect(sanitized.owner_name).toBe("Ana Oliveira");
      expect(sanitized.owner_email).toBe("ana@moda.com.br");
    });
  });

  describe("4. Preservação de Códigos Semânticos HTTP (400, 401, 403, 404 vs 500)", () => {
    it("deve retornar 400 Bad Request para erros de validação e não converter em 500", () => {
      const err = new BadRequestError("O campo 'loja_name' é obrigatório.", { field: "loja_name" });
      const result = formatErrorResponse(err);

      expect(result.status).toBe(400);
      expect(result.body.error).toBe("BadRequestError");
      expect(result.body.message).toBe("O campo 'loja_name' é obrigatório.");
      expect(result.body.details).toEqual({ field: "loja_name" });
      expect(result.internalLog.level).toBe("WARN"); // Não polui log como ERROR
    });

    it("deve retornar 401 Unauthorized para token expirado/ausente e não converter em 500", () => {
      const err = new UnauthorizedError("Sessão expirada. Por favor, autentique-se novamente.");
      const result = formatErrorResponse(err);

      expect(result.status).toBe(401);
      expect(result.body.error).toBe("UnauthorizedError");
      expect(result.body.message).toBe("Sessão expirada. Por favor, autentique-se novamente.");
    });

    it("deve retornar 403 Forbidden para permissão insuficiente e não converter em 500", () => {
      const err = new ForbiddenError("Usuário sem permissão para acessar relatórios gerenciais.");
      const result = formatErrorResponse(err);

      expect(result.status).toBe(403);
      expect(result.body.error).toBe("ForbiddenError");
      expect(result.body.message).toBe("Usuário sem permissão para acessar relatórios gerenciais.");
    });

    it("deve retornar 404 Not Found para recursos não encontrados e não converter em 500", () => {
      const err = new NotFoundError("Produto ID 'prod-999' não foi encontrado.");
      const result = formatErrorResponse(err);

      expect(result.status).toBe(404);
      expect(result.body.error).toBe("NotFoundError");
      expect(result.body.message).toBe("Produto ID 'prod-999' não foi encontrado.");
    });

    it("deve retornar 500 Internal Server Error apenas para falhas de infraestrutura e exceções não tratadas", () => {
      const unhandledException = new TypeError("Cannot read properties of undefined (reading 'split')");
      const result = formatErrorResponse(unhandledException);

      expect(result.status).toBe(500);
      expect(result.body.error).toBe("InternalServerError");
      // Mensagem genérica segura entregue ao cliente
      expect(result.body.message).toBe("Ocorreu um erro interno. Por favor, tente novamente mais tarde.");
      expect(result.internalLog.level).toBe("ERROR");
    });
  });
});
