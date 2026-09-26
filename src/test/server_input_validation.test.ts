import { describe, it, expect } from "vitest";
import {
  CreateLojaSchema,
  CreateMasterSchema,
  CreateVendedoraSchema,
  CreateCheckoutSessionSchema,
  SendEmailSchema,
  validateUploadFile,
  MAX_FILE_SIZE_BYTES,
} from "@/lib/server-validation";

describe("Testes de Validação no Servidor e Rejeição de Campos Extras (Mass Assignment)", () => {
  describe("1. Endpoint /manage-users (Ação create_loja)", () => {
    it("deve rejeitar tipo errado no corpo da requisição (ex: loja_name numérico, email booleano)", () => {
      const payloadTipoErrado = {
        action: "create_loja",
        loja_name: 12345, // Tipo errado (esperado string)
        owner_name: "Proprietário Válido",
        owner_email: true, // Tipo errado (esperado string email)
      };

      const result = CreateLojaSchema.safeParse(payloadTipoErrado);
      expect(result.success).toBe(false);
      if (!result.success) {
        const errors = result.error.flatten().fieldErrors;
        expect(errors.loja_name).toBeDefined();
        expect(errors.owner_email).toBeDefined();
      }
    });

    it("deve rejeitar texto além do limite permitido (ex: loja_name ou email com 5.000 caracteres)", () => {
      const payloadTextoExcessivo = {
        action: "create_loja",
        loja_name: "A".repeat(5000), // Limite é 100 caracteres
        owner_name: "Proprietário Válido",
        owner_email: `${"b".repeat(1000)}@exemplo.com`, // Limite é 255
      };

      const result = CreateLojaSchema.safeParse(payloadTextoExcessivo);
      expect(result.success).toBe(false);
      if (!result.success) {
        const errors = result.error.flatten().fieldErrors;
        expect(errors.loja_name).toBeDefined();
        expect(errors.owner_email).toBeDefined();
      }
    });

    it("deve REJEITAR campos extras maliciosos como role: 'admin' ou isAdmin: true", () => {
      const payloadComInjecaoRole = {
        action: "create_loja",
        loja_name: "Loja Teste",
        owner_name: "João Silva",
        owner_email: "joao.silva@exemplo.com",
        role: "admin", // Tentativa de Mass Assignment para escalar privilégio
        isAdmin: true, // Tentativa de injeção de atributo booleano
      };

      const result = CreateLojaSchema.safeParse(payloadComInjecaoRole);
      // Com .strict(), o Zod rejeita qualquer campo não mapeado
      expect(result.success).toBe(false);
      if (!result.success) {
        const unrecognizedKeys = result.error.issues.filter(
          (issue) => issue.code === "unrecognized_keys"
        );
        expect(unrecognizedKeys.length).toBeGreaterThan(0);
        const keys = (unrecognizedKeys[0] as any).keys;
        expect(keys).toContain("role");
        expect(keys).toContain("isAdmin");
      }
    });

    it("deve aceitar e processar entradas válidas sem erros", () => {
      const payloadValido = {
        action: "create_loja" as const,
        loja_name: "Loja Fashion Elegance",
        owner_name: "Maria Santos",
        owner_email: "maria.santos@exemplo.com",
        loja_phone: "(11) 98888-7777",
        loja_cnpj: "12.345.678/0001-90",
        owner_password: "SenhaSeguraFicticia123!",
      };

      const result = CreateLojaSchema.safeParse(payloadValido);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.loja_name).toBe("Loja Fashion Elegance");
        expect(result.data.owner_email).toBe("maria.santos@exemplo.com");
      }
    });
  });

  describe("2. Endpoint /create-checkout-session", () => {
    it("deve rejeitar malinha_id com formato inválido (não UUID)", () => {
      const payloadInvalido = {
        malinha_id: "id-invalido-12345",
      };

      const result = CreateCheckoutSessionSchema.safeParse(payloadInvalido);
      expect(result.success).toBe(false);
    });

    it("deve aceitar malinha_id quando for um UUID válido", () => {
      const payloadValido = {
        malinha_id: "123e4567-e89b-12d3-a456-426614174000",
      };

      const result = CreateCheckoutSessionSchema.safeParse(payloadValido);
      expect(result.success).toBe(true);
    });
  });

  describe("3. Endpoint /send-email", () => {
    it("deve rejeitar e-mail inválido e campos extras", () => {
      const payloadInvalido = {
        to: "email-invalido-sem-arroba",
        subject: "Teste",
        html: "<p>Olá</p>",
        maliciousHeader: "X-Spam-Injection",
      };

      const result = SendEmailSchema.safeParse(payloadInvalido);
      expect(result.success).toBe(false);
    });

    it("deve aceitar payload válido para envio de email", () => {
      const payloadValido = {
        to: "destinatario.teste@exemplo.com",
        subject: "Notificação de Venda",
        html: "<p>Seu pedido foi processado com sucesso.</p>",
      };

      const result = SendEmailSchema.safeParse(payloadValido);
      expect(result.success).toBe(true);
    });
  });

  describe("4. Upload de Arquivos (Storage: product-photos)", () => {
    it("deve rejeitar arquivos com extensão ou MIME type perigoso (ex: .exe, .html)", () => {
      const arquivoMalicioso = {
        name: "script_malicioso.html",
        size: 1024,
        type: "text/html",
      };

      expect(() => validateUploadFile(arquivoMalicioso)).toThrowError(
        /Tipo de arquivo não permitido/
      );

      const binarioExecutavel = {
        name: "malware.exe",
        size: 2048,
        type: "application/x-msdownload",
      };

      expect(() => validateUploadFile(binarioExecutavel)).toThrowError(
        /Tipo de arquivo não permitido/
      );
    });

    it("deve rejeitar arquivos que excedem o limite de tamanho (ex: 20MB)", () => {
      const arquivoGigante = {
        name: "foto_pesada.jpg",
        size: 20 * 1024 * 1024, // 20 MB (limite é 5 MB)
        type: "image/jpeg",
      };

      expect(() => validateUploadFile(arquivoGigante)).toThrowError(
        /Arquivo excede o limite máximo/
      );
    });

    it("deve permitir upload de imagens válidas dentro do limite (ex: JPG de 1.5MB)", () => {
      const imagemValida = {
        name: "vestido_verao.jpg",
        size: 1.5 * 1024 * 1024,
        type: "image/jpeg",
      };

      expect(validateUploadFile(imagemValida)).toBe(true);
    });
  });
});
