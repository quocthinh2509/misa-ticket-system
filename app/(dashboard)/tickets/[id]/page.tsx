'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Ticket, UserProfile, Attachment, TicketStatus, TicketPriority, Tag } from '@/lib/types';
import { TicketStatusBadge } from '@/components/TicketStatusBadge';
import { TicketPriorityBadge } from '@/components/TicketPriorityBadge';
import { TagBadge } from '@/components/TagBadge';
import { FormattedText } from '@/components/FormattedText';
import { ChatBox } from '@/components/ChatBox';
import { formatDate } from '@/lib/utils';
import {
  ArrowLeft,
  Calendar,
  Clock,
  Folder,
  User,
  UserCheck,
  ExternalLink,
  FileText,
  Loader2,
  AlertCircle,
  Building,
  Tag as TagIcon,
  Plus,
  Mail,
  Lock,
} from 'lucide-react';

export default function TicketDetailPage() {
  const params = useParams();
  const ticketId = params.id as string;

  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
  const [staffUsers, setStaffUsers] = useState<UserProfile[]>([]);
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [isTagPickerOpen, setIsTagPickerOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Load current logged in user & ticket data
  const fetchData = async () => {
    try {
      setLoading(true);

      // 1. Kiểm tra trạng thái đăng nhập
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      setIsLoggedIn(!!user);

      if (user) {
        const { data: profile } = await supabase
          .from('users')
          .select('*')
          .eq('id', user.id)
          .single();

        setCurrentUser(profile);
      }

      // 2. Fetch ticket detail (public endpoint)
      const res = await fetch(`/api/tickets/${ticketId}`);
      const data = await res.json();

      if (!res.ok || !data.ticket) {
        throw new Error(data.error || 'Không tìm thấy ticket');
      }

      setTicket(data.ticket);
      setAttachments(data.attachments || []);

      // 3. Tải danh mục tags của hệ thống
      const tagsRes = await fetch('/api/tags');
      const tagsData = await tagsRes.json();
      if (tagsData.tags) {
        setAllTags(tagsData.tags);
      }

      // 4. If user is agent or admin, fetch staff list for assignee dropdown
      if (user) {
        const profileData = await supabase.from('users').select('role').eq('id', user.id).single();
        if (profileData.data?.role === 'admin' || profileData.data?.role === 'agent') {
          const staffRes = await fetch('/api/users');
          const staffData = await staffRes.json();
          if (staffData.users) {
            setStaffUsers(
              staffData.users.filter(
                (u: UserProfile) => u.role === 'admin' || u.role === 'agent'
              )
            );
          }
        }
      }
    } catch (err: any) {
      console.error('Lỗi khi tải chi tiết ticket:', err);
      setErrorMsg(err.message || 'Không thể tải chi tiết ticket');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [ticketId]);

  // Gắn nhãn vào ticket
  const handleAssignTag = async (tagId: string) => {
    try {
      const res = await fetch(`/api/tickets/${ticketId}/tags`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tag_id: tagId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gắn nhãn thất bại');

      if (data.tag && ticket) {
        setTicket({
          ...ticket,
          tags: [...(ticket.tags || []), data.tag],
        });
      }
      setIsTagPickerOpen(false);
    } catch (err: any) {
      alert(err.message || 'Gắn nhãn thất bại');
    }
  };

  // Gỡ nhãn khỏi ticket
  const handleRemoveTag = async (tagId: string) => {
    try {
      const res = await fetch(`/api/tickets/${ticketId}/tags?tag_id=${tagId}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Gỡ nhãn thất bại');
      }

      if (ticket) {
        setTicket({
          ...ticket,
          tags: (ticket.tags || []).filter((t) => t.id !== tagId),
        });
      }
    } catch (err: any) {
      alert(err.message || 'Gỡ nhãn thất bại');
    }
  };

  // Update Status / Priority / Assignee
  const handleUpdate = async (fields: Partial<Ticket>) => {
    setUpdating(true);
    try {
      const res = await fetch(`/api/tickets/${ticketId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fields),
      });

      const data = await res.json();
      if (!res.ok || !data.ticket) {
        throw new Error(data.error || 'Cập nhật thất bại');
      }

      setTicket(data.ticket);
    } catch (err: any) {
      alert(err.message || 'Cập nhật thất bại');
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-28">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mb-3" />
        <p className="text-sm text-slate-500 font-medium">Đang tải chi tiết ticket...</p>
      </div>
    );
  }

  if (errorMsg || !ticket) {
    return (
      <div className="max-w-xl mx-auto py-12 text-center">
        <div className="inline-flex p-3 rounded-full bg-rose-50 text-rose-500 mb-4">
          <AlertCircle className="w-8 h-8" />
        </div>
        <h2 className="text-lg font-bold text-slate-900 mb-2">
          {errorMsg || 'Không tìm thấy ticket'}
        </h2>
        <p className="text-sm text-slate-500 mb-6">
          Ticket này có thể đã bị xóa hoặc bạn không có quyền truy cập.
        </p>
        <Link
          href="/tickets"
          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Quay lại danh sách
        </Link>
      </div>
    );
  }

  const isStaff = currentUser?.role === 'admin' || currentUser?.role === 'agent';
  const creatorDisplay = ticket.creator?.full_name || ticket.guest_name || 'Khách';
  const creatorEmail = ticket.creator?.email || ticket.guest_email;

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <Link
          href="/tickets"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Quay lại danh sách ticket
        </Link>

        {/* Guest badge */}
        {!isLoggedIn && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 border border-amber-200 text-amber-700 text-xs font-medium rounded-full">
            <User className="w-3.5 h-3.5" />
            Đang xem với tư cách khách
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Ticket Metadata & Details */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 space-y-6">
            {/* Title & Status */}
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <TicketStatusBadge status={ticket.status} />
                <TicketPriorityBadge priority={ticket.priority} />
                {updating && (
                  <span className="text-xs text-indigo-600 flex items-center gap-1">
                    <Loader2 className="w-3 h-3 animate-spin" /> Đang cập nhật...
                  </span>
                )}
              </div>
              <h1 className="text-xl font-bold text-slate-900 leading-snug mb-3">
                {ticket.title}
              </h1>

              {/* Tags Section */}
              <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center gap-1.5 relative">
                {ticket.tags && ticket.tags.map((tag) => (
                  <TagBadge
                    key={tag.id}
                    tag={tag}
                    onRemove={isStaff ? () => handleRemoveTag(tag.id) : undefined}
                    size="md"
                  />
                ))}

                {/* Nút gắn thêm nhãn - chỉ dành cho staff */}
                {isStaff && (
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setIsTagPickerOpen(!isTagPickerOpen)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border border-dashed border-slate-300 text-slate-600 hover:text-indigo-600 hover:border-indigo-400 bg-slate-50 hover:bg-indigo-50/50 transition-all cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Gắn nhãn
                    </button>

                    {/* Popover chọn nhãn */}
                    {isTagPickerOpen && (
                      <div className="absolute left-0 top-full mt-2 w-56 bg-white rounded-2xl shadow-xl border border-slate-200 p-2 z-20 animate-in fade-in">
                        <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-2 py-1">
                          Chọn nhãn để gắn
                        </div>
                        <div className="max-h-48 overflow-y-auto space-y-1">
                          {allTags.filter((t) => !(ticket.tags || []).some((tt) => tt.id === t.id)).length > 0 ? (
                            allTags
                              .filter((t) => !(ticket.tags || []).some((tt) => tt.id === t.id))
                              .map((tag) => (
                                <button
                                  key={tag.id}
                                  type="button"
                                  onClick={() => handleAssignTag(tag.id)}
                                  className="w-full text-left px-2.5 py-1.5 rounded-xl hover:bg-slate-50 flex items-center gap-2 text-xs transition-colors"
                                >
                                  <span
                                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                                    style={{ backgroundColor: tag.color }}
                                  />
                                  <span className="font-medium text-slate-700 truncate">
                                    {tag.name}
                                  </span>
                                </button>
                              ))
                          ) : (
                            <div className="text-xs text-slate-400 italic p-2 text-center">
                              Đã gắn hết các nhãn có sẵn
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Quick Actions (chỉ dành cho staff đã đăng nhập) */}
            {isStaff ? (
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-3">
                <div className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  Thao tác quản lý
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">
                      Trạng thái
                    </label>
                    <select
                      disabled={updating}
                      value={ticket.status}
                      onChange={(e) =>
                        handleUpdate({ status: e.target.value as TicketStatus })
                      }
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-800 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                    >
                      <option value="open">Mới tạo</option>
                      <option value="in_progress">Đang xử lý</option>
                      <option value="resolved">Đã giải quyết</option>
                      <option value="closed">Đã đóng</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs text-slate-500 mb-1">
                      Mức độ ưu tiên
                    </label>
                    <select
                      disabled={updating}
                      value={ticket.priority}
                      onChange={(e) =>
                        handleUpdate({ priority: e.target.value as TicketPriority })
                      }
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-800 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                    >
                      <option value="low">Thấp</option>
                      <option value="medium">Trung bình</option>
                      <option value="high">Cao</option>
                      <option value="urgent">Khẩn cấp</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-slate-500 mb-1">
                    Nhân viên phụ trách
                  </label>
                  <select
                    disabled={updating}
                    value={ticket.assigned_to || ''}
                    onChange={(e) =>
                      handleUpdate({ assigned_to: e.target.value || null })
                    }
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-800 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                  >
                    <option value="">-- Chưa phân công --</option>
                    {staffUsers.map((staff) => (
                      <option key={staff.id} value={staff.id}>
                        {staff.full_name} ({staff.role})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ) : (
              /* Guest: chỉ xem trạng thái, không chỉnh sửa */
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80">
                <div className="flex items-center gap-2 text-xs text-slate-500 mb-2">
                  <Lock className="w-3.5 h-3.5" />
                  <span className="font-semibold uppercase tracking-wider">Thông tin xử lý</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">Phụ trách:</span>
                  <span className="text-xs font-semibold text-indigo-600">
                    {ticket.assignee?.full_name || 'Chưa phân công'}
                  </span>
                </div>
              </div>
            )}

            {/* Description */}
            <div>
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                Mô tả chi tiết
              </h3>
              <div className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed bg-slate-50/50 p-3.5 rounded-xl border border-slate-100">
                {ticket.description ? (
                  <FormattedText text={ticket.description} showIcon={true} />
                ) : (
                  <span className="italic text-slate-400">Không có mô tả</span>
                )}
              </div>
            </div>

            {/* Google Drive Folder Link */}
            {ticket.drive_folder_id && (
              <div className="p-3.5 rounded-xl bg-indigo-50/60 border border-indigo-100 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center">
                    <Folder className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-800">
                      Thư mục Google Drive
                    </div>
                    <div className="text-[11px] text-slate-500">
                      Chứa toàn bộ file & ảnh của ticket này
                    </div>
                  </div>
                </div>

                <a
                  href={`https://drive.google.com/drive/folders/${ticket.drive_folder_id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 px-3 py-1.5 bg-white text-indigo-600 hover:text-indigo-700 text-xs font-semibold rounded-lg shadow-sm border border-slate-200 transition-colors"
                >
                  Mở Drive
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            )}

            {/* Attachments List */}
            {attachments.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                  Tệp đính kèm ({attachments.length})
                </h3>
                <div className="space-y-2">
                  {attachments.map((file) => (
                    <a
                      key={file.id}
                      href={`https://drive.google.com/file/d/${file.drive_file_id}/view`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between p-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs text-slate-700 transition-colors group"
                    >
                      <div className="flex items-center gap-2 truncate pr-2">
                        <FileText className="w-4 h-4 text-indigo-500 flex-shrink-0" />
                        <span className="truncate font-medium group-hover:text-indigo-600">
                          {file.file_name}
                        </span>
                      </div>
                      <ExternalLink className="w-3.5 h-3.5 text-slate-400 group-hover:text-indigo-600 flex-shrink-0" />
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* People & Meta info */}
            <div className="pt-4 border-t border-slate-100 space-y-2.5 text-xs text-slate-500">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-slate-400">
                  <User className="w-3.5 h-3.5" /> Người tạo:
                </span>
                <div className="text-right">
                  <span className="font-semibold text-slate-700 block">
                    {creatorDisplay}
                  </span>
                  {creatorEmail && (
                    <span className="text-slate-400 flex items-center gap-0.5 justify-end">
                      <Mail className="w-3 h-3" />
                      {creatorEmail}
                    </span>
                  )}
                </div>
              </div>

              {ticket.creator?.department && (
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-slate-400">
                    <Building className="w-3.5 h-3.5" /> Phòng ban:
                  </span>
                  <span className="text-slate-700">{ticket.creator.department}</span>
                </div>
              )}

              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-slate-400">
                  <UserCheck className="w-3.5 h-3.5" /> Phụ trách:
                </span>
                <span className="font-semibold text-indigo-600">
                  {ticket.assignee?.full_name || 'Chưa phân công'}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-slate-400">
                  <Calendar className="w-3.5 h-3.5" /> Ngày tạo:
                </span>
                <span>{formatDate(ticket.created_at)}</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-slate-400">
                  <Clock className="w-3.5 h-3.5" /> Cập nhật lần cuối:
                </span>
                <span>{formatDate(ticket.updated_at)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Chat */}
        <div className="lg:col-span-7">
          {isLoggedIn && currentUser ? (
            /* Chat đầy đủ cho user đã đăng nhập */
            <ChatBox
              ticketId={ticket.id}
              currentUser={currentUser}
              driveFolderId={ticket.drive_folder_id}
            />
          ) : (
            /* Thông báo chat cho guest */
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-slate-100 bg-slate-50">
                <h3 className="text-sm font-bold text-slate-700">Lịch sử hỗ trợ</h3>
              </div>
              <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
                <div className="w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-500 flex items-center justify-center mb-4">
                  <Lock className="w-7 h-7" />
                </div>
                <h4 className="text-base font-bold text-slate-800 mb-2">
                  Đăng nhập để xem & trả lời
                </h4>
                <p className="text-sm text-slate-500 max-w-xs mb-6">
                  Phần hội thoại hỗ trợ chỉ dành cho nhân viên và người dùng đã đăng nhập.
                </p>
                <Link
                  href="/login"
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl transition-colors shadow-md shadow-indigo-100"
                >
                  Đăng nhập
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
