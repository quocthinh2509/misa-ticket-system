import { createClient } from '@supabase/supabase-js';

// Service role client: Bypasses RLS. Dùng trong API routes an toàn khi cần quyền hệ thống.
export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Thiếu cấu hình Supabase URL hoặc SUPABASE_SERVICE_ROLE_KEY trong biến môi trường');
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
