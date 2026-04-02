
-- =============================================
-- FIX ALL RLS POLICIES
-- Problem: All policies are RESTRICTIVE and have self-referencing bugs
-- =============================================

-- 1. DROP all broken policies
DROP POLICY IF EXISTS "Loja can manage own vendedoras membership" ON public.loja_members;
DROP POLICY IF EXISTS "Loja members can view own loja members" ON public.loja_members;
DROP POLICY IF EXISTS "Master can manage loja_members" ON public.loja_members;

DROP POLICY IF EXISTS "Loja members can view their loja" ON public.lojas;
DROP POLICY IF EXISTS "Master can manage lojas" ON public.lojas;
DROP POLICY IF EXISTS "Vendedoras can view their loja" ON public.lojas;

DROP POLICY IF EXISTS "staff_manage_malinhas" ON public.malinhas;
DROP POLICY IF EXISTS "staff_manage_malinha_products" ON public.malinha_products;

DROP POLICY IF EXISTS "Loja can manage own vendedoras" ON public.vendedoras;
DROP POLICY IF EXISTS "Master can manage vendedoras" ON public.vendedoras;
DROP POLICY IF EXISTS "Vendedora can view own record" ON public.vendedoras;

DROP POLICY IF EXISTS "Master can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Master can manage all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;

-- 2. RECREATE as PERMISSIVE with correct conditions

-- === loja_members ===
CREATE POLICY "Master can manage loja_members"
  ON public.loja_members FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'master'))
  WITH CHECK (public.has_role(auth.uid(), 'master'));

CREATE POLICY "Loja members can view own loja members"
  ON public.loja_members FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.loja_members my
    WHERE my.user_id = auth.uid() AND my.loja_id = loja_members.loja_id
  ));

-- === lojas ===
CREATE POLICY "Master can manage lojas"
  ON public.lojas FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'master'))
  WITH CHECK (public.has_role(auth.uid(), 'master'));

CREATE POLICY "Loja members can view their loja"
  ON public.lojas FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.loja_members lm
    WHERE lm.loja_id = lojas.id AND lm.user_id = auth.uid()
  ));

CREATE POLICY "Vendedoras can view their loja"
  ON public.lojas FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.vendedoras v
    WHERE v.loja_id = lojas.id AND v.user_id = auth.uid()
  ));

-- === vendedoras ===
CREATE POLICY "Master can manage vendedoras"
  ON public.vendedoras FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'master'))
  WITH CHECK (public.has_role(auth.uid(), 'master'));

CREATE POLICY "Loja can manage own vendedoras"
  ON public.vendedoras FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'loja') AND EXISTS (
      SELECT 1 FROM public.loja_members lm
      WHERE lm.loja_id = vendedoras.loja_id AND lm.user_id = auth.uid()
    )
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'loja') AND EXISTS (
      SELECT 1 FROM public.loja_members lm
      WHERE lm.loja_id = vendedoras.loja_id AND lm.user_id = auth.uid()
    )
  );

CREATE POLICY "Vendedora can view own record"
  ON public.vendedoras FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- === malinhas ===
CREATE POLICY "staff_manage_malinhas"
  ON public.malinhas FOR ALL TO authenticated
  USING (
    auth.uid() = vendedora_id
    OR public.has_role(auth.uid(), 'master')
    OR (
      public.has_role(auth.uid(), 'loja') AND EXISTS (
        SELECT 1 FROM public.vendedoras v
        JOIN public.loja_members lm ON lm.loja_id = v.loja_id
        WHERE v.user_id = malinhas.vendedora_id AND lm.user_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    auth.uid() = vendedora_id
    OR public.has_role(auth.uid(), 'master')
    OR (
      public.has_role(auth.uid(), 'loja') AND EXISTS (
        SELECT 1 FROM public.vendedoras v
        JOIN public.loja_members lm ON lm.loja_id = v.loja_id
        WHERE v.user_id = malinhas.vendedora_id AND lm.user_id = auth.uid()
      )
    )
  );

-- === malinha_products ===
CREATE POLICY "staff_manage_malinha_products"
  ON public.malinha_products FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.malinhas m
    WHERE m.id = malinha_products.malinha_id AND (
      auth.uid() = m.vendedora_id
      OR public.has_role(auth.uid(), 'master')
      OR (
        public.has_role(auth.uid(), 'loja') AND EXISTS (
          SELECT 1 FROM public.vendedoras v
          JOIN public.loja_members lm ON lm.loja_id = v.loja_id
          WHERE v.user_id = m.vendedora_id AND lm.user_id = auth.uid()
        )
      )
    )
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.malinhas m
    WHERE m.id = malinha_products.malinha_id AND (
      auth.uid() = m.vendedora_id
      OR public.has_role(auth.uid(), 'master')
      OR (
        public.has_role(auth.uid(), 'loja') AND EXISTS (
          SELECT 1 FROM public.vendedoras v
          JOIN public.loja_members lm ON lm.loja_id = v.loja_id
          WHERE v.user_id = m.vendedora_id AND lm.user_id = auth.uid()
        )
      )
    )
  ));

-- === profiles ===
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Master can view all profiles"
  ON public.profiles FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'master'));

CREATE POLICY "Loja can view vendedora profiles"
  ON public.profiles FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'loja') AND EXISTS (
      SELECT 1 FROM public.vendedoras v
      JOIN public.loja_members lm ON lm.loja_id = v.loja_id
      WHERE v.user_id = profiles.user_id AND lm.user_id = auth.uid()
    )
  );

-- === user_roles ===
CREATE POLICY "Users can view own roles"
  ON public.user_roles FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Master can manage all roles"
  ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'master'))
  WITH CHECK (public.has_role(auth.uid(), 'master'));
