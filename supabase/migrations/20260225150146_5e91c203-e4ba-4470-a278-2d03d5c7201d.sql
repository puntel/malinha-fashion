
-- Create enum for malinha status
CREATE TYPE public.malinha_status AS ENUM ('Enviada', 'Em aberto', 'Pedido realizado', 'Finalizada');

-- Create enum for product status
CREATE TYPE public.product_status AS ENUM ('pending', 'accepted', 'rejected', 'edited');

-- Malinhas table
CREATE TABLE public.malinhas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_name TEXT NOT NULL,
  client_cpf TEXT NOT NULL,
  client_phone TEXT NOT NULL,
  status malinha_status NOT NULL DEFAULT 'Enviada',
  seller_name TEXT NOT NULL DEFAULT 'Ana Beatriz',
  seller_note TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Products table
CREATE TABLE public.malinha_products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  malinha_id UUID NOT NULL REFERENCES public.malinhas(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  size TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  price NUMERIC(10,2) NOT NULL DEFAULT 0,
  photo_url TEXT DEFAULT '/placeholder.svg',
  status product_status NOT NULL DEFAULT 'pending',
  client_note TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS (permissive for MVP without auth)
ALTER TABLE public.malinhas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.malinha_products ENABLE ROW LEVEL SECURITY;

-- Permissive policies for MVP (no auth yet)
CREATE POLICY "Allow all access to malinhas" ON public.malinhas FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to malinha_products" ON public.malinha_products FOR ALL USING (true) WITH CHECK (true);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_malinhas_updated_at
  BEFORE UPDATE ON public.malinhas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Storage bucket for product photos
INSERT INTO storage.buckets (id, name, public) VALUES ('product-photos', 'product-photos', true);

-- Storage policies
CREATE POLICY "Anyone can view product photos" ON storage.objects FOR SELECT USING (bucket_id = 'product-photos');
CREATE POLICY "Anyone can upload product photos" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'product-photos');
CREATE POLICY "Anyone can update product photos" ON storage.objects FOR UPDATE USING (bucket_id = 'product-photos');
CREATE POLICY "Anyone can delete product photos" ON storage.objects FOR DELETE USING (bucket_id = 'product-photos');

-- Index for faster lookups
CREATE INDEX idx_malinha_products_malinha_id ON public.malinha_products(malinha_id);
