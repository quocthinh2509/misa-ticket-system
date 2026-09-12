import React from 'react';
import { ExternalLink } from 'lucide-react';

interface FormattedTextProps {
  text: string;
  className?: string;
  variant?: 'default' | 'chat-me' | 'chat-other';
  showIcon?: boolean;
}

/**
 * Component tự động phát hiện và định dạng URL trong văn bản thành liên kết có thể nhấp được (Clickable Link)
 * Hỗ trợ http://, https://, và www.
 */
export function FormattedText({
  text,
  className = '',
  variant = 'default',
  showIcon = false,
}: FormattedTextProps) {
  if (!text) return null;

  const getLinkClasses = () => {
    switch (variant) {
      case 'chat-me':
        return 'text-sky-200 hover:text-white underline underline-offset-2 decoration-sky-300/70 hover:decoration-white font-medium break-all transition-colors';
      case 'chat-other':
        return 'text-indigo-600 hover:text-indigo-800 underline underline-offset-2 decoration-indigo-300 hover:decoration-indigo-600 font-medium break-all transition-colors';
      default:
        return 'text-indigo-600 hover:text-indigo-800 underline underline-offset-2 decoration-indigo-300 hover:decoration-indigo-600 font-medium break-all transition-colors';
    }
  };

  const linkClass = getLinkClasses();
  // Regex bắt URL bắt đầu bằng http://, https:// hoặc www.
  // Loại bỏ các dấu chấm câu dính ở cuối URL (., :, ;, !, ?, ), ], >)
  const urlRegex = /(https?:\/\/[^\s<]+[^<.,:;"')\]\s]|www\.[^\s<]+[^<.,:;"')\]\s])/gi;

  const elements: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = urlRegex.exec(text)) !== null) {
    const rawUrl = match[0];
    const startIndex = match.index;

    // Phần text trước URL
    if (startIndex > lastIndex) {
      elements.push(text.substring(lastIndex, startIndex));
    }

    // Đảm bảo URL có tiền tố giao thức https:// nếu bắt đầu bằng www.
    const href = rawUrl.toLowerCase().startsWith('www.')
      ? `https://${rawUrl}`
      : rawUrl;

    elements.push(
      <a
        key={`${startIndex}-${rawUrl}`}
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        className={linkClass}
      >
        {rawUrl}
        {showIcon && (
          <ExternalLink className="inline-block w-3 h-3 ml-0.5 -mt-0.5 opacity-70" />
        )}
      </a>
    );

    lastIndex = urlRegex.lastIndex;
  }

  // Phần text còn lại sau URL cuối cùng
  if (lastIndex < text.length) {
    elements.push(text.substring(lastIndex));
  }

  return <span className={className}>{elements}</span>;
}
