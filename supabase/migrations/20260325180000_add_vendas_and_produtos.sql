
-- Create products table
CREATE TABLE IF NOT EXISTS public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  internal_code TEXT,
  quantity INTEGER NOT NULL DEFAULT 0,
  unit_price NUMERIC(15,2) NOT NULL DEFAULT 0,
  profit_percent NUMERIC(5,2) DEFAULT 0,
  category TEXT,
  brand TEXT,
  size TEXT,
  color TEXT,
  description TEXT,
  image_url TEXT,
  loja_id UUID REFERENCES public.lojas(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create sales table
CREATE TABLE IF NOT EXISTS public.sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID REFERENCES public.clientes(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  internal_code TEXT,
  quantity INTEGER NOT NULL DEFAULT 1,
  value NUMERIC(15,2) NOT NULL DEFAULT 0,
  discount NUMERIC(15,2) DEFAULT 0,
  payment_method TEXT,
  vendedora_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  loja_id UUID REFERENCES public.lojas(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;

-- RLS for products
CREATE POLICY "Master can manage all products"
  ON public.products FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'master'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'master'::app_role));

CREATE POLICY "Loja can manage their products"
  ON public.products FOR ALL TO authenticated
  USING (loja_id IS NOT NULL AND public.is_loja_member(auth.uid(), loja_id))
  WITH CHECK (loja_id IS NOT NULL AND public.is_loja_member(auth.uid(), loja_id));

CREATE POLICY "Vendedora can view products from their loja"
  ON public.products FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.vendedoras v
      WHERE v.user_id = auth.uid() AND v.loja_id = products.loja_id
    )
  );

-- RLS for sales
CREATE POLICY "Master can manage all sales"
  ON public.sales FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'master'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'master'::app_role));

CREATE POLICY "Loja can manage their sales"
  ON public.sales FOR ALL TO authenticated
  USING (loja_id IS NOT NULL AND public.is_loja_member(auth.uid(), loja_id))
  WITH CHECK (loja_id IS NOT NULL AND public.is_loja_member(auth.uid(), loja_id));

CREATE POLICY "Vendedora can manage their own sales"
  ON public.sales FOR ALL TO authenticated
  USING (vendedora_id = auth.uid())
  WITH CHECK (vendedora_id = auth.uid());

-- Trigger for updated_at on products
CREATE TRIGGER update_products_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Indexes
CREATE INDEX IF NOT EXISTS idx_products_loja_id ON public.products(loja_id);
CREATE INDEX IF NOT EXISTS idx_sales_loja_id ON public.sales(loja_id);
CREATE INDEX IF NOT EXISTS idx_sales_vendedora_id ON public.sales(vendedora_id);
CREATE INDEX IF NOT EXISTS idx_sales_cliente_id ON public.sales(cliente_id);
