
-- 1. Add archived column to lojas
ALTER TABLE public.lojas ADD COLUMN IF NOT EXISTS archived BOOLEAN NOT NULL DEFAULT false;

-- 2. Add archived column to vendedoras
ALTER TABLE public.vendedoras ADD COLUMN IF NOT EXISTS archived BOOLEAN NOT NULL DEFAULT false;

-- 3. Create clientes table
CREATE TABLE IF NOT EXISTS public.clientes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  cpf TEXT,
  email TEXT,
  address TEXT,
  notes TEXT,
  vendedora_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  loja_id UUID REFERENCES public.lojas(id) ON DELETE SET NULL,
  archived BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;

-- RLS: Master manages all clientes
CREATE POLICY "Master can manage clientes"
  ON public.clientes FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'master'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'master'::app_role));

-- RLS: Loja manages clientes from their loja
CREATE POLICY "Loja can manage clientes from their loja"
  ON public.clientes FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'loja'::app_role) AND
    public.is_loja_member(auth.uid(), loja_id)
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'loja'::app_role) AND
    public.is_loja_member(auth.uid(), loja_id)
  );

-- RLS: Vendedora manages own clientes
CREATE POLICY "Vendedora can manage own clientes"
  ON public.clientes FOR ALL TO authenticated
  USING (auth.uid() = vendedora_id)
  WITH CHECK (auth.uid() = vendedora_id);

-- Trigger for updated_at on clientes
CREATE TRIGGER update_clientes_updated_at
  BEFORE UPDATE ON public.clientes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_clientes_vendedora_id ON public.clientes(vendedora_id);
CREATE INDEX IF NOT EXISTS idx_clientes_loja_id ON public.clientes(loja_id);

-- 4. Allow master to update any profile (for editing vendedora info)
CREATE POLICY "Master can update all profiles"
  ON public.profiles FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'master'::app_role));

-- 5. Allow loja to update profiles of vendedoras in their loja
CREATE POLICY "Loja can update vendedora profiles"
  ON public.profiles FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'loja'::app_role) AND EXISTS (
      SELECT 1 FROM public.vendedoras v
      JOIN public.loja_members lm ON lm.loja_id = v.loja_id
      WHERE v.user_id = profiles.user_id AND lm.user_id = auth.uid()
    )
  );
