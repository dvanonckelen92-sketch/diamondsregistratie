import { createClient } from '@supabase/supabase-js';

/**
 * Service-role client. Bypasses RLS — only use for admin-only server
 * actions (bv. juf-accounts aanmaken via de Supabase auth admin API).
 */
export function createSupabaseAdminClient() {
  return createClient(
    import.meta.env.PUBLIC_SUPABASE_URL,
    import.meta.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
