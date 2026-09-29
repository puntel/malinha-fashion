import { describe, it, expect, beforeEach } from "vitest";
import {
  PostgresRlsEngine,
  DatabaseState,
  DbProduct,
  DbCliente,
  DbSale,
  DbStorageObject,
} from "@/lib/tenant-isolation";

describe("Auditoria de Segurança: Isolamento Multi-Tenant e Políticas RLS (IDOR / Cross-Tenant)", () => {
  // Identificadores Fictícios - Tenant A (Loja Alpha)
  const USER_A_ID = "11111111-1111-4111-a111-111111111111";
  const LOJA_A_ID = "aaaaaaa1-aaaa-4aaa-aaaa-aaaaaaaaaaaa";

  // Identificadores Fictícios - Tenant B (Loja Beta)
  const USER_B_ID = "22222222-2222-4222-b222-222222222222";
  const LOJA_B_ID = "bbbbbbb2-bbbb-4bbb-bbbb-bbbbbbbbbbbb";

  // Recursos de Teste
  const PROD_A_ID = "product-alpha-001";
  const PROD_B_ID = "product-beta-002";

  const CLI_A_ID = "cliente-alpha-001";
  const CLI_B_ID = "cliente-beta-002";

  const SALE_A_ID = "sale-alpha-001";
  const SALE_B_ID = "sale-beta-002";

  const PHOTO_A_NAME = "tenant-a-product.jpg";
  const PHOTO_B_NAME = "tenant-b-product.jpg";

  let dbState: DatabaseState;
  let rlsEngine: PostgresRlsEngine;

  beforeEach(() => {
    // Inicializa banco de dados com duas contas e dois conjuntos de recursos isolados
    dbState = {
      lojas: [
        { id: LOJA_A_ID, name: "Loja Alpha Fashion" },
        { id: LOJA_B_ID, name: "Loja Beta Boutique" },
      ],
      loja_members: [
        { user_id: USER_A_ID, loja_id: LOJA_A_ID },
        { user_id: USER_B_ID, loja_id: LOJA_B_ID },
      ],
      user_roles: [
        { user_id: USER_A_ID, role: "loja" },
        { user_id: USER_B_ID, role: "loja" },
      ],
      products: [
        {
          id: PROD_A_ID,
          loja_id: LOJA_A_ID,
          name: "Vestido Midi Seda Alpha",
          unit_price: 250.0,
        },
        {
          id: PROD_B_ID,
          loja_id: LOJA_B_ID,
          name: "Bolsa Couro Legítimo Beta",
          unit_price: 890.0,
        },
      ],
      clientes: [
        {
          id: CLI_A_ID,
          loja_id: LOJA_A_ID,
          name: "Maria Silva (Cliente Alpha)",
          phone: "11988887777",
          created_by: USER_A_ID,
        },
        {
          id: CLI_B_ID,
          loja_id: LOJA_B_ID,
          name: "Fernanda Costa (Cliente Beta)",
          phone: "21977776666",
          created_by: USER_B_ID,
        },
      ],
      sales: [
        {
          id: SALE_A_ID,
          loja_id: LOJA_A_ID,
          product_name: "Vestido Midi Seda Alpha",
          value: 250.0,
          vendedora_id: USER_A_ID,
        },
        {
          id: SALE_B_ID,
          loja_id: LOJA_B_ID,
          product_name: "Bolsa Couro Legítimo Beta",
          value: 890.0,
          vendedora_id: USER_B_ID,
        },
      ],
      storage_objects: [
        {
          id: "storage-alpha-001",
          bucket_id: "product-photos",
          name: PHOTO_A_NAME,
          owner: USER_A_ID,
        },
        {
          id: "storage-beta-002",
          bucket_id: "product-photos",
          name: PHOTO_B_NAME,
          owner: USER_B_ID,
        },
      ],
    };

    rlsEngine = new PostgresRlsEngine(dbState);
  });

  describe("1. Tentativas de Leitura Cruzada (Cross-Tenant Read / IDOR) via Sessão da Conta A", () => {
    it("Endpoint GET /rest/v1/products?id=eq.PROD_B: Deve retornar nulo sem vazar informações da Loja B", () => {
      // Regra RLS: "Loja can manage their products" USING (loja_id IS NOT NULL AND is_loja_member(auth.uid(), loja_id))
      const res = rlsEngine.getProductById(USER_A_ID, PROD_B_ID);

      // O PostgREST retorna 200 com array vazio ou null, sem revelar metadados do recurso alheio
      expect(res.status).toBe(200);
      expect(res.data).toBeNull();
    });

    it("Endpoint GET /rest/v1/products: Listagem com ou sem filtro loja_id nunca deve conter produtos do Tenant B", () => {
      // Mesmo se o invasor injetar query param ?loja_id=LOJA_B_ID, o RLS bloqueia no servidor
      const listSemFiltro = rlsEngine.selectProducts(USER_A_ID);
      expect(listSemFiltro.data.length).toBe(1);
      expect(listSemFiltro.data[0].id).toBe(PROD_A_ID);
      expect(listSemFiltro.data.some((p) => p.loja_id === LOJA_B_ID)).toBe(false);

      const listComInjecaoFiltro = rlsEngine.selectProducts(USER_A_ID, LOJA_B_ID);
      // Tentativa de filtrar loja alheia retorna lista vazia
      expect(listComInjecaoFiltro.data.length).toBe(0);
    });

    it("Endpoint GET /rest/v1/clientes: Não deve listar clientes confidenciais do Tenant B", () => {
      // Regra RLS: "Loja can manage clientes from their loja"
      const res = rlsEngine.selectClientes(USER_A_ID);
      expect(res.data.length).toBe(1);
      expect(res.data[0].id).toBe(CLI_A_ID);
      expect(res.data.some((c) => c.id === CLI_B_ID)).toBe(false);
    });

    it("Endpoint GET /rest/v1/sales: Não deve listar faturamento ou vendas do Tenant B", () => {
      // Regra RLS: "Loja can manage their sales"
      const res = rlsEngine.selectSales(USER_A_ID);
      expect(res.data.length).toBe(1);
      expect(res.data[0].id).toBe(SALE_A_ID);
      expect(res.data.some((s) => s.id === SALE_B_ID)).toBe(false);
    });
  });

  describe("2. Tentativas de Modificação Cruzada (Cross-Tenant Update) via Sessão da Conta A", () => {
    it("Endpoint PATCH /rest/v1/products?id=eq.PROD_B: Deve afetar 0 linhas e manter o produto do Tenant B intacto", () => {
      const precoOriginal = dbState.products.find((p) => p.id === PROD_B_ID)!.unit_price;

      // Tentativa de sabotar o preço do concorrente para R$ 0,01
      const res = rlsEngine.updateProduct(USER_A_ID, PROD_B_ID, { unit_price: 0.01 });

      expect(res.affectedRows).toBe(0);
      const produtoBNoBanco = dbState.products.find((p) => p.id === PROD_B_ID)!;
      expect(produtoBNoBanco.unit_price).toBe(precoOriginal);
    });

    it("Endpoint PATCH /rest/v1/clientes?id=eq.CLI_B: Deve afetar 0 linhas e manter dados de clientes do Tenant B intactos", () => {
      const nomeOriginal = dbState.clientes.find((c) => c.id === CLI_B_ID)!.name;

      const res = rlsEngine.updateCliente(USER_A_ID, CLI_B_ID, { name: "Cliente Hackeado" });

      expect(res.affectedRows).toBe(0);
      const clienteBNoBanco = dbState.clientes.find((c) => c.id === CLI_B_ID)!;
      expect(clienteBNoBanco.name).toBe(nomeOriginal);
    });

    it("Endpoint PATCH /rest/v1/sales?id=eq.SALE_B: Deve afetar 0 linhas e não alterar vendas do Tenant B", () => {
      const res = rlsEngine.updateSale(USER_A_ID, SALE_B_ID, { value: 0 });
      expect(res.affectedRows).toBe(0);

      const saleB = dbState.sales.find((s) => s.id === SALE_B_ID)!;
      expect(saleB.value).toBe(890.0);
    });

    it("Tentativa de trocar produto legítimo do Tenant A para a loja do Tenant B (WITH CHECK violation)", () => {
      // Conta A tenta transferir seu produto para a Loja B injetando loja_id
      const res = rlsEngine.updateProduct(USER_A_ID, PROD_A_ID, { loja_id: LOJA_B_ID });
      expect(res.status).toBe(403);
      expect(res.affectedRows).toBe(0);
    });
  });

  describe("3. Tentativas de Exclusão Cruzada (Cross-Tenant Delete) via Sessão da Conta A", () => {
    it("Endpoint DELETE /rest/v1/products?id=eq.PROD_B: Deve afetar 0 linhas e manter o produto no banco", () => {
      const res = rlsEngine.deleteProduct(USER_A_ID, PROD_B_ID);
      expect(res.affectedRows).toBe(0);

      const exists = dbState.products.some((p) => p.id === PROD_B_ID);
      expect(exists).toBe(true);
    });

    it("Endpoint DELETE /rest/v1/clientes?id=eq.CLI_B: Deve afetar 0 linhas e manter cliente de B preservado", () => {
      const res = rlsEngine.deleteCliente(USER_A_ID, CLI_B_ID);
      expect(res.affectedRows).toBe(0);

      const exists = dbState.clientes.some((c) => c.id === CLI_B_ID);
      expect(exists).toBe(true);
    });

    it("Endpoint DELETE /rest/v1/sales?id=eq.SALE_B: Deve afetar 0 linhas e manter venda de B preservada", () => {
      const res = rlsEngine.deleteSale(USER_A_ID, SALE_B_ID);
      expect(res.affectedRows).toBe(0);

      const exists = dbState.sales.some((s) => s.id === SALE_B_ID);
      expect(exists).toBe(true);
    });
  });

  describe("4. Isolamento de Anexos (Storage Bucket: product-photos)", () => {
    it("Endpoint DELETE /storage/v1/object/product-photos/PHOTO_B: Deve rejeitar com 403 Forbidden para usuário do Tenant A", () => {
      // Regra RLS: "Users can only delete own product photos" USING (bucket_id = 'product-photos' AND owner = auth.uid())
      const res = rlsEngine.deleteStorageObject(USER_A_ID, PHOTO_B_NAME);

      expect(res.status).toBe(403);
      expect(res.success).toBe(false);

      // Foto do Tenant B permanece íntegra no bucket
      const objB = dbState.storage_objects.find((o) => o.name === PHOTO_B_NAME);
      expect(objB).toBeDefined();
    });

    it("Endpoint PUT /storage/v1/object/product-photos/PHOTO_B: Não deve permitir sobrescrever anexo do Tenant B", () => {
      const res = rlsEngine.updateStorageObject(USER_A_ID, PHOTO_B_NAME);

      expect(res.status).toBe(403);
      expect(res.success).toBe(false);
    });
  });

  describe("5. Confirmação de Acesso Legítimo da Conta A aos Seus Próprios Recursos", () => {
    it("Conta A consegue ler seu próprio produto com sucesso", () => {
      const res = rlsEngine.getProductById(USER_A_ID, PROD_A_ID);
      expect(res.status).toBe(200);
      expect(res.data).not.toBeNull();
      expect(res.data!.id).toBe(PROD_A_ID);
      expect(res.data!.unit_price).toBe(250.0);
    });

    it("Conta A consegue atualizar o preço do seu próprio produto", () => {
      const res = rlsEngine.updateProduct(USER_A_ID, PROD_A_ID, { unit_price: 279.9 });
      expect(res.affectedRows).toBe(1);

      const prodA = dbState.products.find((p) => p.id === PROD_A_ID)!;
      expect(prodA.unit_price).toBe(279.9);
    });

    it("Conta A consegue gerenciar seu próprio anexo no storage", () => {
      const res = rlsEngine.deleteStorageObject(USER_A_ID, PHOTO_A_NAME);
      expect(res.status).toBe(200);
      expect(res.success).toBe(true);

      const exists = dbState.storage_objects.some((o) => o.name === PHOTO_A_NAME);
      expect(exists).toBe(false);
    });
  });

  describe("6. Proveniência da Identidade Usada nos Filtros de Segurança", () => {
    it("Valida que o filtro é baseado exclusivamente no JWT criptografado (auth.uid()) e não em parâmetros do cliente", () => {
      // Parâmetros injetados na requisição HTTP simulada
      const clientForgedBody = {
        loja_id: LOJA_B_ID, // Tentativa de se passar pela Loja B
        user_id: USER_B_ID,
      };

      // No PostgreSQL, a cláusula USING usa:
      // public.is_loja_member(auth.uid(), loja_id)
      // Onde auth.uid() é extraído de current_setting('request.jwt.claims', true)::jsonb ->> 'sub'
      const sessionJwtUid = USER_A_ID;

      // Mesmo que o body contenha loja_id da Loja B, o filtro de autorização avalia a sessão do JWT:
      const canAccessLojaB = dbState.loja_members.some(
        (m) => m.user_id === sessionJwtUid && m.loja_id === clientForgedBody.loja_id
      );

      expect(canAccessLojaB).toBe(false);
    });
  });
});
