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
  status: MalinhaStatus;
  seller_name: string;
  seller_note?: string | null;
  created_at: string;
  updated_at: string;
  malinha_products?: Product[];
}
