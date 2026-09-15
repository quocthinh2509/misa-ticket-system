'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { UserProfile } from '@/lib/types';
import {
  Users,
  UserPlus,
  Search,
  Mail,
  Shield,
  Briefcase,
  Calendar,
  CheckCircle,
  AlertCircle,
  Loader2,
  Copy,
  Check,
  X,
  UserCheck,
} from 'lucide-react';

interface ExtendedUser extends UserProfile {
  created_at?: string;
}

export default function UsersManagementPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [users, setUsers] = useState<ExtendedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');

  // State Modal mời thành viên
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'agent' | 'admin'>('agent');
  const [department, setDepartment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState('');

  // State thông báo thành công sau khi mời
  const [inviteSuccess, setInviteSuccess] = useState<{
    email: string;
    directInviteLink: string | null;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  const supabase = createClient();

  // 1. Kiểm tra quyền Admin & Tải danh sách users
  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const {
          data: { user: authUser },
        } = await supabase.auth.getUser();

        if (!authUser) {
          router.push('/login');
          return;
        }

        const { data: profile } = await supabase
          .from('users')
          .select('*')
          .eq('id', authUser.id)
          .single();

        if (!profile || profile.role !== 'admin') {
          router.push('/tickets');
          return;
        }

        setCurrentUser(profile);

        // Lấy danh sách toàn bộ thành viên
        const res = await fetch('/api/users');
        const data = await res.json();
        if (data.users) {
          setUsers(data.users);
        }
      } catch (err) {
        console.error('Lỗi khi tải dữ liệu người dùng:', err);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [router, supabase]);

  // 2. Xử lý mời thành viên mới
  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError('');
    setSubmitting(true);

    try {
      const res = await fetch('/api/users/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: fullName,
          email,
          role,
          department,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Không thể tạo lời mời thành viên');
      }

      // Cập nhật danh sách thành viên
      const usersRes = await fetch('/api/users');
      const usersData = await usersRes.json();
      if (usersData.users) {
        setUsers(usersData.users);
      }

      // Hiển thị thông báo thành công kèm direct invite link nếu có
      setInviteSuccess({
        email: email.trim().toLowerCase(),
        directInviteLink: data.directInviteLink || null,
      });

      // Reset form
      setFullName('');
      setEmail('');
      setDepartment('');
      setRole('agent');
    } catch (err: any) {
      console.error('Lỗi khi mời thành viên:', err);
      setModalError(err.message || 'Có lỗi xảy ra khi tạo lời mời');
    } finally {
      setSubmitting(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setModalError('');
    setInviteSuccess(null);
  };

  // 3. Lọc danh sách người dùng
  const filteredUsers = users.filter((u) => {
    const matchQuery =
      u.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.department?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchRole = roleFilter === 'all' || u.role === roleFilter;

    return matchQuery && matchRole;
  });

  const getRoleBadge = (r: string) => {
    switch (r) {
      case 'admin':
        return (
          <span className="inline-flex items-center gap-1.5 bg-rose-50 text-rose-700 border border-rose-200/80 px-2.5 py-1 rounded-full text-xs font-semibold">
            <Shield className="w-3.5 h-3.5 text-rose-500" />
            Quản trị viên (Admin)
          </span>
        );
      case 'agent':
        return (
          <span className="inline-flex items-center gap-1.5 bg-indigo-50 text-indigo-700 border border-indigo-200/80 px-2.5 py-1 rounded-full text-xs font-semibold">
            <UserCheck className="w-3.5 h-3.5 text-indigo-500" />
            Nhân viên hỗ trợ (Agent)
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 bg-slate-100 text-slate-700 border border-slate-200 px-2.5 py-1 rounded-full text-xs font-medium">
            Người dùng / Khách
          </span>
        );
    }
  };

  if (loading) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mb-3" />
        <p className="text-sm font-medium text-slate-500">Đang tải danh sách thành viên...</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-100">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                Quản lý Thành viên
              </h1>
              <p className="text-sm text-slate-500">
                Quản lý danh sách Agent hỗ trợ và Quản trị viên công ty Tú Lộc Tech
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={() => {
            setInviteSuccess(null);
            setModalError('');
            setIsModalOpen(true);
          }}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-semibold text-sm shadow-md shadow-indigo-200 transition"
        >
          <UserPlus className="w-4 h-4" />
          Mời thành viên mới
        </button>
      </div>

      {/* Filter & Search Toolbar */}
      <div className="mt-6 flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-80">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            placeholder="Tìm theo họ tên, email, phòng ban..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition shadow-sm"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Vai trò:
          </span>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="bg-white border border-slate-200 rounded-xl text-sm px-3 py-2 font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 shadow-sm"
          >
            <option value="all">Tất cả ({users.length})</option>
            <option value="admin">Quản trị viên ({users.filter((u) => u.role === 'admin').length})</option>
            <option value="agent">Agent hỗ trợ ({users.filter((u) => u.role === 'agent').length})</option>
            <option value="user">Người dùng ({users.filter((u) => u.role === 'user').length})</option>
          </select>
        </div>
      </div>

      {/* Users Table */}
      <div className="mt-6 bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold uppercase tracking-wider text-slate-500">
                <th className="py-3.5 px-6">Thành viên</th>
                <th className="py-3.5 px-6">Vai trò</th>
                <th className="py-3.5 px-6">Phòng ban</th>
                <th className="py-3.5 px-6">Ngày tham gia</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-12 text-center text-slate-500">
                    Không tìm thấy thành viên nào phù hợp.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50/70 transition">
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-indigo-500 to-indigo-700 text-white font-bold flex items-center justify-center text-sm shadow-sm flex-shrink-0">
                          {u.full_name?.charAt(0)?.toUpperCase() || u.email?.charAt(0)?.toUpperCase()}
                        </div>
                        <div>
                          <div className="font-semibold text-slate-900">
                            {u.full_name || 'Chưa cập nhật tên'}
                          </div>
                          <div className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                            <Mail className="w-3 h-3" />
                            {u.email}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-6">{getRoleBadge(u.role)}</td>
                    <td className="py-4 px-6">
                      {u.department ? (
                        <span className="inline-flex items-center gap-1.5 text-xs text-slate-600 font-medium bg-slate-100 px-2.5 py-1 rounded-md">
                          <Briefcase className="w-3.5 h-3.5 text-slate-400" />
                          {u.department}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>
                    <td className="py-4 px-6 text-xs text-slate-500">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        {u.created_at
                          ? new Date(u.created_at).toLocaleDateString('vi-VN', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric',
                            })
                          : '—'}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Mời Thành Viên Mới */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full overflow-hidden">
            {/* Modal Header */}
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <UserPlus className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-slate-900">Mời thành viên mới</h3>
              </div>
              <button
                onClick={closeModal}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6">
              {inviteSuccess ? (
                /* Thành công */
                <div className="text-center py-4">
                  <div className="w-12 h-12 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center mx-auto mb-3">
                    <CheckCircle className="w-6 h-6" />
                  </div>
                  <h4 className="text-lg font-bold text-slate-900 mb-1">
                    Đã gửi lời mời thành công!
                  </h4>
                  <p className="text-sm text-slate-600 mb-5">
                    Thư mời kích hoạt tài khoản đã được gửi đến email{' '}
                    <strong className="text-slate-900">{inviteSuccess.email}</strong>.
                  </p>

                  {inviteSuccess.directInviteLink && (
                    <div className="mb-6 text-left bg-slate-50 border border-slate-200 rounded-xl p-4">
                      <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                        Liên kết kích hoạt trực tiếp (Dự phòng):
                      </label>
                      <p className="text-xs text-slate-500 mb-2">
                        Bạn có thể sao chép liên kết này gửi trực tiếp cho nhân viên qua tin nhắn nội bộ:
                      </p>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          readOnly
                          value={inviteSuccess.directInviteLink}
                          className="w-full text-xs font-mono bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-700 select-all"
                        />
                        <button
                          type="button"
                          onClick={() => copyToClipboard(inviteSuccess.directInviteLink!)}
                          className="flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-sm transition"
                        >
                          {copied ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-300" />
                              Đã chép
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              Sao chép
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  )}

                  <button
                    onClick={closeModal}
                    className="w-full py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-sm transition"
                  >
                    Đóng
                  </button>
                </div>
              ) : (
                /* Form nhập */
                <form onSubmit={handleInvite} className="space-y-4">
                  {modalError && (
                    <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-2.5 text-rose-700 text-xs">
                      <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-500 mt-0.5" />
                      <span>{modalError}</span>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                      Họ và tên <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ví dụ: Nguyễn Văn An"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                      Email công việc <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="email"
                      required
                      placeholder="agent@tuloctech.vn"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                        Vai trò <span className="text-rose-500">*</span>
                      </label>
                      <select
                        value={role}
                        onChange={(e) => setRole(e.target.value as 'agent' | 'admin')}
                        className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
                      >
                        <option value="agent">Agent (Nhân viên hỗ trợ)</option>
                        <option value="admin">Admin (Quản trị viên)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                        Phòng ban
                      </label>
                      <input
                        type="text"
                        placeholder="Ví dụ: Kỹ thuật, CSKH"
                        value={department}
                        onChange={(e) => setDepartment(e.target.value)}
                        className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
                      />
                    </div>
                  </div>

                  <div className="pt-3 flex items-center justify-end gap-3">
                    <button
                      type="button"
                      onClick={closeModal}
                      className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 rounded-xl hover:bg-slate-100 transition"
                    >
                      Hủy
                    </button>
                    <button
                      type="submit"
                      disabled={submitting}
                      className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm shadow-md shadow-indigo-200 transition disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {submitting ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Đang gửi lời mời...
                        </>
                      ) : (
                        <>
                          <Mail className="w-4 h-4" />
                          Gửi lời mời kích hoạt
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
