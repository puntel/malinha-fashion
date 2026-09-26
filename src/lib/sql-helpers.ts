/**
 * Módulo de Demonstração e Helpers de Segurança SQL
 * Diferenciação entre Parâmetros de Valores (Value Parameters) e Identificadores Dinâmicos (Dynamic Identifiers)
 */

// 1. Simulação de Execução em Banco de Dados SQL
export interface QueryResult {
  executedSql: string;
  params?: any[];
  matchedRows: Array<{ id: string; name: string; owner_id: string }>;
  error?: string;
}

// Base de dados em memória para teste
export const MOCK_DATABASE = [
  { id: "loja-1", name: "Loja D'Ávila Moda", owner_id: "user-alpha" },
  { id: "loja-2", name: "Boutique O'Connor", owner_id: "user-alpha" },
  { id: "loja-3", name: "Confecções Sant'Anna", owner_id: "user-beta" },
  { id: "loja-4", name: "Loja Central", owner_id: "user-beta" },
];

/**
 * ❌ IMPLEMENTAÇÃO VULNERÁVEL: Concatenação / Interpolação de Strings
 * Qualquer apóstrofo (') quebra a sintaxe ou altera a árvore lógica da cláusula WHERE.
 */
export function executeVulnerableQuery(ownerName: string, requiredOwnerId: string): QueryResult {
  const sql = `SELECT * FROM lojas WHERE name = '${ownerName}' AND owner_id = '${requiredOwnerId}'`;

  // Simulação de parser SQL
  // Se houver apóstrofo desbalanceado ou injeção de OR:
  const rawValue = ownerName;
  
  // Detecção de erro de sintaxe por apóstrofo não escapado
  const apostropheCount = (rawValue.match(/'/g) || []).length;
  const hasInjectionPattern = rawValue.includes("' OR '") || rawValue.includes("' or '") || rawValue.includes("'--");

  if (apostropheCount % 2 !== 0 && !hasInjectionPattern) {
    return {
      executedSql: sql,
      matchedRows: [],
      error: `syntax error at or near "${rawValue.split("'")[1]}": unclosed quotation mark`,
    };
  }

  // Se a injeção foi bem sucedida via OR '1'='1', a condição booleana altera o filtro de proprietário!
  if (hasInjectionPattern) {
    // A injeção burlou o filtro AND owner_id = requiredOwnerId, retornando todas as lojas!
    return {
      executedSql: sql,
      matchedRows: [...MOCK_DATABASE], // VAZOU DADOS DE OUTROS PROPRIETÁRIOS!
    };
  }

  // Execução normal (apenas se for string sem apóstrofos)
  const rows = MOCK_DATABASE.filter(
    (row) => row.name === ownerName && row.owner_id === requiredOwnerId
  );

  return {
    executedSql: sql,
    matchedRows: rows,
  };
}

/**
 * ✅ IMPLEMENTAÇÃO SEGURA: Consulta Parametrizada (Value Parameters)
 * O valor do parâmetro é transmitido fora da instrução SQL (como $1, $2).
 * Apóstrofos (ex.: D'Ávila) são tratados exclusivamente como dados literais.
 */
export function executeParameterizedQuery(
  ownerName: string,
  requiredOwnerId: string
): QueryResult {
  const sql = `SELECT * FROM lojas WHERE name = $1 AND owner_id = $2`;
  const params = [ownerName, requiredOwnerId];

  // O motor do banco avalia $1 e $2 como literais exatos:
  const rows = MOCK_DATABASE.filter(
    (row) => row.name === params[0] && row.owner_id === params[1]
  );

  return {
    executedSql: sql,
    params,
    matchedRows: rows,
  };
}

/**
 * 🔒 TRATAMENTO DE IDENTIFICADORES DINÂMICOS (Colunas / Tabelas)
 * Parâmetros de valores ($1, $2) NÃO podem ser usados para nomes de colunas ou tabelas.
 * Identificadores exigem validação contra lista estrita (Allowlist) ou quote_ident.
 */
export const ALLOWED_SORT_COLUMNS = ["name", "created_at", "id"] as const;
export type AllowedSortColumn = (typeof ALLOWED_SORT_COLUMNS)[number];

export function sanitizeIdentifier(identifier: string): string {
  // 1. Validação estrita por allowlist
  if (ALLOWED_SORT_COLUMNS.includes(identifier as AllowedSortColumn)) {
    return identifier;
  }
  // 2. Se não estiver na allowlist, rejeitar imediatamente
  throw new Error(`Identificador dinâmico inválido ou não autorizado: "${identifier}"`);
}

/**
 * Construtor seguro para consultas com ordenação dinâmica
 */
export function executeDynamicSortQuery(
  sortColumn: string,
  ownerId: string
): { sql: string; params: any[] } {
  // Sanitiza o identificador dinâmico antes de interpolar na cláusula ORDER BY
  const safeColumn = sanitizeIdentifier(sortColumn);

  return {
    sql: `SELECT * FROM lojas WHERE owner_id = $1 ORDER BY ${safeColumn} ASC`,
    params: [ownerId],
  };
}
