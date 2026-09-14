import React from 'react';
import { createClient } from '@/lib/supabase/server';
import { Navbar } from '@/components/Navbar';
import { UserProfile } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let userProfile: UserProfile | null = null;

  if (user) {
    // Fetch full profile from public.users (chỉ khi đã đăng nhập)
    const { data: profile } = await supabase
      .from('users')
      .select('*')
      .eq('id', user.id)
      .single();

    userProfile = profile || {
      id: user.id,
      email: user.email || '',
      full_name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'User',
      role: user.user_metadata?.role || 'user',
      department: user.user_metadata?.department || null,
      created_at: user.created_at,
    };
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Navbar user={userProfile} />
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {children}
      </main>
    </div>
  );
}
