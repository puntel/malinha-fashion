import { supabase } from '@/integrations/supabase/client';
import type { 
  Malinha, InventoryProduct, InventoryCheck, InventoryCheckItem,
  Sale, MalinhaProduct, Profile, MalinhaStatus, ProductStatus
} from './types';

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
  client_email?: string;
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
  // Try to insert with all fields
  const { data, error } = await supabase
    .from('malinhas')
    .insert(malinha)
    .select('id')
    .single();

  if (error) {
    // If the error is about missing columns, try to insert without the logistics fields
    if (error.code === 'PGRST204' || error.message.includes('column') || error.message.includes('not exist')) {
      console.warn('Database schema is missing logistics columns. Falling back to minimal insert.');
      const minimalMalinha = {
        client_name: malinha.client_name,
        client_cpf: malinha.client_cpf,
        client_phone: malinha.client_phone,
        seller_name: malinha.seller_name,
        vendedora_id: malinha.vendedora_id,
        seller_note: malinha.seller_note,
      };
      
      const { data: minimalData, error: minimalError } = await supabase
        .from('malinhas')
        .insert(minimalMalinha)
        .select('id')
        .single();
        
      if (minimalError) throw minimalError;
      return minimalData.id;
    }
    
    // For other errors (like RLS), throw a more descriptive error
    if (error.message.includes('row-level security policy')) {
      throw new Error('Erro de permissão: Certifique-se de que você está logado corretamente.');
    }
    
    throw error;
  }
  
  return data.id;
}

export async function addProducts(malinhaId: string, products: Omit<MalinhaProduct, 'id' | 'malinha_id' | 'created_at'>[]) {
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

export const sendEmailNotification = async (to: string, subject: string, html: string) => {
  const { data, error } = await supabase.functions.invoke('send-email', {
    body: { to, subject, html }
  });
  if (error) throw error;
  return data;
};

export const createCheckoutSession = async (malinhaId: string): Promise<{ url: string }> => {
  const { data, error } = await supabase.functions.invoke('create-checkout-session', {
    body: { malinha_id: malinhaId }
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data;
};

// ─── Inventory Checks ───

export const fetchInventoryChecks = async (lojaId: string) => {
  const { data, error } = await (supabase
    .from('inventory_checks' as any) as any)
    .select('*, items:inventory_check_items(*)')
    .eq('loja_id', lojaId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []) as InventoryCheck[];
};

export const createInventoryCheck = async (
  lojaId: string, 
  createdBy: string, 
  vendedoraName: string,
  items: Omit<InventoryCheckItem, 'id' | 'check_id' | 'created_at'>[]
) => {
  // 1. Create header
  const { data: check, error: checkError } = await (supabase
    .from('inventory_checks' as any) as any)
    .insert({
      loja_id: lojaId,
      created_by: createdBy,
      vendedora_name: vendedoraName
    })
    .select()
    .single();

  if (checkError) throw checkError;

  // 2. Create items
  const itemsToInsert = items.map(item => ({
    ...item,
    check_id: check.id
  }));

  const { error: itemsError } = await (supabase
    .from('inventory_check_items' as any) as any)
    .insert(itemsToInsert);

  if (itemsError) throw itemsError;

  return check.id;
};
