'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Ticket, Tag } from '@/lib/types';
import { TicketStatusBadge } from '@/components/TicketStatusBadge';
import { TicketPriorityBadge } from '@/components/TicketPriorityBadge';
import { TagBadge } from '@/components/TagBadge';
import { formatDate } from '@/lib/utils';
import {
  PlusCircle,
  Search,
  Filter,
  Inbox,
  Loader2,
  RefreshCw,
  Tag as TagIcon,
  ChevronRight,
  User,
  Hash,
} from 'lucide-react';

export default function TicketsListPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [tagFilter, setTagFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const fetchTickets = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/tickets');
      const data = await res.json();
      if (data.tickets) {
        setTickets(data.tickets);
      }
    } catch (err) {
      console.error('Lỗi lấy danh sách ticket:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchTags = async () => {
    try {
      const res = await fetch('/api/tags');
      const data = await res.json();
      if (data.tags) {
        setTags(data.tags);
      }
    } catch (err) {
      console.error('Lỗi lấy danh sách tags:', err);
    }
  };

  useEffect(() => {
    fetchTickets();
    fetchTags();
  }, []);

  // Filtering
  const filteredTickets = tickets.filter((ticket) => {
    const matchStatus = statusFilter === 'all' || ticket.status === statusFilter;
    const matchPriority = priorityFilter === 'all' || ticket.priority === priorityFilter;
    const matchTag =
      tagFilter === 'all' ||
      (ticket.tags && ticket.tags.some((t) => t.id === tagFilter));

    const creatorName = ticket.creator?.full_name || ticket.guest_name || '';
    const matchQuery =
      searchQuery.trim() === '' ||
      ticket.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (ticket.description && ticket.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
      creatorName.toLowerCase().includes(searchQuery.toLowerCase());

    return matchStatus && matchPriority && matchTag && matchQuery;
  });

  const statusTabs: { id: string; label: string }[] = [
    { id: 'all', label: 'Tất cả' },
    { id: 'open', label: 'Mới tạo' },
    { id: 'in_progress', label: 'Đang xử lý' },
    { id: 'resolved', label: 'Đã giải quyết' },
    { id: 'closed', label: 'Đã đóng' },
  ];

  // Lấy tên hiển thị của người tạo ticket
  const getCreatorDisplay = (ticket: Ticket) => {
    if (ticket.creator?.full_name) return ticket.creator.full_name;
    if (ticket.guest_name) return ticket.guest_name;
    return 'Khách';
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Hệ thống Hỗ trợ Kỹ thuật
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Gửi yêu cầu hỗ trợ hoặc theo dõi tiến độ xử lý ticket của bạn
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchTickets}
            title="Làm mới danh sách"
            className="p-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition-colors shadow-sm"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <Link
            href="/tickets/new"
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl shadow-md shadow-indigo-100 transition-all cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            Tạo Ticket mới
          </Link>
        </div>
      </div>

      {/* Filters and Search Bar */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm space-y-4">
        {/* Status Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 border-b border-slate-100">
          {statusTabs.map((tab) => {
            const count =
              tab.id === 'all'
                ? tickets.length
                : tickets.filter((t) => t.status === tab.id).length;

            const isActive = statusFilter === tab.id;

            return (
              <button
                key={tab.id}
                onClick={() => setStatusFilter(tab.id)}
                className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap flex items-center gap-2 ${
                  isActive
                    ? 'bg-indigo-50 text-indigo-700 font-semibold shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                {tab.label}
                <span
                  className={`text-xs px-2 py-0.5 rounded-full ${
                    isActive
                      ? 'bg-indigo-200/60 text-indigo-800'
                      : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Search & Priority Filter Controls */}
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm kiếm theo tiêu đề, mô tả hoặc người tạo..."
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 text-slate-900 placeholder:text-slate-400 transition-all"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            {/* Lọc mức độ ưu tiên */}
            <div className="flex items-center gap-1.5 flex-1 sm:flex-initial">
              <Filter className="w-4 h-4 text-slate-400 flex-shrink-0" />
              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
                className="w-full sm:w-auto px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 text-slate-700 transition-all"
              >
                <option value="all">Tất cả mức độ ưu tiên</option>
                <option value="urgent">Khẩn cấp</option>
                <option value="high">Cao</option>
                <option value="medium">Trung bình</option>
                <option value="low">Thấp</option>
              </select>
            </div>

            {/* Lọc theo Nhãn (Tag) */}
            {tags.length > 0 && (
              <div className="flex items-center gap-1.5 flex-1 sm:flex-initial">
                <TagIcon className="w-4 h-4 text-slate-400 flex-shrink-0" />
                <select
                  value={tagFilter}
                  onChange={(e) => setTagFilter(e.target.value)}
                  className="w-full sm:w-auto px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 text-slate-700 transition-all"
                >
                  <option value="all">Tất cả nhãn</option>
                  {tags.map((tag) => (
                    <option key={tag.id} value={tag.id}>
                      {tag.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Ticket Table */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-slate-200/80">
          <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mb-3" />
          <p className="text-sm text-slate-500 font-medium">Đang tải danh sách ticket...</p>
        </div>
      ) : filteredTickets.length > 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          {/* Table Header */}
          <div className="grid grid-cols-[2rem_1fr_7rem_7rem_8rem_7rem_7rem_2rem] items-center gap-3 px-4 py-3 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
            <div className="flex items-center gap-1">
              <Hash className="w-3 h-3" />
            </div>
            <div>Tiêu đề</div>
            <div>Trạng thái</div>
            <div>Ưu tiên</div>
            <div>Nhãn</div>
            <div className="flex items-center gap-1">
              <User className="w-3 h-3" />
              Người tạo
            </div>
            <div>Ngày tạo</div>
            <div></div>
          </div>

          {/* Table Rows */}
          <div className="divide-y divide-slate-100">
            {filteredTickets.map((ticket, index) => (
              <Link
                key={ticket.id}
                href={`/tickets/${ticket.id}`}
                className="grid grid-cols-[2rem_1fr_7rem_7rem_8rem_7rem_7rem_2rem] items-center gap-3 px-4 py-3.5 hover:bg-indigo-50/40 transition-colors group cursor-pointer"
              >
                {/* Index */}
                <div className="text-xs text-slate-400 font-mono">
                  {index + 1}
                </div>

                {/* Title */}
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-800 group-hover:text-indigo-700 truncate transition-colors">
                    {ticket.title}
                  </p>
                  {ticket.description && (
                    <p className="text-xs text-slate-400 truncate mt-0.5">
                      {ticket.description}
                    </p>
                  )}
                </div>

                {/* Status */}
                <div>
                  <TicketStatusBadge status={ticket.status} />
                </div>

                {/* Priority */}
                <div>
                  <TicketPriorityBadge priority={ticket.priority} />
                </div>

                {/* Tags */}
                <div className="flex flex-wrap gap-1 min-w-0">
                  {ticket.tags && ticket.tags.length > 0 ? (
                    <>
                      <TagBadge tag={ticket.tags[0]} size="sm" />
                      {ticket.tags.length > 1 && (
                        <span className="text-xs text-slate-400 px-1.5 py-0.5 rounded-full bg-slate-100">
                          +{ticket.tags.length - 1}
                        </span>
                      )}
                    </>
                  ) : (
                    <span className="text-xs text-slate-300 italic">—</span>
                  )}
                </div>

                {/* Creator */}
                <div className="text-xs text-slate-600 truncate">
                  {getCreatorDisplay(ticket)}
                </div>

                {/* Date */}
                <div className="text-xs text-slate-400">
                  {formatDate(ticket.created_at)}
                </div>

                {/* Arrow */}
                <div className="flex justify-end">
                  <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-500 transition-colors" />
                </div>
              </Link>
            ))}
          </div>

          {/* Table Footer */}
          <div className="px-4 py-3 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between">
            <p className="text-xs text-slate-500">
              Hiển thị <span className="font-semibold text-slate-700">{filteredTickets.length}</span> / {tickets.length} ticket
            </p>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-16 bg-white rounded-2xl border border-dashed border-slate-300 text-center px-4">
          <div className="w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-4">
            <Inbox className="w-7 h-7" />
          </div>
          <h3 className="text-base font-bold text-slate-900 mb-1">
            Không tìm thấy ticket nào
          </h3>
          <p className="text-sm text-slate-500 max-w-sm mb-6">
            {searchQuery || statusFilter !== 'all' || priorityFilter !== 'all'
              ? 'Không có ticket nào khớp với bộ lọc hiện tại của bạn.'
              : 'Hiện chưa có ticket nào trong hệ thống. Hãy tạo ticket đầu tiên để bắt đầu!'}
          </p>
          <Link
            href="/tickets/new"
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl shadow transition-colors"
          >
            <PlusCircle className="w-4 h-4" />
            Tạo Ticket mới ngay
          </Link>
        </div>
      )}
    </div>
  );
}
