import React from 'react';
import { TicketStatus } from '@/lib/types';
import { cn } from '@/lib/utils';
import { AlertCircle, Clock, CheckCircle2, XCircle } from 'lucide-react';

interface Props {
  status: TicketStatus;
  className?: string;
}

export function TicketStatusBadge({ status, className }: Props) {
  const config = {
    open: {
      label: 'Mới tạo',
      bg: 'bg-amber-50 text-amber-700 border-amber-200',
      icon: AlertCircle,
    },
    in_progress: {
      label: 'Đang xử lý',
      bg: 'bg-blue-50 text-blue-700 border-blue-200',
      icon: Clock,
    },
    resolved: {
      label: 'Đã giải quyết',
      bg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      icon: CheckCircle2,
    },
    closed: {
      label: 'Đã đóng',
      bg: 'bg-slate-100 text-slate-600 border-slate-200',
      icon: XCircle,
    },
  }[status] || {
    label: status,
    bg: 'bg-slate-100 text-slate-600 border-slate-200',
    icon: Clock,
  };

  const Icon = config.icon;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border transition-colors',
        config.bg,
        className
      )}
    >
      <Icon className="w-3.5 h-3.5" />
      {config.label}
    </span>
  );
}
