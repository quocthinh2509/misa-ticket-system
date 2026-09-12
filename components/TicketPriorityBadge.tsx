import React from 'react';
import { TicketPriority } from '@/lib/types';
import { cn } from '@/lib/utils';
import { ArrowDown, Minus, ArrowUp, Flame } from 'lucide-react';

interface Props {
  priority: TicketPriority;
  className?: string;
}

export function TicketPriorityBadge({ priority, className }: Props) {
  const config = {
    low: {
      label: 'Thấp',
      bg: 'bg-slate-100 text-slate-600 border-slate-200',
      icon: ArrowDown,
    },
    medium: {
      label: 'Trung bình',
      bg: 'bg-sky-50 text-sky-700 border-sky-200',
      icon: Minus,
    },
    high: {
      label: 'Cao',
      bg: 'bg-orange-50 text-orange-700 border-orange-200',
      icon: ArrowUp,
    },
    urgent: {
      label: 'Khẩn cấp',
      bg: 'bg-rose-50 text-rose-700 border-rose-200 animate-pulse',
      icon: Flame,
    },
  }[priority] || {
    label: priority,
    bg: 'bg-slate-100 text-slate-600 border-slate-200',
    icon: Minus,
  };

  const Icon = config.icon;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border',
        config.bg,
        className
      )}
    >
      <Icon className="w-3 h-3" />
      {config.label}
    </span>
  );
}
