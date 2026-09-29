-- Migration: Secure Storage Objects for Multi-Tenant Isolation
-- Problem: Previous migration (20260225150146) allowed ANY user to UPDATE or DELETE any photo in product-photos
-- Fix: Enforce tenant / owner isolation on storage.objects

-- 1. Drop insecure policies
DROP POLICY IF EXISTS "Anyone can update product photos" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can delete product photos" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can upload product photos" ON storage.objects;

-- 2. Authenticated users can upload product photos
CREATE POLICY "Authenticated users can upload product photos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'product-photos');

-- 3. Only the object owner or Master can update the photo
CREATE POLICY "Users can only update own product photos"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'product-photos' AND (
      owner = auth.uid()
      OR public.has_role(auth.uid(), 'master'::app_role)
    )
  )
  WITH CHECK (
    bucket_id = 'product-photos' AND (
      owner = auth.uid()
      OR public.has_role(auth.uid(), 'master'::app_role)
    )
  );

-- 4. Only the object owner or Master can delete the photo
CREATE POLICY "Users can only delete own product photos"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'product-photos' AND (
      owner = auth.uid()
      OR public.has_role(auth.uid(), 'master'::app_role)
    )
  );
