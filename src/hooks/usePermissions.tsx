import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import type { FeatureKey } from '@/lib/types';

export interface PermissionMap {
  [feature: string]: { can_view: boolean; can_edit: boolean };
}

/**
 * Returns the current user's feature permissions.
 * If no row exists for a feature, defaults to FULL access
 * (so that users without any record set still see everything).
 */
export function usePermissions() {
  const { user, role } = useAuth();

  const { data: permissions, isLoading } = useQuery<PermissionMap>({
    queryKey: ['my-permissions', user?.id],
    queryFn: async () => {
      if (!user) return {};

      // Master/Loja roles always have full access
      if (role === 'master' || role === 'loja') return {};

      const { data, error } = await (supabase
        .from('user_permissions' as any) as any)
        .select('feature, can_view, can_edit')
        .eq('user_id', user.id);

      if (error) {
        console.error('usePermissions error:', error);
        return {};
      }

      const map: PermissionMap = {};
      for (const row of (data || [])) {
        map[row.feature as FeatureKey] = {
          can_view: row.can_view,
          can_edit: row.can_edit,
        };
      }
      return map;
    },
    enabled: !!user,
    staleTime: 30_000,
  });

  /**
   * Returns true if the current user can VIEW a given feature.
   * Defaults to true when no permission row exists.
   */
  const canView = (feature: FeatureKey): boolean => {
    if (role === 'master' || role === 'loja') return true;
    if (!permissions) return true; // while loading, assume access
    if (!(feature in permissions)) return true; // no row = full access
    return permissions[feature].can_view;
  };

  /**
   * Returns true if the current user can EDIT a given feature.
   * Defaults to true when no permission row exists.
   */
  const canEdit = (feature: FeatureKey): boolean => {
    if (role === 'master' || role === 'loja') return true;
    if (!permissions) return true;
    if (!(feature in permissions)) return true;
    return permissions[feature].can_edit;
  };

  return { permissions, isLoading, canView, canEdit };
}
