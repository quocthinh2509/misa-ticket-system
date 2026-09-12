import React from 'react';
import { Tag } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Tag as TagIcon, X } from 'lucide-react';

interface Props {
  tag: Tag;
  onRemove?: () => void;
  className?: string;
  size?: 'sm' | 'md';
}

export function TagBadge({ tag, onRemove, className, size = 'sm' }: Props) {
  const color = tag.color || '#6366f1';

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 font-medium rounded-full transition-all',
        size === 'sm' ? 'text-[11px] px-2.5 py-0.5' : 'text-xs px-3 py-1',
        className
      )}
      style={{
        backgroundColor: `${color}15`, // 8-10% opacity for soft modern badge
        color: color,
        border: `1px solid ${color}40`,
      }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full flex-shrink-0"
        style={{ backgroundColor: color }}
      />
      <span>{tag.name}</span>

      {onRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="ml-0.5 hover:opacity-100 opacity-60 transition-opacity p-0.5 hover:bg-black/10 rounded-full"
          title="Gỡ nhãn"
        >
          <X className="w-3 h-3" />
        </button>
      )}
    </span>
  );
}
