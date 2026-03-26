-- Tables for Inventory Verification
CREATE TABLE public.inventory_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loja_id UUID REFERENCES public.lojas(id) ON DELETE CASCADE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  vendedora_name TEXT -- Cached name for history
);

CREATE TABLE public.inventory_check_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  check_id UUID REFERENCES public.inventory_checks(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
  product_name TEXT, -- Cached for history
  internal_code TEXT, -- Cached for history
  expected_quantity INTEGER, -- System quantity at the moment of check
  checked BOOLEAN DEFAULT false,
  observation TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.inventory_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_check_items ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can see checks from their loja"
  ON public.inventory_checks FOR SELECT
  USING (is_loja_member(loja_id, auth.uid()));

CREATE POLICY "Users can create checks for their loja"
  ON public.inventory_checks FOR INSERT
  WITH CHECK (is_loja_member(loja_id, auth.uid()));

CREATE POLICY "Users can see check items from their loja"
  ON public.inventory_check_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.inventory_checks
      WHERE id = inventory_check_items.check_id
      AND is_loja_member(loja_id, auth.uid())
    )
  );

CREATE POLICY "Users can insert check items"
  ON public.inventory_check_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.inventory_checks
      WHERE id = inventory_check_items.check_id
      AND is_loja_member(loja_id, auth.uid())
    )
  );
