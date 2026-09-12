'use client';

import React, { useState, useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { ChatLog, UserProfile, Attachment } from '@/lib/types';
import { formatTime } from '@/lib/utils';
import {
  Send,
  Paperclip,
  Image as ImageIcon,
  Loader2,
  FileText,
  ExternalLink,
  ShieldCheck,
  Headphones,
  X,
  Maximize2,
} from 'lucide-react';

interface Props {
  ticketId: string;
  currentUser: UserProfile;
  driveFolderId?: string | null;
}

export function ChatBox({ ticketId, currentUser, driveFolderId }: Props) {
  const [messages, setMessages] = useState<ChatLog[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  
  // Pending file to send (either from file picker or clipboard paste Ctrl+V)
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingPreviewUrl, setPendingPreviewUrl] = useState<string | null>(null);

  // Fullscreen image preview modal
  const [previewModalImg, setPreviewModalImg] = useState<{ url: string; name: string } | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Fetch initial chat messages
  const fetchMessages = async () => {
    try {
      const res = await fetch(`/api/tickets/${ticketId}/chat`);
      const data = await res.json();
      if (data.messages) {
        setMessages(data.messages);
      }
    } catch (err) {
      console.error('Lỗi lấy lịch sử chat:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMessages();
  }, [ticketId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Realtime subscription using Supabase Channel
  useEffect(() => {
    const channel = supabase
      .channel(`ticket-chat-${ticketId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_logs',
          filter: `ticket_id=eq.${ticketId}`,
        },
        async (payload) => {
          const newMsg = payload.new as ChatLog;

          // Lấy thông tin sender và attachments nếu có
          const { data: sender } = await supabase
            .from('users')
            .select('*')
            .eq('id', newMsg.sender_id)
            .single();

          const { data: attachments } = await supabase
            .from('attachments')
            .select('*')
            .eq('chat_log_id', newMsg.id);

          setMessages((prev) => {
            if (prev.some((m) => m.id === newMsg.id)) return prev;
            return [
              ...prev,
              {
                ...newMsg,
                sender: sender || undefined,
                attachments: attachments || [],
                attachment: attachments?.[0] || null,
              },
            ];
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [ticketId, supabase]);

  // Xử lý chọn tệp từ nút bấm
  const handleSelectFile = (file: File) => {
    setPendingFile(file);
    if (file.type.startsWith('image/')) {
      const url = URL.createObjectURL(file);
      setPendingPreviewUrl(url);
    } else {
      setPendingPreviewUrl(null);
    }
  };

  const clearPendingFile = () => {
    if (pendingPreviewUrl) {
      URL.revokeObjectURL(pendingPreviewUrl);
    }
    setPendingFile(null);
    setPendingPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (imageInputRef.current) imageInputRef.current.value = '';
  };

  // Hỗ trợ dán ảnh trực tiếp từ Clipboard (Ctrl + V)
  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        const blob = items[i].getAsFile();
        if (blob) {
          const file = new File([blob], `screenshot_${Date.now()}.png`, { type: blob.type });
          handleSelectFile(file);
          e.preventDefault();
          break;
        }
      }
    }
  };

  // Gửi tin nhắn (kèm tệp/ảnh nếu có)
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (sending) return;

    const messageText = inputMessage.trim();
    if (!messageText && !pendingFile) return;

    setSending(true);

    try {
      if (pendingFile) {
        // Gửi qua API upload attachment kèm nội dung tin nhắn
        const formData = new FormData();
        formData.append('file', pendingFile);
        formData.append('message', messageText || `Đã đính kèm ảnh: ${pendingFile.name}`);

        const res = await fetch(`/api/tickets/${ticketId}/attachments`, {
          method: 'POST',
          body: formData,
        });

        if (!res.ok) {
          const errJson = await res.json().catch(() => ({}));
          throw new Error(errJson.error || 'Upload ảnh/tệp thất bại');
        }

        clearPendingFile();
        setInputMessage('');
      } else {
        // Gửi tin nhắn văn bản thông thường
        const res = await fetch(`/api/tickets/${ticketId}/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: messageText }),
        });

        if (!res.ok) {
          throw new Error('Không thể gửi tin nhắn');
        }

        setInputMessage('');
      }
    } catch (err: any) {
      console.error('Lỗi khi gửi tin nhắn:', err);
      alert(err.message || 'Không thể gửi tin nhắn');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex flex-col h-[680px] bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
      {/* Chat header */}
      <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
        <div>
          <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
            Lịch sử trao đổi & Chat trực tiếp
            <span className="inline-flex items-center gap-1 text-[11px] font-normal text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              Realtime
            </span>
          </h3>
        </div>

        {driveFolderId && (
          <a
            href={`https://drive.google.com/drive/folders/${driveFolderId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100/70 px-2.5 py-1 rounded-lg border border-indigo-100 transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Mở Folder Drive
          </a>
        )}
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-6 h-6 text-indigo-600 animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center text-slate-400">
            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-2 text-slate-400">
              <ImageIcon className="w-6 h-6" />
            </div>
            <p className="text-sm font-medium text-slate-600">Chưa có tin nhắn nào</p>
            <p className="text-xs mt-1 text-slate-400 max-w-xs">
              Bạn có thể gửi tin nhắn văn bản, bấm biểu tượng ảnh hoặc nhấn <b>Ctrl + V</b> để dán ảnh chụp màn hình trực tiếp.
            </p>
          </div>
        ) : (
          messages.map((msg) => {
            // System message rendering
            if (msg.message_type === 'system') {
              return (
                <div key={msg.id} className="flex justify-center my-2">
                  <div className="text-xs bg-slate-100 text-slate-600 px-3 py-1 rounded-full border border-slate-200/80 font-medium shadow-2xs">
                    {msg.message}
                  </div>
                </div>
              );
            }

            const isMe = msg.sender_id === currentUser.id;
            const role = msg.sender?.role;
            const attachedList: Attachment[] =
              msg.attachments && msg.attachments.length > 0
                ? msg.attachments
                : msg.attachment
                ? [msg.attachment]
                : [];

            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
              >
                {/* Sender info */}
                <div className="flex items-center gap-1.5 mb-1 px-1 text-xs text-slate-500">
                  <span className="font-semibold text-slate-700">
                    {isMe ? 'Bạn' : msg.sender?.full_name || 'Người dùng'}
                  </span>
                  {role === 'admin' && (
                    <span className="text-[10px] text-purple-600 bg-purple-50 border border-purple-200 px-1.5 py-0.2 rounded font-medium flex items-center gap-0.5">
                      <ShieldCheck className="w-2.5 h-2.5" /> Admin
                    </span>
                  )}
                  {role === 'agent' && (
                    <span className="text-[10px] text-indigo-600 bg-indigo-50 border border-indigo-200 px-1.5 py-0.2 rounded font-medium flex items-center gap-0.5">
                      <Headphones className="w-2.5 h-2.5" /> Agent
                    </span>
                  )}
                  <span className="text-[11px] text-slate-400">
                    {formatTime(msg.created_at)}
                  </span>
                </div>

                {/* Message bubble */}
                <div
                  className={`max-w-[85%] sm:max-w-[75%] rounded-2xl p-3.5 shadow-sm text-sm ${
                    isMe
                      ? 'bg-indigo-600 text-white rounded-tr-none'
                      : 'bg-slate-100 text-slate-800 rounded-tl-none border border-slate-200/80'
                  }`}
                >
                  {/* Text content */}
                  {msg.message && (
                    <p className="whitespace-pre-wrap break-words leading-relaxed">
                      {msg.message}
                    </p>
                  )}

                  {/* Render attached files & images */}
                  {attachedList.length > 0 && (
                    <div className="mt-2.5 space-y-2">
                      {attachedList.map((att) => {
                        const isImage =
                          att.file_type?.startsWith('image/') ||
                          /\.(png|jpe?g|gif|webp|bmp)$/i.test(att.file_name);

                        const streamUrl = `/api/drive/file/${att.drive_file_id}`;

                        if (isImage) {
                          return (
                            <div key={att.id} className="relative group rounded-xl overflow-hidden border border-black/10 bg-black/5">
                              <img
                                src={streamUrl}
                                alt={att.file_name}
                                className="max-h-72 w-auto object-cover rounded-xl cursor-pointer hover:opacity-95 transition-opacity"
                                onClick={() =>
                                  setPreviewModalImg({
                                    url: streamUrl,
                                    name: att.file_name,
                                  })
                                }
                                loading="lazy"
                              />
                              <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setPreviewModalImg({
                                      url: streamUrl,
                                      name: att.file_name,
                                    })
                                  }
                                  title="Xem ảnh phóng to"
                                  className="p-1.5 bg-black/60 hover:bg-black/80 text-white rounded-lg backdrop-blur-sm transition-colors"
                                >
                                  <Maximize2 className="w-3.5 h-3.5" />
                                </button>
                                <a
                                  href={`https://drive.google.com/file/d/${att.drive_file_id}/view`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  title="Mở trên Google Drive"
                                  className="p-1.5 bg-black/60 hover:bg-black/80 text-white rounded-lg backdrop-blur-sm transition-colors"
                                >
                                  <ExternalLink className="w-3.5 h-3.5" />
                                </a>
                              </div>
                            </div>
                          );
                        }

                        // Normal document/file
                        return (
                          <a
                            key={att.id}
                            href={`https://drive.google.com/file/d/${att.drive_file_id}/view`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`flex items-center gap-2 p-2.5 rounded-xl text-xs transition-colors ${
                              isMe
                                ? 'bg-white/10 hover:bg-white/20 text-white border border-white/20'
                                : 'bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 shadow-2xs'
                            }`}
                          >
                            <FileText className="w-4 h-4 flex-shrink-0" />
                            <span className="truncate font-medium flex-1">
                              {att.file_name}
                            </span>
                            <ExternalLink className="w-3.5 h-3.5 opacity-70" />
                          </a>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Pending file preview bar */}
      {pendingFile && (
        <div className="px-4 py-2 bg-indigo-50/80 border-t border-indigo-100 flex items-center justify-between gap-3 animate-in fade-in slide-in-from-bottom-2">
          <div className="flex items-center gap-3 overflow-hidden">
            {pendingPreviewUrl ? (
              <img
                src={pendingPreviewUrl}
                alt="Preview"
                className="w-10 h-10 object-cover rounded-lg border border-indigo-200"
              />
            ) : (
              <div className="w-10 h-10 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center">
                <FileText className="w-5 h-5" />
              </div>
            )}
            <div className="truncate text-xs">
              <span className="font-semibold text-slate-800 block truncate">
                {pendingFile.name}
              </span>
              <span className="text-slate-500">
                {(pendingFile.size / 1024).toFixed(0)} KB • Sẵn sàng gửi lên Drive
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={clearPendingFile}
            className="p-1 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Input area */}
      <div className="p-3 border-t border-slate-100 bg-white">
        <form onSubmit={handleSendMessage} className="flex items-center gap-2">
          {/* File Picker (Any file) */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={(e) => e.target.files?.[0] && handleSelectFile(e.target.files[0])}
            className="hidden"
            id="chat-file-upload"
          />
          <button
            type="button"
            disabled={sending}
            onClick={() => fileInputRef.current?.click()}
            title="Đính kèm tài liệu (PDF, Word, Excel, ZIP...)"
            className="p-2.5 rounded-xl text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 border border-slate-200 transition-colors disabled:opacity-50 cursor-pointer"
          >
            <Paperclip className="w-4 h-4" />
          </button>

          {/* Image Picker (Images only) */}
          <input
            type="file"
            ref={imageInputRef}
            accept="image/*"
            onChange={(e) => e.target.files?.[0] && handleSelectFile(e.target.files[0])}
            className="hidden"
            id="chat-image-upload"
          />
          <button
            type="button"
            disabled={sending}
            onClick={() => imageInputRef.current?.click()}
            title="Gửi hình ảnh"
            className="p-2.5 rounded-xl text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 border border-slate-200 transition-colors disabled:opacity-50 cursor-pointer"
          >
            <ImageIcon className="w-4 h-4" />
          </button>

          <input
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onPaste={handlePaste}
            placeholder={
              pendingFile
                ? 'Thêm chú thích cho ảnh/tệp (nhấn Enter để gửi)...'
                : 'Nhập tin nhắn (hoặc nhấn Ctrl + V để dán ảnh)...'
            }
            disabled={sending}
            className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 text-slate-900 placeholder:text-slate-400 transition-all"
          />

          <button
            type="submit"
            disabled={sending || (!inputMessage.trim() && !pendingFile)}
            className="p-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-md shadow-indigo-100 transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex-shrink-0"
          >
            {sending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </form>
      </div>

      {/* Fullscreen Image Preview Lightbox Modal */}
      {previewModalImg && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in"
          onClick={() => setPreviewModalImg(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh] flex flex-col items-center">
            <button
              onClick={() => setPreviewModalImg(null)}
              className="absolute -top-10 right-0 text-white hover:text-slate-300 p-2"
            >
              <X className="w-6 h-6" />
            </button>
            <img
              src={previewModalImg.url}
              alt={previewModalImg.name}
              className="max-h-[80vh] w-auto object-contain rounded-xl shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
            <p className="text-white text-xs mt-3 opacity-80">
              {previewModalImg.name}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
