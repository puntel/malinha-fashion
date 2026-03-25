export type MalinhaStatus = 'Enviada' | 'Em aberto' | 'Pedido realizado' | 'Finalizada';
export type ProductStatus = 'pending' | 'accepted' | 'rejected' | 'edited';

export interface MalinhaProduct {
  id: string;
  malinha_id: string;
  code: string;
  size: string;
  quantity: number;
  price: number;
  photo_url?: string | null;
  status: ProductStatus;
  client_note?: string | null;
  created_at: string;
}

export interface InventoryProduct {
  id: string;
  name: string;
  internal_code: string | null;
  quantity: number;
  unit_price: number;
  profit_percent: number | null;
  category: string | null;
  brand: string | null;
  size: string | null;
  color: string | null;
  description: string | null;
  image_url: string | null;
  loja_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Sale {
  id: string;
  cliente_id: string | null;
  product_name: string;
  internal_code: string | null;
  quantity: number;
  value: number;
  discount: number | null;
  payment_method: string | null;
  vendedora_id: string | null;
  loja_id: string | null;
  created_at: string;
  // Join data
  cliente?: { name: string } | null;
  vendedora?: { full_name: string } | null;
}

export interface Malinha {
  id: string;
  client_name: string;
  client_cpf: string;
  client_phone: string;
  client_email?: string | null;
  status: MalinhaStatus;
  seller_name: string;
  vendedora_id: string | null;
  seller_note?: string | null;
  created_at: string;
  updated_at: string;
  malinha_products?: MalinhaProduct[];
  // Logistics fields (optional fallback)
  client_address?: string | null;
  send_date?: string;
  return_date?: string;
  delivery_location?: string;
  collection_location?: string;
  total_pieces?: number;
}

export interface Profile {
  user_id: string;
  full_name: string;
  email: string;
  phone: string;
}

export interface Loja {
  id: string;
  name: string;
  phone: string;
  cnpj: string;
  archived: boolean;
  created_at: string;
}

export interface Vendedora {
  id: string;
  user_id: string;
  loja_id: string;
  archived: boolean;
  created_at: string;
  profile?: Profile | null;
  loja?: { id: string, name: string } | null;
}
