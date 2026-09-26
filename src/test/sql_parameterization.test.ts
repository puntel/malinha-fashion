import { describe, it, expect } from "vitest";
import {
  executeVulnerableQuery,
  executeParameterizedQuery,
  executeDynamicSortQuery,
  MOCK_DATABASE,
} from "@/lib/sql-helpers";

describe("Auditoria de SQL: Concatenação vs Parametrização e Identificadores Dinâmicos", () => {
  const currentOwner = "user-alpha";
  const otherOwner = "user-beta";

  describe("1. Demonstração do Ponto Vulnerável (Concatenação / Interpolação)", () => {
    it("FALHA: Nomes legítimos com apóstrofo quebram a consulta por erro de sintaxe SQL", () => {
      const nomeComApostrofo = "Loja D'Ávila Moda";

      const result = executeVulnerableQuery(nomeComApostrofo, currentOwner);

      // Na consulta concatenada, o apóstrofo fecha a string prematuramente gerando syntax error
      expect(result.error).toBeDefined();
      expect(result.error).toContain("syntax error");
      expect(result.matchedRows.length).toBe(0);
    });

    it("FALHA DE SEGURANÇA: Injeção de apóstrofo altera o filtro de proprietário e vaza dados alheios", () => {
      // Tentativa de invasão injetando cláusula OR '1'='1
      const payloadInjecao = "Boutique' OR '1'='1";

      const result = executeVulnerableQuery(payloadInjecao, currentOwner);

      // Na consulta vulnerável concatenada, o filtro AND owner_id = 'user-alpha' foi anulado!
      expect(result.matchedRows.length).toBe(MOCK_DATABASE.length);

      // Verificação de vazamento: retornou lojas do outro proprietário (user-beta)
      const lojasOutroProprietario = result.matchedRows.filter(
        (r) => r.owner_id === otherOwner
      );
      expect(lojasOutroProprietario.length).toBeGreaterThan(0);
    });
  });

  describe("2. Solução Corrigida (Consulta Parametrizada - Value Parameters)", () => {
    it("SUCESSO: Nomes legítimos com apóstrofo são tratados como dados literais e encontram o registro correto", () => {
      const nomeComApostrofo = "Loja D'Ávila Moda";

      const result = executeParameterizedQuery(nomeComApostrofo, currentOwner);

      expect(result.error).toBeUndefined();
      expect(result.params).toEqual([nomeComApostrofo, currentOwner]);
      expect(result.matchedRows.length).toBe(1);
      expect(result.matchedRows[0].name).toBe("Loja D'Ávila Moda");
      expect(result.matchedRows[0].owner_id).toBe(currentOwner);
    });

    it("SUCESSO: Tentativa de injeção é tratada como texto puro e NÃO altera o filtro de proprietário", () => {
      const payloadInjecao = "Boutique' OR '1'='1";

      const result = executeParameterizedQuery(payloadInjecao, currentOwner);

      expect(result.error).toBeUndefined();
      expect(result.params).toEqual([payloadInjecao, currentOwner]);

      // Nenhuma loja possui o nome literal "Boutique' OR '1'='1", logo retorna 0
      expect(result.matchedRows.length).toBe(0);

      // Garantia absoluta: nenhum registro de outro proprietário foi retornado
      const vazamento = result.matchedRows.filter(
        (r) => r.owner_id === otherOwner
      );
      expect(vazamento.length).toBe(0);
    });

    it("SUCESSO: Nomes com múltiplos apóstrofos (ex.: O'Connor, Sant'Anna) não causam efeito colateral", () => {
      const resultOConnor = executeParameterizedQuery("Boutique O'Connor", currentOwner);
      expect(resultOConnor.matchedRows.length).toBe(1);
      expect(resultOConnor.matchedRows[0].id).toBe("loja-2");
      expect(resultOConnor.matchedRows[0].owner_id).toBe(currentOwner);

      // Sant'Anna pertence ao user-beta. Se o user-alpha buscar, não deve encontrar devido ao filtro de owner
      const resultSantAnna = executeParameterizedQuery("Confecções Sant'Anna", currentOwner);
      expect(resultSantAnna.matchedRows.length).toBe(0); // Bloqueado pelo filtro de proprietário
    });
  });

  describe("3. Diferenciação: Identificadores Dinâmicos (Colunas/Tabelas)", () => {
    it("deve aceitar identificadores permitidos da allowlist", () => {
      const queryName = executeDynamicSortQuery("name", currentOwner);
      expect(queryName.sql).toBe(
        "SELECT * FROM lojas WHERE owner_id = $1 ORDER BY name ASC"
      );

      const queryCreatedAt = executeDynamicSortQuery("created_at", currentOwner);
      expect(queryCreatedAt.sql).toBe(
        "SELECT * FROM lojas WHERE owner_id = $1 ORDER BY created_at ASC"
      );
    });

    it("deve REJEITAR identificadores maliciosos ou não cadastrados na allowlist", () => {
      const identificadorMalicioso = "name; DROP TABLE lojas; --";

      expect(() =>
        executeDynamicSortQuery(identificadorMalicioso, currentOwner)
      ).toThrowError(/Identificador dinâmico inválido/);
    });
  });
});
