/**
 * Simulação e Validação de Isolamento Multi-Tenant e Políticas RLS (Row Level Security)
 * Reflete com fidelidade matemática as políticas SQL do Supabase/PostgreSQL do projeto:
 * - lojas ("Loja members can view their loja")
 * - products ("Loja can manage their products")
 * - clientes ("Loja can manage clientes from their loja")
 * - sales ("Loja can manage their sales")
 * - storage.objects ("Users can only update/delete own product photos")
 */

export interface DbLoja {
  id: string;
  name: string;
}

export interface DbLojaMember {
  user_id: string;
  loja_id: string;
}

export interface DbProduct {
  id: string;
  loja_id: string;
  name: string;
  unit_price: number;
}

export interface DbCliente {
  id: string;
  loja_id: string;
  name: string;
  phone: string;
  created_by: string;
}

export interface DbSale {
  id: string;
  loja_id: string;
  product_name: string;
  value: number;
  vendedora_id: string;
}

export interface DbStorageObject {
  id: string;
  bucket_id: string;
  name: string;
  owner: string; // auth.uid() do uploader
}

export interface DatabaseState {
  lojas: DbLoja[];
  loja_members: DbLojaMember[];
  user_roles: { user_id: string; role: 'master' | 'loja' | 'vendedora' }[];
  products: DbProduct[];
  clientes: DbCliente[];
  sales: DbSale[];
  storage_objects: DbStorageObject[];
}

export class PostgresRlsEngine {
  constructor(public state: DatabaseState) {}

  // Helper SQL: public.has_role(auth.uid(), role)
  private hasRole(userId: string | null, role: 'master' | 'loja' | 'vendedora'): boolean {
    if (!userId) return false;
    return this.state.user_roles.some((r) => r.user_id === userId && r.role === role);
  }

  // Helper SQL: public.is_loja_member(auth.uid(), loja_id)
  private isLojaMember(userId: string | null, lojaId: string): boolean {
    if (!userId) return false;
    return this.state.loja_members.some((m) => m.user_id === userId && m.loja_id === lojaId);
  }

  // --- PRODUCTS RLS ---
  // POLICY "Master can manage all products"
  // POLICY "Loja can manage their products" USING (loja_id IS NOT NULL AND is_loja_member(auth.uid(), loja_id))
  selectProducts(sessionUid: string, filterLojaId?: string): { status: number; data: DbProduct[] } {
    const isMaster = this.hasRole(sessionUid, 'master');
    const filtered = this.state.products.filter((p) => {
      if (filterLojaId && p.loja_id !== filterLojaId) return false;
      if (isMaster) return true;
      return this.isLojaMember(sessionUid, p.loja_id);
    });
    return { status: 200, data: filtered };
  }

  getProductById(sessionUid: string, id: string): { status: number; data: DbProduct | null } {
    const isMaster = this.hasRole(sessionUid, 'master');
    const prod = this.state.products.find((p) => p.id === id);
    if (!prod) return { status: 200, data: null };
    if (isMaster || this.isLojaMember(sessionUid, prod.loja_id)) {
      return { status: 200, data: { ...prod } };
    }
    // RLS oculta registros inacessíveis como se não existissem (anti-leakage)
    return { status: 200, data: null };
  }

  updateProduct(
    sessionUid: string,
    id: string,
    patch: Partial<DbProduct>
  ): { status: number; affectedRows: number } {
    const isMaster = this.hasRole(sessionUid, 'master');
    const index = this.state.products.findIndex((p) => p.id === id);
    if (index === -1) return { status: 200, affectedRows: 0 };

    const prod = this.state.products[index];
    if (!isMaster && !this.isLojaMember(sessionUid, prod.loja_id)) {
      // Bloqueado por RLS USING clause
      return { status: 200, affectedRows: 0 };
    }

    // Com WITH CHECK: se tentar trocar para outra loja que não é membro
    if (patch.loja_id && !isMaster && !this.isLojaMember(sessionUid, patch.loja_id)) {
      return { status: 403, affectedRows: 0 };
    }

    this.state.products[index] = { ...prod, ...patch };
    return { status: 200, affectedRows: 1 };
  }

  deleteProduct(sessionUid: string, id: string): { status: number; affectedRows: number } {
    const isMaster = this.hasRole(sessionUid, 'master');
    const index = this.state.products.findIndex((p) => p.id === id);
    if (index === -1) return { status: 200, affectedRows: 0 };

    const prod = this.state.products[index];
    if (!isMaster && !this.isLojaMember(sessionUid, prod.loja_id)) {
      return { status: 200, affectedRows: 0 };
    }

    this.state.products.splice(index, 1);
    return { status: 200, affectedRows: 1 };
  }

