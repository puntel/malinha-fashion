-- Fix infinite recursion in loja_members RLS using SECURITY DEFINER helper

CREATE OR REPLACE FUNCTION public.is_loja_member(_user_id uuid, _loja_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.loja_members lm
    WHERE lm.user_id = _user_id
      AND lm.loja_id = _loja_id
  )
$$;

DROP POLICY IF EXISTS "Loja members can view own loja members" ON public.loja_members;

CREATE POLICY "Loja members can view own loja members"
  ON public.loja_members
  FOR SELECT
  TO authenticated
  USING (public.is_loja_member(auth.uid(), loja_id));