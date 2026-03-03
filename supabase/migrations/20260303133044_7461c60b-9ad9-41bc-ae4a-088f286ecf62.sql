
-- 1. Enum de papéis
CREATE TYPE public.app_role AS ENUM ('master', 'loja', 'vendedora');

-- 2. Tabela de perfis (ligada a auth.users)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 3. Tabela de papéis (separada do perfil, conforme boas práticas)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  UNIQUE(user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 4. Função security definer para checar papel (evita recursão RLS)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- 5. Tabela de lojas
CREATE TABLE public.lojas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  cnpj TEXT,
  phone TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.lojas ENABLE ROW LEVEL SECURITY;

-- 6. Membros da loja (usuários com papel 'loja' vinculados a uma loja)
CREATE TABLE public.loja_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loja_id UUID NOT NULL REFERENCES public.lojas(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(loja_id, user_id)
);
ALTER TABLE public.loja_members ENABLE ROW LEVEL SECURITY;

-- 7. Tabela de vendedoras (vinculadas a uma loja e a um auth.user)
CREATE TABLE public.vendedoras (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  loja_id UUID NOT NULL REFERENCES public.lojas(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.vendedoras ENABLE ROW LEVEL SECURITY;

-- 8. Adicionar vendedora_id na tabela malinhas
ALTER TABLE public.malinhas ADD COLUMN vendedora_id UUID REFERENCES auth.users(id);

-- 9. Triggers de updated_at
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_lojas_updated_at BEFORE UPDATE ON public.lojas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_vendedoras_updated_at BEFORE UPDATE ON public.vendedoras
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 10. Função para criar perfil automaticamente no signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''), NEW.email);
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============ RLS POLICIES ============

-- Profiles: usuário vê o seu, master vê todos, loja vê vendedoras da loja
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Master can view all profiles" ON public.profiles
  FOR SELECT USING (public.has_role(auth.uid(), 'master'));

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = user_id);

-- User roles: só master pode gerenciar, todos podem ler o próprio
CREATE POLICY "Users can view own roles" ON public.user_roles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Master can manage all roles" ON public.user_roles
  FOR ALL USING (public.has_role(auth.uid(), 'master'));

-- Lojas: master pode tudo, membros da loja podem ver a sua
CREATE POLICY "Master can manage lojas" ON public.lojas
  FOR ALL USING (public.has_role(auth.uid(), 'master'));

CREATE POLICY "Loja members can view their loja" ON public.lojas
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.loja_members WHERE loja_id = id AND user_id = auth.uid())
  );

CREATE POLICY "Vendedoras can view their loja" ON public.lojas
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.vendedoras WHERE loja_id = id AND user_id = auth.uid())
  );

-- Loja members: master pode tudo, membros veem os da sua loja
CREATE POLICY "Master can manage loja_members" ON public.loja_members
  FOR ALL USING (public.has_role(auth.uid(), 'master'));

CREATE POLICY "Loja members can view own loja members" ON public.loja_members
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.loja_members lm WHERE lm.loja_id = loja_id AND lm.user_id = auth.uid())
  );

CREATE POLICY "Loja can manage own vendedoras membership" ON public.loja_members
  FOR ALL USING (
    public.has_role(auth.uid(), 'loja') AND
    EXISTS (SELECT 1 FROM public.loja_members lm WHERE lm.loja_id = loja_id AND lm.user_id = auth.uid())
  );

-- Vendedoras: master e loja da vendedora podem gerenciar
CREATE POLICY "Master can manage vendedoras" ON public.vendedoras
  FOR ALL USING (public.has_role(auth.uid(), 'master'));

CREATE POLICY "Loja can manage own vendedoras" ON public.vendedoras
  FOR ALL USING (
    public.has_role(auth.uid(), 'loja') AND
    EXISTS (SELECT 1 FROM public.loja_members lm WHERE lm.loja_id = loja_id AND lm.user_id = auth.uid())
  );

CREATE POLICY "Vendedora can view own record" ON public.vendedoras
  FOR SELECT USING (auth.uid() = user_id);
