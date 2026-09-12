import React from 'react';
import Link from 'next/link';
import { Ticket } from '@/lib/types';
import { TicketStatusBadge } from './TicketStatusBadge';
import { TicketPriorityBadge } from './TicketPriorityBadge';
import { TagBadge } from './TagBadge';
import { formatDate } from '@/lib/utils';
import { User, Calendar, Folder, ArrowRight, UserCheck } from 'lucide-react';

interface Props {
  ticket: Ticket;
}

export function TicketCard({ ticket }: Props) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 p-5 hover:border-indigo-300 hover:shadow-lg hover:shadow-indigo-50/50 transition-all duration-200 group">
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-1.5 mb-2">
            <TicketStatusBadge status={ticket.status} />
            <TicketPriorityBadge priority={ticket.priority} />
            {ticket.drive_folder_id && (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                <Folder className="w-3 h-3 text-amber-500" />
                Drive
              </span>
            )}
            {ticket.tags && ticket.tags.map((tag) => (
              <TagBadge key={tag.id} tag={tag} />
            ))}
          </div>
          <Link
            href={`/tickets/${ticket.id}`}
            className="text-base font-bold text-slate-900 group-hover:text-indigo-600 transition-colors line-clamp-1"
          >
            {ticket.title}
          </Link>
        </div>

        <Link
          href={`/tickets/${ticket.id}`}
          className="w-8 h-8 rounded-lg bg-slate-50 group-hover:bg-indigo-600 group-hover:text-white flex items-center justify-center text-slate-400 transition-all flex-shrink-0"
        >
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>

      {ticket.description && (
        <p className="text-sm text-slate-500 line-clamp-2 mb-4 leading-relaxed">
          {ticket.description}
        </p>
      )}

      <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5" title="Người tạo">
            <User className="w-3.5 h-3.5 text-slate-400" />
            <span className="font-medium text-slate-700">
              {ticket.creator?.full_name || 'Người dùng'}
            </span>
            {ticket.creator?.department && (
              <span className="text-slate-400">({ticket.creator.department})</span>
            )}
          </div>

          <div className="flex items-center gap-1.5" title="Người phụ trách">
            <UserCheck className="w-3.5 h-3.5 text-slate-400" />
            {ticket.assignee ? (
              <span className="font-medium text-indigo-600">
                {ticket.assignee.full_name}
              </span>
            ) : (
              <span className="text-slate-400 italic">Chưa gán</span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 text-slate-400">
          <Calendar className="w-3.5 h-3.5" />
          <span>{formatDate(ticket.created_at)}</span>
        </div>
      </div>
    </div>
  );
}
