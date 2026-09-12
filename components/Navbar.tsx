'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { UserProfile } from '@/lib/types';
import { LifeBuoy, PlusCircle, LogOut, ShieldCheck, Headphones, User as UserIcon, Tag } from 'lucide-react';

interface Props {
  user: UserProfile | null;
}

export function Navbar({ user }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClient();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  const getRoleBadge = (role?: string) => {
    switch (role) {
      case 'admin':
        return (
          <span className="inline-flex items-center gap-1 bg-purple-50 text-purple-700 border border-purple-200 px-2 py-0.5 rounded text-xs font-semibold">
            <ShieldCheck className="w-3.5 h-3.5" /> Quản trị viên
          </span>
        );
      case 'agent':
        return (
          <span className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded text-xs font-semibold">
            <Headphones className="w-3.5 h-3.5" /> Hỗ trợ viên
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-700 border border-slate-200 px-2 py-0.5 rounded text-xs font-medium">
            <UserIcon className="w-3.5 h-3.5" /> Khách hàng / Nhân viên
          </span>
        );
    }
  };

  return (
    <header className="sticky top-0 z-30 bg-white border-b border-slate-200 shadow-sm backdrop-blur-md bg-white/90">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand logo */}
          <div className="flex items-center gap-6">
            <Link href="/tickets" className="flex items-center gap-2.5 group">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-500 flex items-center justify-center text-white shadow-md shadow-indigo-100 group-hover:scale-105 transition-transform">
                <LifeBuoy className="w-5 h-5" />
              </div>
              <div>
                <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
                  MISA Ticket
                </span>
                <span className="text-[10px] block text-slate-500 uppercase tracking-widest font-semibold">
                  Hỗ trợ kỹ thuật
                </span>
              </div>
            </Link>

            {/* Navigation links */}
            <nav className="hidden md:flex items-center gap-1 ml-4">
              <Link
                href="/tickets"
                className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  pathname === '/tickets'
                    ? 'bg-indigo-50 text-indigo-700 font-semibold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                Danh sách Ticket
              </Link>
              <Link
                href="/tickets/new"
                className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 ${
                  pathname === '/tickets/new'
                    ? 'bg-indigo-50 text-indigo-700 font-semibold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <PlusCircle className="w-4 h-4 text-indigo-600" />
                Tạo Ticket mới
              </Link>
              {user?.role === 'admin' && (
                <Link
                  href="/tags"
                  className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 ${
                    pathname === '/tags'
                      ? 'bg-purple-50 text-purple-700 font-semibold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <Tag className="w-4 h-4 text-purple-600" />
                  Quản lý Nhãn
                </Link>
              )}
            </nav>
          </div>

          {/* User profile & Logout */}
          <div className="flex items-center gap-4">
            {user && (
              <div className="flex items-center gap-3">
                <div className="hidden sm:block text-right">
                  <div className="text-sm font-semibold text-slate-800 leading-tight">
                    {user.full_name}
                  </div>
                  <div className="flex items-center justify-end gap-1.5 mt-0.5">
                    {user.department && (
                      <span className="text-xs text-slate-500 mr-1">
                        {user.department} •
                      </span>
                    )}
                    {getRoleBadge(user.role)}
                  </div>
                </div>

                <div className="w-9 h-9 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-sm border border-indigo-200">
                  {user.full_name ? user.full_name.charAt(0).toUpperCase() : 'U'}
                </div>

                <button
                  onClick={handleLogout}
                  title="Đăng xuất"
                  className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
