import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { FEATURES } from '@/lib/types';
import type { FeatureKey, UserPermission } from '@/lib/types';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  ShieldCheck,
  Users,
  Store,
  Search,
  Eye,
  Pencil,
  Loader2,
  ChevronDown,
  ChevronUp,
  AlertCircle,
} from 'lucide-react';
import { toast } from 'sonner';

// ── Types ────────────────────────────────────────────────────────────────────

interface ManagedUser {
  user_id: string;
  full_name: string;
  email: string;
  loja_name?: string;
  loja_id?: string;
  permissions: Record<FeatureKey, { can_view: boolean; can_edit: boolean }>;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function defaultPerms(): Record<FeatureKey, { can_view: boolean; can_edit: boolean }> {
  return Object.fromEntries(
    FEATURES.map(f => [f.key, { can_view: true, can_edit: true }])
  ) as Record<FeatureKey, { can_view: boolean; can_edit: boolean }>;
}

function mergePerms(
  rows: UserPermission[]
): Record<FeatureKey, { can_view: boolean; can_edit: boolean }> {
  const map = defaultPerms();
  for (const row of rows) {
    map[row.feature as FeatureKey] = {
      can_view: row.can_view,
      can_edit: row.can_edit,
    };
  }
  return map;
}

// ── Subcomponent: PermissionRow ──────────────────────────────────────────────

function PermissionToggle({
  label,
  description,
  canView,
  canEdit,
  onChange,
  saving,
}: {
  label: string;
  description: string;
  canView: boolean;
  canEdit: boolean;
  onChange: (field: 'can_view' | 'can_edit', val: boolean) => void;
  saving: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-3 border-b last:border-0">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <div className="flex items-center gap-6 shrink-0">
        <div className="flex flex-col items-center gap-1">
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground flex items-center gap-0.5">
            <Eye className="h-3 w-3" /> Visualizar
          </span>
          <Switch
            checked={canView}
            onCheckedChange={v => onChange('can_view', v)}
            disabled={saving}
            className="data-[state=checked]:bg-primary"
          />
        </div>
        <div className="flex flex-col items-center gap-1">
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground flex items-center gap-0.5">
            <Pencil className="h-3 w-3" /> Editar
          </span>
          <Switch
            checked={canEdit}
            onCheckedChange={v => {
              onChange('can_edit', v);
              // if edit is turned on, view must also be on
              if (v && !canView) onChange('can_view', true);
            }}
            disabled={saving || !canView}
            className="data-[state=checked]:bg-primary"
          />
        </div>
      </div>
    </div>
  );
}

// ── Subcomponent: UserCard ───────────────────────────────────────────────────

function UserPermCard({
  u,
  currentUserId,
  onSave,
}: {
  u: ManagedUser;
  currentUserId: string;
  onSave: (userId: string, feature: FeatureKey, field: 'can_view' | 'can_edit', val: boolean) => Promise<void>;
}) {
  const [expanded, setExpanded] = useState(false);
  const [localPerms, setLocalPerms] = useState(u.permissions);
  const [saving, setSaving] = useState<string | null>(null);

  const handleChange = async (feature: FeatureKey, field: 'can_view' | 'can_edit', val: boolean) => {
    // Optimistic update
    setLocalPerms(prev => ({
      ...prev,
      [feature]: { ...prev[feature], [field]: val },
    }));
    setSaving(`${feature}-${field}`);
    try {
      await onSave(u.user_id, feature, field, val);
    } catch {
      // Revert
      setLocalPerms(prev => ({
        ...prev,
        [feature]: { ...prev[feature], [field]: !val },
      }));
    } finally {
      setSaving(null);
    }
  };

  const hasRestrictions = FEATURES.some(
    f => !localPerms[f.key]?.can_view || !localPerms[f.key]?.can_edit
  );

  return (
    <Card className={`overflow-hidden transition-shadow ${expanded ? 'shadow-md' : 'shadow-sm'}`}>
      <div
        className="flex items-center gap-4 p-4 cursor-pointer hover:bg-muted/30 transition-colors"
        onClick={() => setExpanded(v => !v)}
      >
        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
          <span className="text-primary font-bold text-sm">
            {u.full_name?.charAt(0)?.toUpperCase() || '?'}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-semibold truncate">{u.full_name}</p>
            {hasRestrictions && (
              <Badge variant="outline" className="text-[10px] border-amber-400 text-amber-600 bg-amber-50 gap-1 shrink-0">
                <AlertCircle className="h-3 w-3" /> Restrições ativas
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground truncate">{u.email}</p>
          {u.loja_name && (
            <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
              <Store className="h-3 w-3" /> {u.loja_name}
            </p>
          )}
        </div>
        {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
      </div>

      {expanded && (
        <CardContent className="border-t bg-muted/10 pt-4 pb-4">
          <p className="text-xs text-muted-foreground mb-3 font-medium uppercase tracking-wide">
            Permissões por funcionalidade
          </p>
          {FEATURES.map(f => (
            <PermissionToggle
              key={f.key}
              label={f.label}
              description={f.description}
              canView={localPerms[f.key]?.can_view ?? true}
              canEdit={localPerms[f.key]?.can_edit ?? true}
              saving={saving === `${f.key}-can_view` || saving === `${f.key}-can_edit`}
              onChange={(field, val) => handleChange(f.key, field, val)}
            />
          ))}
        </CardContent>
      )}
    </Card>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function Permissoes() {
  const { user, role } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');

  // ── Fetch all managed users + their permissions ─────────────────────────

  const { data: lojaId } = useQuery<string | null>({
    queryKey: ['my-loja-id-perms', user?.id],
    queryFn: async () => {
      if (role === 'master') return null;
      const { data } = await supabase.from('loja_members').select('loja_id').eq('user_id', user!.id).single();
      return data?.loja_id || null;
    },
    enabled: !!user && role !== 'master',
  });

  const { data: managedUsers = [], isLoading } = useQuery<ManagedUser[]>({
    queryKey: ['permissions-users', role, lojaId],
    queryFn: async () => {
      // 1. Fetch vendedoras (and lojas if master)
      let vendedorasQuery = supabase.from('vendedoras').select('user_id, loja_id');
      if (role === 'loja' && lojaId) {
        vendedorasQuery = vendedorasQuery.eq('loja_id', lojaId);
      }
      const { data: vendedorasData = [] } = await vendedorasQuery;

      if (!vendedorasData?.length) return [];

      const userIds = vendedorasData.map((v: any) => v.user_id);

      // 2. Fetch profiles
      const { data: profiles = [] } = await supabase
        .from('profiles')
        .select('user_id, full_name, email')
        .in('user_id', userIds);

      // 3. Fetch lojas (for labels when master)
      let lojaMap: Record<string, string> = {};
      if (role === 'master') {
        const lojaIds = [...new Set((vendedorasData as any[]).map((v: any) => v.loja_id).filter(Boolean))];
        if (lojaIds.length) {
          const { data: lojasData = [] } = await supabase.from('lojas').select('id, name').in('id', lojaIds);
          lojaMap = Object.fromEntries((lojasData || []).map((l: any) => [l.id, l.name]));
        }
      }

      // 4. Fetch permissions for all vendedoras
      const { data: permsData = [] } = await (supabase
        .from('user_permissions' as any) as any)
        .select('user_id, feature, can_view, can_edit')
        .in('user_id', userIds);

      // Group perms by user_id
      const permsByUser: Record<string, UserPermission[]> = {};
      for (const p of (permsData || [])) {
        if (!permsByUser[p.user_id]) permsByUser[p.user_id] = [];
        permsByUser[p.user_id].push(p);
      }

      const profileMap = Object.fromEntries((profiles || []).map((p: any) => [p.user_id, p]));
      const vendedoraMap = Object.fromEntries((vendedorasData as any[]).map((v: any) => [v.user_id, v]));

      return userIds.map(uid => ({
        user_id: uid,
        full_name: profileMap[uid]?.full_name || 'Sem nome',
        email: profileMap[uid]?.email || '',
        loja_id: vendedoraMap[uid]?.loja_id,
        loja_name: lojaMap[vendedoraMap[uid]?.loja_id] || undefined,
        permissions: mergePerms(permsByUser[uid] || []),
      }));
    },
    enabled: !!user && (role === 'master' || (role === 'loja' && lojaId !== undefined)),
  });

  // ── Lojas list for master tab ────────────────────────────────────────────
  const { data: lojas = [] } = useQuery({
    queryKey: ['lojas-for-perms'],
    queryFn: async () => {
      const { data } = await supabase.from('lojas').select('id, name, user_id:created_by').order('name');
      return data || [];
    },
    enabled: role === 'master',
  });

  const { data: lojaPerms = [], isLoading: loadingLojaPerms } = useQuery<ManagedUser[]>({
    queryKey: ['permissions-lojas'],
    queryFn: async () => {
      if (!lojas.length) return [];

      const userIds = lojas.map((l: any) => l.user_id).filter(Boolean);
      if (!userIds.length) return [];

      const { data: profiles = [] } = await supabase
        .from('profiles')
        .select('user_id, full_name, email')
        .in('user_id', userIds);

      const { data: permsData = [] } = await (supabase
        .from('user_permissions' as any) as any)
        .select('user_id, feature, can_view, can_edit')
        .in('user_id', userIds);

      const permsByUser: Record<string, UserPermission[]> = {};
      for (const p of (permsData || [])) {
        if (!permsByUser[p.user_id]) permsByUser[p.user_id] = [];
        permsByUser[p.user_id].push(p);
      }

      const profileMap = Object.fromEntries((profiles || []).map((p: any) => [p.user_id, p]));
      const lojaByUserId = Object.fromEntries((lojas as any[]).map((l: any) => [l.user_id, l.name]));

      return userIds.map(uid => ({
        user_id: uid,
        full_name: profileMap[uid]?.full_name || 'Sem nome',
        email: profileMap[uid]?.email || '',
        loja_name: lojaByUserId[uid],
        permissions: mergePerms(permsByUser[uid] || []),
      }));
    },
    enabled: role === 'master' && lojas.length > 0,
  });

  // ── Admins list for master tab ──────────────────────────────────────────
  const { data: adminPerms = [], isLoading: loadingAdminPerms } = useQuery<ManagedUser[]>({
    queryKey: ['permissions-admins'],
    queryFn: async () => {
      // 1. Fetch masters from user_roles
      const { data: mastersData = [] } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'master');

      if (!mastersData?.length) return [];

      const userIds = mastersData.map((m: any) => m.user_id);

      // 2. Fetch profiles
      const { data: profiles = [] } = await supabase
        .from('profiles')
        .select('user_id, full_name, email')
        .in('user_id', userIds);

      // 3. Fetch permissions
      const { data: permsData = [] } = await (supabase
        .from('user_permissions' as any) as any)
        .select('user_id, feature, can_view, can_edit')
        .in('user_id', userIds);

      const permsByUser: Record<string, UserPermission[]> = {};
      for (const p of (permsData || [])) {
        if (!permsByUser[p.user_id]) permsByUser[p.user_id] = [];
        permsByUser[p.user_id].push(p);
      }

      const profileMap = Object.fromEntries((profiles || []).map((p: any) => [p.user_id, p]));

      return userIds.map(uid => ({
        user_id: uid,
        full_name: profileMap[uid]?.full_name || 'Sem nome',
        email: profileMap[uid]?.email || '',
        loja_name: 'Administrador (Master)',
        permissions: mergePerms(permsByUser[uid] || []),
      }));
    },
    enabled: role === 'master',
  });

  // ── Save permission (upsert) ────────────────────────────────────────────

  const handleSave = async (
    userId: string,
    feature: FeatureKey,
    field: 'can_view' | 'can_edit',
    val: boolean
  ) => {
    // Get current state for this user+feature from local data
    const currentUser = [...managedUsers, ...lojaPerms].find(u => u.user_id === userId);
    const current = currentUser?.permissions[feature] ?? { can_view: true, can_edit: true };

    const upsertData = {
      user_id: userId,
      feature,
      can_view: field === 'can_view' ? val : current.can_view,
      can_edit: field === 'can_edit' ? val : current.can_edit,
      granted_by: user!.id,
    };

    const { error } = await (supabase
      .from('user_permissions' as any) as any)
      .upsert(upsertData, { onConflict: 'user_id,feature' });

    if (error) {
      toast.error('Erro ao salvar permissão');
      throw error;
    }

    // Also reset the target user's permission cache
    queryClient.invalidateQueries({ queryKey: ['my-permissions', userId] });
    toast.success('Permissão atualizada!', { duration: 1500 });
  };

  // ── Filter ───────────────────────────────────────────────────────────────

  const filtered = useMemo(
    () =>
      managedUsers.filter(u =>
        u.full_name.toLowerCase().includes(search.toLowerCase()) ||
        u.email.toLowerCase().includes(search.toLowerCase()) ||
        (u.loja_name || '').toLowerCase().includes(search.toLowerCase())
      ),
    [managedUsers, search]
  );

  const filteredLojas = useMemo(
    () =>
      lojaPerms.filter(u =>
        u.full_name.toLowerCase().includes(search.toLowerCase()) ||
        u.email.toLowerCase().includes(search.toLowerCase()) ||
        (u.loja_name || '').toLowerCase().includes(search.toLowerCase())
      ),
    [lojaPerms, search]
  );

  const filteredAdmins = useMemo(
    () =>
      adminPerms.filter(u =>
        u.full_name.toLowerCase().includes(search.toLowerCase()) ||
        u.email.toLowerCase().includes(search.toLowerCase())
      ),
    [adminPerms, search]
  );

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="mx-auto max-w-4xl p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <ShieldCheck className="h-8 w-8 text-primary" />
            Gestão de Permissões
          </h1>
          <p className="text-muted-foreground mt-1">
            Controle quais funcionalidades cada usuário pode visualizar e editar.
          </p>
        </div>
      </div>

      {/* Info box */}
      <div className="rounded-xl border bg-primary/5 border-primary/20 p-4 flex gap-3">
        <AlertCircle className="h-5 w-5 text-primary shrink-0 mt-0.5" />
        <div className="text-sm text-muted-foreground space-y-1">
          <p><strong className="text-foreground">Visualizar</strong> — o usuário enxerga o módulo no menu e pode acessá-lo.</p>
          <p><strong className="text-foreground">Editar</strong> — o usuário pode criar, alterar e excluir registros. Requer Visualizar ativo.</p>
          <p>Usuários sem nenhuma restrição cadastrada têm <strong className="text-foreground">acesso completo</strong> por padrão.</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome, e-mail ou loja..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Tabs */}
      {role === 'master' ? (
        <Tabs defaultValue="vendedoras" className="space-y-4">
          <TabsList>
            <TabsTrigger value="vendedoras" className="gap-2">
              <Users className="h-4 w-4" /> Vendedoras
            </TabsTrigger>
            <TabsTrigger value="lojas" className="gap-2">
              <Store className="h-4 w-4" /> Lojas
            </TabsTrigger>
            <TabsTrigger value="admins" className="gap-2">
              <ShieldCheck className="h-4 w-4" /> Admins
            </TabsTrigger>
          </TabsList>

          <TabsContent value="vendedoras" className="space-y-3">
            {isLoading ? (
              <div className="flex justify-center py-16">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-16 rounded-xl border-2 border-dashed">
                <Users className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
                <p className="text-muted-foreground">Nenhuma vendedora encontrada.</p>
              </div>
            ) : (
              filtered.map(u => (
                <UserPermCard
                  key={u.user_id}
                  u={u}
                  currentUserId={user!.id}
                  onSave={handleSave}
                />
              ))
            )}
          </TabsContent>

          <TabsContent value="lojas" className="space-y-3">
            {loadingLojaPerms ? (
              <div className="flex justify-center py-16">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : filteredLojas.length === 0 ? (
              <div className="text-center py-16 rounded-xl border-2 border-dashed">
                <Store className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
                <p className="text-muted-foreground">Nenhuma loja encontrada.</p>
              </div>
            ) : (
              filteredLojas.map(u => (
                <UserPermCard
                  key={u.user_id}
                  u={u}
                  currentUserId={user!.id}
                  onSave={handleSave}
                />
              ))
            )}
          </TabsContent>

          <TabsContent value="admins" className="space-y-3">
            {loadingAdminPerms ? (
              <div className="flex justify-center py-16">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : filteredAdmins.length === 0 ? (
              <div className="text-center py-16 rounded-xl border-2 border-dashed">
                <ShieldCheck className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
                <p className="text-muted-foreground">Nenhum administrador encontrado.</p>
              </div>
            ) : (
              filteredAdmins.map(u => (
                <UserPermCard
                  key={u.user_id}
                  u={u}
                  currentUserId={user!.id}
                  onSave={handleSave}
                />
              ))
            )}
          </TabsContent>
        </Tabs>
      ) : (
        /* Loja view — only vendedoras */
        <div className="space-y-3">
          <div className="flex items-center gap-2 pb-1">
            <Users className="h-4 w-4 text-muted-foreground" />
            <p className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
              Vendedoras da sua loja
            </p>
            <Badge variant="secondary">{filtered.length}</Badge>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 rounded-xl border-2 border-dashed">
              <Users className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
              <p className="text-muted-foreground">Nenhuma vendedora cadastrada nesta loja.</p>
            </div>
          ) : (
            filtered.map(u => (
              <UserPermCard
                key={u.user_id}
                u={u}
                currentUserId={user!.id}
                onSave={handleSave}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}
