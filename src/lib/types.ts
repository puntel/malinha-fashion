export type MalinhaStatus = 'Enviada' | 'Em aberto' | 'Pedido realizado' | 'Finalizada';
export type ProductStatus = 'pending' | 'accepted' | 'rejected' | 'edited';

export interface Product {
  id: string;
  malinha_id: string;
  code: string;
  size: string;
  quantity: number;
  price: number;
  photo_url: string;
  status: ProductStatus;
  client_note?: string | null;
  created_at: string;
}

export interface Malinha {
  id: string;
  client_name: string;
  client_cpf: string;
  client_phone: string;
  client_address?: string;
  delivery_location?: string;
  collection_location?: string;
  total_pieces?: number;
  send_date?: string;
  return_date?: string;
  status: MalinhaStatus;
  seller_name: string;
  seller_note?: string | null;
  created_at: string;
  updated_at: string;
  malinha_products?: Product[];
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
