import { supabase } from '@/integrations/supabase/client';
import type { Malinha, Product, MalinhaStatus, ProductStatus } from './types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;

export async function fetchMalinhas(): Promise<Malinha[]> {
  const { data, error } = await supabase
    .from('malinhas')
    .select('*, malinha_products(*)')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data as unknown as Malinha[]) || [];
}

export async function fetchMalinhaById(id: string): Promise<Malinha | null> {
  const { data, error } = await supabase
    .from('malinhas')
    .select('*, malinha_products(*)')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data as unknown as Malinha | null;
}

export async function createMalinha(malinha: {
  client_name: string;
  client_cpf: string;
  client_phone: string;
  client_address?: string;
  delivery_location?: string;
  collection_location?: string;
  total_pieces?: number;
  send_date?: string;
  return_date?: string;
  seller_name: string;
  vendedora_id: string;
  seller_note?: string;
}): Promise<string> {
  const { data, error } = await supabase
    .from('malinhas')
    .insert(malinha)
    .select('id')
    .single();
  if (error) throw error;
  return data.id;
}

export async function addProducts(malinhaId: string, products: Omit<Product, 'id' | 'malinha_id' | 'created_at'>[]) {
  const rows = products.map(p => ({ ...p, malinha_id: malinhaId }));
  const { error } = await supabase.from('malinha_products').insert(rows);
  if (error) throw error;
}

export async function updateMalinhaStatus(id: string, status: MalinhaStatus, sellerNote?: string) {
  const updates: Record<string, unknown> = { status };
  if (sellerNote !== undefined) updates.seller_note = sellerNote;
  const { error } = await supabase.from('malinhas').update(updates).eq('id', id);
  if (error) throw error;
}

export async function updateProductStatuses(products: { id: string; status: ProductStatus; client_note?: string | null }[]) {
  // Update each product individually
  for (const p of products) {
    const { error } = await supabase
      .from('malinha_products')
      .update({ status: p.status, client_note: p.client_note })
      .eq('id', p.id);
    if (error) throw error;
  }
}

export async function uploadProductPhoto(file: File): Promise<string> {
  const ext = file.name.split('.').pop();
  const fileName = `${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from('product-photos')
    .upload(fileName, file);
  if (error) throw error;
  return `${SUPABASE_URL}/storage/v1/object/public/product-photos/${fileName}`;
}
