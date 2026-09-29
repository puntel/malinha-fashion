import { describe, it, expect } from "vitest";
import {
  hashPassword,
  verifyPassword,
  constantTimeCompare,
  generateSecureSalt,
} from "@/lib/password-security";

describe("Auditoria Criptográfica de Senhas, Hashes, Salts e Comparação em Tempo Constante", () => {
  // Credencial de teste fictícia
  const SENHA_TESTE_A = "ModaConsignada#2026!Forte";
  const SENHA_TESTE_B = "OutraSenhaDiferente#987";

  describe("1. Validação de Senha Correta vs Incorreta", () => {
    it("deve APROVAR quando a senha correta for fornecida", async () => {
      const record = await hashPassword(SENHA_TESTE_A);

      const isValid = await verifyPassword(SENHA_TESTE_A, record);
      expect(isValid).toBe(true);
    });

    it("deve REJEITAR quando uma senha incorreta for fornecida", async () => {
      const record = await hashPassword(SENHA_TESTE_A);

      const isValid = await verifyPassword("SenhaTotalmenteErrada#123", record);
      expect(isValid).toBe(false);
    });

    it("deve rejeitar mesmo com diferença sutil de maiúsculas/minúsculas (case sensitivity)", async () => {
      const record = await hashPassword("SenhaSensivel123");

      const isValid = await verifyPassword("senhasensivel123", record);
      expect(isValid).toBe(false);
    });
  });

  describe("2. Unicidade de Salt: Duas Contas com a Mesma Senha Devem ter Hashes Diferentes", () => {
    it("deve gerar salts e hashes completamente distintos para a mesma senha em contas diferentes", async () => {
      const mesmaSenha = "SenhaIdenticaCompartilhada#2026";

      // Conta 1 (Tenant Alpha)
      const recordConta1 = await hashPassword(mesmaSenha);

      // Conta 2 (Tenant Beta)
      const recordConta2 = await hashPassword(mesmaSenha);

      // 1. Os salts devem ser diferentes (CSPRNG de 128 bits)
      expect(recordConta1.saltHex).not.toBe(recordConta2.saltHex);
      expect(recordConta1.saltHex.length).toBe(32); // 16 bytes = 32 caracteres hexadecimais

      // 2. Os hashes resultantes DEVEM ser diferentes para impedir rainbow tables e correlação
      expect(recordConta1.hashHex).not.toBe(recordConta2.hashHex);

      // 3. Ambas as contas conseguem autenticar individualmente com a mesma senha
      expect(await verifyPassword(mesmaSenha, recordConta1)).toBe(true);
      expect(await verifyPassword(mesmaSenha, recordConta2)).toBe(true);
    });
  });

  describe("3. Algoritmo, Parâmetros e Complexidade Criptográfica", () => {
    it("deve utilizar derivação com salt de 128 bits e no mínimo 100.000 iterações", async () => {
      const record = await hashPassword(SENHA_TESTE_A);

      expect(record.algorithm).toBe("PBKDF2-HMAC-SHA256");
      expect(record.iterations).toBeGreaterThanOrEqual(100000);
      expect(record.saltHex.length).toBe(32); // 128 bits
      expect(record.hashHex.length).toBe(64); // 256 bits = 64 hex chars
    });

    it("o gerador de salt deve produzir entropia CSPRNG sem repetições", () => {
      const salt1 = generateSecureSalt(16);
      const salt2 = generateSecureSalt(16);

      expect(salt1).not.toEqual(salt2);
      expect(salt1.byteLength).toBe(16);
    });
  });

  describe("4. Comparação em Tempo Constante (Anti-Timing Attack)", () => {
    it("deve retornar true para strings idênticas e false para divergentes", () => {
      const hash1 = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
      const hash2 = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
      const hashDiff = "ffffc44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";

      expect(constantTimeCompare(hash1, hash2)).toBe(true);
      expect(constantTimeCompare(hash1, hashDiff)).toBe(false);
    });

    it("deve rejeitar imediatamente hashes de comprimentos diferentes", () => {
      expect(constantTimeCompare("abc", "abcdef")).toBe(false);
    });
  });
});
