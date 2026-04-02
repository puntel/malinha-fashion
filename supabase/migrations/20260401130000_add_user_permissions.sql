-- ───────────────────────────────────────────────────────────────────────────
-- user_permissions: feature-level access control per user
-- Features: clientes | produtos | vendas | malinhas | relatorios | modelos
-- ───────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS user_permissions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  feature     text NOT NULL,         -- e.g. 'clientes', 'produtos', 'vendas', 'malinhas', 'relatorios', 'modelos'
  can_view    boolean NOT NULL DEFAULT true,
  can_edit    boolean NOT NULL DEFAULT true,
  granted_by  uuid REFERENCES auth.users(id),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, feature)
);

-- Automatically update updated_at
CREATE OR REPLACE FUNCTION update_user_permissions_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_user_permissions_updated_at ON user_permissions;
CREATE TRIGGER trg_user_permissions_updated_at
  BEFORE UPDATE ON user_permissions
  FOR EACH ROW EXECUTE PROCEDURE update_user_permissions_updated_at();

-- ── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE user_permissions ENABLE ROW LEVEL SECURITY;

-- The user can read their own permissions
CREATE POLICY "user can read own permissions"
  ON user_permissions FOR SELECT
  USING (auth.uid() = user_id);

-- Masters can read all permissions
CREATE POLICY "master can read all permissions"
  ON user_permissions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid() AND role = 'master'
    )
  );

-- Lojas can read permissions of vendedoras in their loja
CREATE POLICY "loja can read vendedora permissions"
  ON user_permissions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN loja_members lm ON lm.user_id = auth.uid()
      JOIN vendedoras v ON v.loja_id = lm.loja_id AND v.user_id = user_permissions.user_id
      WHERE ur.user_id = auth.uid() AND ur.role = 'loja'
    )
  );

-- Masters can insert/update/delete all permissions
CREATE POLICY "master can manage all permissions"
  ON user_permissions FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid() AND role = 'master'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid() AND role = 'master'
    )
  );

-- Lojas can insert/update permissions only for their vendedoras
CREATE POLICY "loja can manage vendedora permissions"
  ON user_permissions FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN loja_members lm ON lm.user_id = auth.uid()
      JOIN vendedoras v ON v.loja_id = lm.loja_id AND v.user_id = user_permissions.user_id
      WHERE ur.user_id = auth.uid() AND ur.role = 'loja'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN loja_members lm ON lm.user_id = auth.uid()
      JOIN vendedoras v ON v.loja_id = lm.loja_id AND v.user_id = user_permissions.user_id
      WHERE ur.user_id = auth.uid() AND ur.role = 'loja'
    )
  );

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_user_permissions_user_id ON user_permissions(user_id);
