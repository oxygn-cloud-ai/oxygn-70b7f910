/**
 * Shared Tenant Context Helpers
 * Provides cross-function access to tenant context for multi-tenant isolation.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

/**
 * Resolved tenant context for the current request
 */
export interface TenantContext {
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
  tenantStatus: string;
  role: 'owner' | 'admin' | 'editor' | 'viewer';
  isPlatformAdmin: boolean;
}

/**
 * Get tenant context for the authenticated user.
 * Resolves once per request — callers should cache the result.
 */
export async function getUserTenantContext(
  supabase: ReturnType<typeof createClient>,
  userId: string
): Promise<TenantContext | null> {
  try {
    const { data, error } = await supabase
      .from('tenant_memberships')
      .select(`
        tenant_id,
        role,
        tenants!inner (
          tenant_name,
          slug,
          status
        )
      `)
      .eq('user_id', userId)
      .eq('status', 'active')
      .limit(1)
      .maybeSingle();

    if (error || !data) {
      console.warn('[tenant] No active tenant membership for user:', userId);
      return null;
    }

    // Check platform admin status
    const { data: adminData } = await supabase.rpc('is_admin', { _user_id: userId });

    const tenant = (data as any).tenants;

    return {
      tenantId: data.tenant_id,
      tenantName: tenant.tenant_name,
      tenantSlug: tenant.slug,
      tenantStatus: tenant.status,
      role: data.role as TenantContext['role'],
      isPlatformAdmin: !!adminData,
    };
  } catch (err) {
    console.error('[tenant] Error resolving tenant context:', err);
    return null;
  }
}

/**
 * Role hierarchy levels (lower = more powerful)
 */
const ROLE_LEVELS: Record<string, number> = {
  owner: 1,
  admin: 2,
  editor: 3,
  viewer: 4,
};

/**
 * Assert the user has at least the required role within their tenant.
 * Throws an error if the check fails.
 */
export function assertTenantAccess(
  context: TenantContext | null,
  requiredRole: 'owner' | 'admin' | 'editor' | 'viewer'
): void {
  if (!context) {
    throw new Error('No tenant context — user has no active tenant membership');
  }

  if (context.tenantStatus !== 'active') {
    throw new Error(`Tenant "${context.tenantName}" is ${context.tenantStatus}`);
  }

  // Platform admins bypass tenant role checks
  if (context.isPlatformAdmin) return;

  const userLevel = ROLE_LEVELS[context.role] ?? 99;
  const requiredLevel = ROLE_LEVELS[requiredRole] ?? 99;

  if (userLevel > requiredLevel) {
    throw new Error(
      `Insufficient tenant role: have "${context.role}", need at least "${requiredRole}"`
    );
  }
}

/**
 * Assert a prompt belongs to the user's tenant.
 * Uses the service-role client to bypass RLS for the check.
 */
export async function assertPromptAccess(
  supabase: ReturnType<typeof createClient>,
  context: TenantContext | null,
  promptRowId: string
): Promise<void> {
  if (!context) {
    throw new Error('No tenant context');
  }

  // Platform admins can access any prompt
  if (context.isPlatformAdmin) return;

  // For now, rely on existing RLS (owner_id-based).
  // When Phase B adds tenant_id to q_prompts, this will check tenant_id match.
  const { data, error } = await supabase
    .from('q_prompts')
    .select('row_id')
    .eq('row_id', promptRowId)
    .maybeSingle();

  if (error || !data) {
    throw new Error(`Prompt ${promptRowId} not accessible`);
  }
}