  // --- CLIENTES RLS ---
  // POLICY "Loja can manage clientes from their loja"
  // USING (has_role('loja') AND ((loja_id IS NOT NULL AND is_loja_member(auth.uid(), loja_id)) OR created_by = auth.uid()))
  selectClientes(sessionUid: string): { status: number; data: DbCliente[] } {
    const isMaster = this.hasRole(sessionUid, 'master');
    const isLoja = this.hasRole(sessionUid, 'loja');
    const filtered = this.state.clientes.filter((c) => {
      if (isMaster) return true;
      if (isLoja) {
        return (c.loja_id && this.isLojaMember(sessionUid, c.loja_id)) || c.created_by === sessionUid;
      }
      return c.created_by === sessionUid;
    });
    return { status: 200, data: filtered };
  }

  updateCliente(
    sessionUid: string,
    id: string,
    patch: Partial<DbCliente>
  ): { status: number; affectedRows: number } {
    const index = this.state.clientes.findIndex((c) => c.id === id);
    if (index === -1) return { status: 200, affectedRows: 0 };

    const c = this.state.clientes[index];
    const isMaster = this.hasRole(sessionUid, 'master');
    const isLoja = this.hasRole(sessionUid, 'loja');

    const canManage =
      isMaster ||
      (isLoja && ((c.loja_id && this.isLojaMember(sessionUid, c.loja_id)) || c.created_by === sessionUid));

    if (!canManage) {
      return { status: 200, affectedRows: 0 };
    }

    this.state.clientes[index] = { ...c, ...patch };
    return { status: 200, affectedRows: 1 };
  }

  deleteCliente(sessionUid: string, id: string): { status: number; affectedRows: number } {
    const index = this.state.clientes.findIndex((c) => c.id === id);
    if (index === -1) return { status: 200, affectedRows: 0 };

    const c = this.state.clientes[index];
    const isMaster = this.hasRole(sessionUid, 'master');
    const isLoja = this.hasRole(sessionUid, 'loja');

    const canManage =
      isMaster ||
      (isLoja && ((c.loja_id && this.isLojaMember(sessionUid, c.loja_id)) || c.created_by === sessionUid));

    if (!canManage) {
      return { status: 200, affectedRows: 0 };
    }

    this.state.clientes.splice(index, 1);
    return { status: 200, affectedRows: 1 };
  }

  // --- SALES RLS ---
  // POLICY "Loja can manage their sales"
  // USING (loja_id IS NOT NULL AND is_loja_member(auth.uid(), loja_id))
  selectSales(sessionUid: string): { status: number; data: DbSale[] } {
    const isMaster = this.hasRole(sessionUid, 'master');
    const filtered = this.state.sales.filter((s) => {
      if (isMaster) return true;
      return this.isLojaMember(sessionUid, s.loja_id);
    });
    return { status: 200, data: filtered };
  }

  updateSale(
    sessionUid: string,
    id: string,
    patch: Partial<DbSale>
  ): { status: number; affectedRows: number } {
    const index = this.state.sales.findIndex((s) => s.id === id);
    if (index === -1) return { status: 200, affectedRows: 0 };

    const s = this.state.sales[index];
    const isMaster = this.hasRole(sessionUid, 'master');
    if (!isMaster && !this.isLojaMember(sessionUid, s.loja_id)) {
      return { status: 200, affectedRows: 0 };
    }

    this.state.sales[index] = { ...s, ...patch };
    return { status: 200, affectedRows: 1 };
  }

  deleteSale(sessionUid: string, id: string): { status: number; affectedRows: number } {
    const index = this.state.sales.findIndex((s) => s.id === id);
    if (index === -1) return { status: 200, affectedRows: 0 };

    const s = this.state.sales[index];
    const isMaster = this.hasRole(sessionUid, 'master');
    if (!isMaster && !this.isLojaMember(sessionUid, s.loja_id)) {
      return { status: 200, affectedRows: 0 };
    }

    this.state.sales.splice(index, 1);
    return { status: 200, affectedRows: 1 };
  }

  // --- STORAGE OBJECTS (ANEXOS) RLS ---
  // POLICY "Users can only update/delete own product photos"
  // USING (bucket_id = 'product-photos' AND (owner = auth.uid() OR has_role('master')))
  updateStorageObject(
    sessionUid: string,
    objectName: string
  ): { status: number; success: boolean } {
    const isMaster = this.hasRole(sessionUid, 'master');
    const obj = this.state.storage_objects.find((o) => o.name === objectName);
    if (!obj) return { status: 404, success: false };

    if (!isMaster && obj.owner !== sessionUid) {
      // Bloqueado pelo RLS do storage
      return { status: 403, success: false };
    }

    return { status: 200, success: true };
  }

  deleteStorageObject(
    sessionUid: string,
    objectName: string
  ): { status: number; success: boolean } {
    const isMaster = this.hasRole(sessionUid, 'master');
    const index = this.state.storage_objects.findIndex((o) => o.name === objectName);
    if (index === -1) return { status: 404, success: false };

    const obj = this.state.storage_objects[index];
    if (!isMaster && obj.owner !== sessionUid) {
      // Bloqueado pelo RLS do storage
      return { status: 403, success: false };
    }

    this.state.storage_objects.splice(index, 1);
    return { status: 200, success: true };
  }
}
