ALTER TABLE public.sales
ADD COLUMN malinha_id UUID REFERENCES public.malinhas(id) ON DELETE SET NULL;

CREATE INDEX idx_sales_malinha_id ON public.sales(malinha_id);
