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
  User,
  X,
  Maximize2,
  Pencil,
} from 'lucide-react';
import { FormattedText } from '@/components/FormattedText';
import { ImageEditorModal } from '@/components/ImageEditorModal';

interface Props {
  ticketId: string;
  currentUser: UserProfile | null;
  driveFolderId?: string | null;
}

// ─── Pending file entry ──────────────────────────────────────────────────────

interface PendingEntry {
  file: File;
  previewUrl: string | null; // null nếu không phải ảnh
  displayName: string;       // tên hiển thị (có thể được đặt lại)
}

export function ChatBox({ ticketId, currentUser, driveFolderId }: Props) {
  const [messages, setMessages] = useState<ChatLog[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [mySentMsgIds, setMySentMsgIds] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = sessionStorage.getItem(`sent_msgs_${ticketId}`);
        return saved ? JSON.parse(saved) : [];
      } catch {
        return [];
      }
    }
    return [];
  });

  // ── Danh sách file chờ gửi (hỗ trợ nhiều file) ──
  const [pendingEntries, setPendingEntries] = useState<PendingEntry[]>([]);

  // ── Image editor: chỉ mở khi user bấm nút "Sửa" ──
  const [showImageEditor, setShowImageEditor] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number>(-1);

  // ── Rename state ──
  const [renamingIndex, setRenamingIndex] = useState<number>(-1);
  const [renameValue, setRenameValue] = useState('');

  // ── Lightbox xem ảnh đã gửi ──
  const [previewModalImg, setPreviewModalImg] = useState<{ url: string; name: string } | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();

  const markMessageAsMine = (msgId: string) => {
    setMySentMsgIds((prev) => {
      const updated = [...prev, msgId];
      try {
        sessionStorage.setItem(`sent_msgs_${ticketId}`, JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // ── Fetch lịch sử chat ────────────────────────────────────────────────────

  const fetchMessages = async () => {
    try {
      const res = await fetch(`/api/tickets/${ticketId}/chat`);
      const data = await res.json();
      if (data.messages) setMessages(data.messages);
    } catch (err) {
      console.error('Lỗi lấy lịch sử chat:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchMessages(); }, [ticketId]);
  useEffect(() => { scrollToBottom(); }, [messages]);

  // ── Realtime subscription ─────────────────────────────────────────────────

  useEffect(() => {
    const channel = supabase
      .channel(`ticket-chat-${ticketId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_logs', filter: `ticket_id=eq.${ticketId}` },
        async (payload) => {
          const newMsg = payload.new as ChatLog;
          let sender = null;
          if (newMsg.sender_id) {
            const { data: senderData } = await supabase
              .from('users').select('*').eq('id', newMsg.sender_id).single();
            sender = senderData;
          }
          const { data: attachments } = await supabase
            .from('attachments').select('*').eq('chat_log_id', newMsg.id);
          setMessages((prev) => {
            if (prev.some((m) => m.id === newMsg.id)) return prev;
            return [...prev, { ...newMsg, sender: sender || undefined, attachments: attachments || [], attachment: attachments?.[0] || null }];
          });
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [ticketId, supabase]);

  // ── Thêm file vào pending list (không tự mở editor) ──────────────────────

  const addFiles = (files: File[]) => {
    const newEntries: PendingEntry[] = files.map((f) => ({
      file: f,
      previewUrl: f.type.startsWith('image/') ? URL.createObjectURL(f) : null,
      displayName: f.name,
    }));
    setPendingEntries((prev) => [...prev, ...newEntries]);
  };

  const removePendingEntry = (idx: number) => {
    setPendingEntries((prev) => {
      const entry = prev[idx];
      if (entry?.previewUrl) URL.revokeObjectURL(entry.previewUrl);
      return prev.filter((_, i) => i !== idx);
    });
  };

  const clearAllPending = () => {
    setPendingEntries((prev) => {
      prev.forEach((e) => { if (e.previewUrl) URL.revokeObjectURL(e.previewUrl); });
      return [];
    });
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (imageInputRef.current) imageInputRef.current.value = '';
  };

  // ── Paste Ctrl+V ──────────────────────────────────────────────────────────

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const items = e.clipboardData.items;
    const pastedFiles: File[] = [];
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        const blob = items[i].getAsFile();
        if (blob) {
          pastedFiles.push(new File([blob], `screenshot_${Date.now()}.png`, { type: blob.type }));
        }
      }
    }
    if (pastedFiles.length > 0) {
      addFiles(pastedFiles);
      e.preventDefault();
    }
  };

  // ── Mở editor cho 1 ảnh cụ thể (chỉ khi bấm nút Sửa) ───────────────────

  const openEditorForIndex = (idx: number) => {
    setEditingIndex(idx);
    setShowImageEditor(true);
  };

  const handleEditorConfirm = (editedFile: File) => {
    const newPreviewUrl = URL.createObjectURL(editedFile);
    setPendingEntries((prev) => {
      const updated = [...prev];
      if (updated[editingIndex]?.previewUrl) URL.revokeObjectURL(updated[editingIndex].previewUrl!);
      updated[editingIndex] = {
        file: editedFile,
        previewUrl: newPreviewUrl,
        displayName: updated[editingIndex]?.displayName || editedFile.name,
      };
      return updated;
    });
    setShowImageEditor(false);
    setEditingIndex(-1);
  };

  // ── Đặt lại tên file ──────────────────────────────────────────────────────

  const startRename = (idx: number) => {
    const entry = pendingEntries[idx];
    const parts = entry.displayName.split('.');
    const baseName = parts.length > 1 ? parts.slice(0, -1).join('.') : entry.displayName;
    setRenamingIndex(idx);
    setRenameValue(baseName);
  };

  const confirmRename = (idx: number) => {
    const newBase = renameValue.trim();
    if (!newBase) { cancelRename(); return; }
    setPendingEntries((prev) => {
      const updated = [...prev];
      const entry = updated[idx];
      const ext = entry.displayName.includes('.') ? '.' + entry.displayName.split('.').pop() : '';
      const newDisplayName = newBase + ext;
      const renamedFile = new File([entry.file], newDisplayName, { type: entry.file.type });
      updated[idx] = { ...entry, file: renamedFile, displayName: newDisplayName };
      return updated;
    });
    setRenamingIndex(-1);
    setRenameValue('');
  };

  const cancelRename = () => {
    setRenamingIndex(-1);
    setRenameValue('');
  };

  const handleEditorCancel = () => {
    setShowImageEditor(false);
    setEditingIndex(-1);
  };

  // ── Gửi tin nhắn ─────────────────────────────────────────────────────────

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (sending) return;

    const messageText = inputMessage.trim();
    const hasFiles = pendingEntries.length > 0;
    if (!messageText && !hasFiles) return;

    setSending(true);
    try {
      if (hasFiles) {
        // Upload từng file; caption chỉ gắn vào file đầu tiên
        for (let i = 0; i < pendingEntries.length; i++) {
          const { file, displayName } = pendingEntries[i];
          const fileToUpload = displayName !== file.name
            ? new File([file], displayName, { type: file.type })
            : file;
          const formData = new FormData();
          formData.append('file', fileToUpload);
          const caption = i === 0
            ? (messageText || `Đã đính kèm ${pendingEntries.length > 1 ? `${pendingEntries.length} tệp` : displayName}`)
            : `Tệp đính kèm: ${displayName}`;
          formData.append('message', caption);

          const res = await fetch(`/api/tickets/${ticketId}/attachments`, {
            method: 'POST',
            body: formData,
          });
          if (!res.ok) {
            const errJson = await res.json().catch(() => ({}));
            throw new Error(errJson.error || `Upload tệp ${i + 1} thất bại`);
          }
          const data = await res.json();
          if (data.chatLog?.id) markMessageAsMine(data.chatLog.id);
        }
        clearAllPending();
        setInputMessage('');
      } else {
        // Text only
        const res = await fetch(`/api/tickets/${ticketId}/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: messageText }),
        });
        if (!res.ok) throw new Error('Không thể gửi tin nhắn');
        const data = await res.json();
        if (data.message?.id) markMessageAsMine(data.message.id);
        setInputMessage('');
      }
    } catch (err: any) {
      console.error('Lỗi khi gửi tin nhắn:', err);
      alert(err.message || 'Không thể gửi tin nhắn');
    } finally {
      setSending(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-[680px] bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
      {/* Chat header */}
      <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
        <div>
          <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
            Lịch sử trao đổi &amp; Chat trực tiếp
            <span className="inline-flex items-center gap-1 text-[11px] font-normal text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
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
            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-2">
              <ImageIcon className="w-6 h-6" />
            </div>
            <p className="text-sm font-medium text-slate-600">Chưa có tin nhắn nào</p>
            <p className="text-xs mt-1 text-slate-400 max-w-xs">
              Gửi tin nhắn văn bản, đính kèm nhiều ảnh/tệp, hoặc nhấn <b>Ctrl+V</b> để dán ảnh.
            </p>
          </div>
        ) : (
          messages.map((msg) => {
            if (msg.message_type === 'system') {
              return (
                <div key={msg.id} className="flex justify-center my-2">
                  <div className="text-xs bg-slate-100 text-slate-600 px-3 py-1 rounded-full border border-slate-200/80 font-medium shadow-2xs">
                    <FormattedText text={msg.message} variant="chat-other" />
                  </div>
                </div>
              );
            }

            const isMe = currentUser
              ? msg.sender_id === currentUser.id
              : msg.sender_id === null && mySentMsgIds.includes(msg.id);
            const role = msg.sender?.role;
            const attachedList: Attachment[] =
              msg.attachments && msg.attachments.length > 0
                ? msg.attachments
                : msg.attachment
                ? [msg.attachment]
                : [];

            return (
              <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                {/* Sender info */}
                <div className="flex items-center gap-1.5 mb-1 px-1 text-xs text-slate-500">
                  <span className="font-semibold text-slate-700">
                    {isMe ? (currentUser ? 'Bạn' : 'Bạn (Khách)') : msg.sender?.full_name || 'Khách'}
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
                  {!role && !msg.sender && (
                    <span className="text-[10px] text-slate-500 bg-slate-100 border border-slate-200 px-1.5 py-0.2 rounded font-medium flex items-center gap-0.5">
                      <User className="w-2.5 h-2.5" /> Khách
                    </span>
                  )}
                  <span className="text-[11px] text-slate-400">{formatTime(msg.created_at)}</span>
                </div>

                {/* Message bubble */}
                <div
                  className={`max-w-[85%] sm:max-w-[75%] rounded-2xl p-3.5 shadow-sm text-sm ${
                    isMe
                      ? 'bg-indigo-600 text-white rounded-tr-none'
                      : 'bg-slate-100 text-slate-800 rounded-tl-none border border-slate-200/80'
                  }`}
                >
                  {msg.message && (
                    <p className="whitespace-pre-wrap break-words leading-relaxed">
                      <FormattedText text={msg.message} variant={isMe ? 'chat-me' : 'chat-other'} />
                    </p>
                  )}

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
                                onClick={() => setPreviewModalImg({ url: streamUrl, name: att.file_name })}
                                loading="lazy"
                              />
                              <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                  type="button"
                                  onClick={() => setPreviewModalImg({ url: streamUrl, name: att.file_name })}
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
                            <span className="truncate font-medium flex-1">{att.file_name}</span>
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

      {/* ── Pending files preview bar (nhiều file) ── */}
      {pendingEntries.length > 0 && (
        <div className="border-t border-indigo-100 bg-indigo-50/60 px-3 py-2 animate-in fade-in slide-in-from-bottom-2">
          {/* Header bar */}
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-semibold text-indigo-700">
              {pendingEntries.length} tệp đính kèm · Sẵn sàng gửi
            </span>
            <button
              type="button"
              onClick={clearAllPending}
              className="text-[11px] text-slate-400 hover:text-rose-500 transition-colors flex items-center gap-0.5"
            >
              <X className="w-3 h-3" /> Xóa tất cả
            </button>
          </div>

          {/* Scrollable horizontal list */}
          <div className="flex gap-2 overflow-x-auto pb-1">
            {pendingEntries.map((entry, idx) => {
              const isImg = !!entry.previewUrl;
              const isRenaming = renamingIndex === idx;
              return (
                <div key={idx} className="relative flex-shrink-0 group w-[76px]">
                  {/* Thumbnail */}
                  {isImg ? (
                    <img
                      src={entry.previewUrl!}
                      alt={entry.displayName}
                      className="w-16 h-16 object-cover rounded-xl border border-indigo-200 bg-white"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-xl border border-indigo-200 bg-white flex flex-col items-center justify-center gap-1">
                      <FileText className="w-5 h-5 text-indigo-400" />
                      <span className="text-[9px] text-slate-500 truncate w-12 text-center px-1 leading-tight">
                        {entry.displayName.split('.').pop()?.toUpperCase()}
                      </span>
                    </div>
                  )}

                  {/* Overlay buttons: sửa ảnh + đặt tên + xóa */}
                  {!isRenaming && (
                    <div className="absolute top-0 left-0 w-16 h-16 rounded-xl bg-black/0 group-hover:bg-black/35 transition-all flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100">
                      {isImg && (
                        <button type="button" onClick={() => openEditorForIndex(idx)} title="Sửa ảnh"
                          className="p-1 bg-white/90 hover:bg-white text-indigo-600 rounded-lg shadow transition-colors">
                          <Pencil className="w-3 h-3" />
                        </button>
                      )}
                      <button type="button" onClick={() => startRename(idx)} title="Đặt lại tên"
                        className="p-1 bg-white/90 hover:bg-white text-amber-600 rounded-lg shadow transition-colors text-[10px] font-bold leading-none">
                        Aa
                      </button>
                      <button type="button" onClick={() => removePendingEntry(idx)} title="Xóa"
                        className="p-1 bg-white/90 hover:bg-white text-rose-500 rounded-lg shadow transition-colors">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  )}

                  {/* Inline rename input */}
                  {isRenaming ? (
                    <div className="mt-1">
                      <input
                        autoFocus
                        type="text"
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') { e.preventDefault(); confirmRename(idx); }
                          if (e.key === 'Escape') cancelRename();
                        }}
                        onBlur={() => confirmRename(idx)}
                        className="w-[72px] text-[10px] px-1.5 py-0.5 border border-indigo-400 rounded-md bg-white text-slate-800 outline-none ring-1 ring-indigo-400"
                      />
                      <p className="text-[8px] text-slate-400 text-center mt-0.5">Enter để lưu</p>
                    </div>
                  ) : (
                    <div className="mt-0.5">
                      <p
                        className="text-[9px] text-slate-500 truncate text-center cursor-pointer hover:text-indigo-600 transition-colors max-w-[72px]"
                        title={`${entry.displayName} — Click để đặt tên lại`}
                        onClick={() => startRename(idx)}
                      >
                        {entry.displayName}
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Input area */}
      <div className="p-3 border-t border-slate-100 bg-white">
        <form onSubmit={handleSendMessage} className="flex items-center gap-2">
          {/* File Picker (bất kỳ loại, nhiều file) */}
          <input
            type="file"
            multiple
            ref={fileInputRef}
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) {
                addFiles(Array.from(e.target.files));
                e.target.value = '';
              }
            }}
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

          {/* Image Picker (nhiều ảnh) */}
          <input
            type="file"
            multiple
            ref={imageInputRef}
            accept="image/*"
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) {
                addFiles(Array.from(e.target.files));
                e.target.value = '';
              }
            }}
            className="hidden"
            id="chat-image-upload"
          />
          <button
            type="button"
            disabled={sending}
            onClick={() => imageInputRef.current?.click()}
            title="Gửi hình ảnh (có thể chọn nhiều)"
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
              pendingEntries.length > 0
                ? `Thêm chú thích (${pendingEntries.length} tệp) hoặc nhấn Enter để gửi...`
                : currentUser
                ? 'Nhập tin nhắn (Ctrl+V để dán ảnh, đính kèm nhiều file)...'
                : 'Nhập phản hồi với tư cách Khách (Ctrl+V để dán ảnh)...'
            }
            disabled={sending}
            className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 text-slate-900 placeholder:text-slate-400 transition-all"
          />

          <button
            type="submit"
            disabled={sending || (!inputMessage.trim() && pendingEntries.length === 0)}
            className="p-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-md shadow-indigo-100 transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex-shrink-0"
          >
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </form>

        {!currentUser && (
          <div className="mt-2 px-1 text-[11px] text-slate-400 flex items-center justify-between">
            <span>Bạn đang trao đổi với tư cách <b>Khách</b> (không cần đăng nhập)</span>
            <a href="/login" className="text-indigo-600 hover:underline font-medium">
              Đăng nhập nếu bạn là Agent/Admin
            </a>
          </div>
        )}
      </div>

      {/* Lightbox xem ảnh đã gửi */}
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
            <p className="text-white text-xs mt-3 opacity-80">{previewModalImg.name}</p>
          </div>
        </div>
      )}

      {/* Image Editor Modal — chỉ mở khi bấm nút Sửa */}
      {showImageEditor && editingIndex >= 0 && pendingEntries[editingIndex] && (
        <ImageEditorModal
          file={pendingEntries[editingIndex].file}
          onConfirm={handleEditorConfirm}
          onCancel={handleEditorCancel}
        />
      )}
    </div>
  );
}
