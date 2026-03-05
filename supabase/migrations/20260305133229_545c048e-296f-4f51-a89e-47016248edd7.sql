
-- 1. Drop the wide-open policies on malinhas and malinha_products
DROP POLICY IF EXISTS "Allow all access to malinhas" ON public.malinhas;
DROP POLICY IF EXISTS "Allow all access to malinha_products" ON public.malinha_products;

-- 2. Proper RLS for malinhas: authenticated staff only
CREATE POLICY "staff_manage_malinhas" ON public.malinhas
  FOR ALL TO authenticated
  USING (
    auth.uid() = vendedora_id
    OR has_role(auth.uid(), 'loja'::app_role)
    OR has_role(auth.uid(), 'master'::app_role)
  )
  WITH CHECK (
    auth.uid() = vendedora_id
    OR has_role(auth.uid(), 'loja'::app_role)
    OR has_role(auth.uid(), 'master'::app_role)
  );

-- 3. Proper RLS for malinha_products: authenticated staff via parent malinha
CREATE POLICY "staff_manage_malinha_products" ON public.malinha_products
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.malinhas m
      WHERE m.id = malinha_id
        AND (
          auth.uid() = m.vendedora_id
          OR has_role(auth.uid(), 'loja'::app_role)
          OR has_role(auth.uid(), 'master'::app_role)
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.malinhas m
      WHERE m.id = malinha_id
        AND (
          auth.uid() = m.vendedora_id
          OR has_role(auth.uid(), 'loja'::app_role)
          OR has_role(auth.uid(), 'master'::app_role)
        )
    )
  );

-- 4. SECURITY DEFINER RPC: fetch malinha for public client (excludes CPF)
CREATE OR REPLACE FUNCTION public.get_malinha_for_client(_malinha_id uuid)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result json;
BEGIN
  SELECT json_build_object(
    'id', m.id,
    'client_name', m.client_name,
    'client_phone', m.client_phone,
    'seller_name', m.seller_name,
    'seller_note', m.seller_note,
    'status', m.status,
    'created_at', m.created_at,
    'updated_at', m.updated_at,
    'malinha_products', COALESCE((
      SELECT json_agg(json_build_object(
        'id', mp.id,
        'malinha_id', mp.malinha_id,
        'code', mp.code,
        'size', mp.size,
        'price', mp.price,
        'quantity', mp.quantity,
        'photo_url', mp.photo_url,
        'status', mp.status,
        'client_note', mp.client_note,
        'created_at', mp.created_at
      ))
      FROM public.malinha_products mp WHERE mp.malinha_id = m.id
    ), '[]'::json)
  ) INTO result
  FROM public.malinhas m
  WHERE m.id = _malinha_id;

  RETURN result;
END;
$$;

-- 5. SECURITY DEFINER RPC: update malinha status from client
CREATE OR REPLACE FUNCTION public.update_malinha_client_status(_malinha_id uuid, _status malinha_status)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only allow specific client-facing transitions
  IF _status NOT IN ('Em aberto', 'Pedido realizado') THEN
    RAISE EXCEPTION 'Invalid status transition for client';
  END IF;

  UPDATE public.malinhas SET status = _status, updated_at = now()
  WHERE id = _malinha_id;
END;
$$;

-- 6. SECURITY DEFINER RPC: update product statuses from client
CREATE OR REPLACE FUNCTION public.update_product_client_statuses(
  _malinha_id uuid,
  _products json
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  prod json;
BEGIN
  FOR prod IN SELECT * FROM json_array_elements(_products)
  LOOP
    UPDATE public.malinha_products
    SET status = (prod->>'status')::product_status,
        client_note = prod->>'client_note'
    WHERE id = (prod->>'id')::uuid
      AND malinha_id = _malinha_id;
  END LOOP;
END;
$$;
