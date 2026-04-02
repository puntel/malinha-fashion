-- Add logistics fields to malinhas table
ALTER TABLE public.malinhas ADD COLUMN IF NOT EXISTS client_address TEXT;
ALTER TABLE public.malinhas ADD COLUMN IF NOT EXISTS delivery_location TEXT;
ALTER TABLE public.malinhas ADD COLUMN IF NOT EXISTS collection_location TEXT;
ALTER TABLE public.malinhas ADD COLUMN IF NOT EXISTS total_pieces INTEGER;
ALTER TABLE public.malinhas ADD COLUMN IF NOT EXISTS send_date DATE;
ALTER TABLE public.malinhas ADD COLUMN IF NOT EXISTS return_date DATE;