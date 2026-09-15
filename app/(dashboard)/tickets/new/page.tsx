'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { TicketPriority, Tag } from '@/lib/types';
import {
  ArrowLeft,
  Loader2,
  Upload,
  AlertCircle,
  FileText,
  CheckCircle2,
  X,
  Tag as TagIcon,
  Check,
  User,
  Mail,
  Info,
  Pencil,
  Image as ImageIcon,
} from 'lucide-react';
import { ImageEditorModal } from '@/components/ImageEditorModal';

export default function NewTicketPage() {
  const router = useRouter();

  // Guest info
  const [guestName, setGuestName] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);

  // Ticket fields
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<TicketPriority>('medium');
  const [files, setFiles] = useState<File[]>([]);
  // Preview URLs mapped by file index (for image thumbnails)
  const [filePreviews, setFilePreviews] = useState<Record<number, string>>({});
  const [availableTags, setAvailableTags] = useState<Tag[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [statusStep, setStatusStep] = useState('');

  // Image editor state
  const [showImageEditor, setShowImageEditor] = useState(false);
  const [imageEditorSourceFile, setImageEditorSourceFile] = useState<File | null>(null);
  const [editingFileIndex, setEditingFileIndex] = useState<number>(-1);

  // Rename state
  const [renamingFileIdx, setRenamingFileIdx] = useState<number>(-1);
  const [renameFileValue, setRenameFileValue] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Kiểm tra trạng thái đăng nhập
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { createClient } = await import('@/lib/supabase/client');
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        setIsLoggedIn(!!user);
      } catch {
        setIsLoggedIn(false);
      }
    };
    checkAuth();
  }, []);

  // Lấy danh sách nhãn có sẵn
  useEffect(() => {
    fetch('/api/tags')
      .then((res) => res.json())
      .then((data) => {
        if (data.tags) setAvailableTags(data.tags);
      })
      .catch((err) => console.error('Lỗi tải tags:', err));
  }, []);

  const toggleTag = (tagId: string) => {
    setSelectedTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
    );
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const selectedFiles = Array.from(e.target.files);
    selectedFiles.forEach((file) => {
      if (file.type.startsWith('image/')) {
        // Thêm ảnh vào danh sách và tạo preview ngay (không tự mở editor)
        setFiles((prev) => {
          const idx = prev.length;
          setFilePreviews((fp) => ({ ...fp, [idx]: URL.createObjectURL(file) }));
          return [...prev, file];
        });
      } else {
        // File không phải ảnh: thêm thẳng
        setFiles((prev) => [...prev, file]);
      }
    });
    // Reset input để có thể chọn lại cùng file
    if (fileInputRef.current) fileInputRef.current.value = '';
  };


  // Re-edit an existing image in the list
  const handleReEditImage = (idx: number) => {
    setImageEditorSourceFile(files[idx]);
    setEditingFileIndex(idx);
    setShowImageEditor(true);
  };

  // Callback: editor confirmed
  const handleImageEditorConfirm = (editedFile: File) => {
    setShowImageEditor(false);
    if (editingFileIndex >= 0) {
      // Replace existing file
      setFiles((prev) => {
        const updated = [...prev];
        updated[editingFileIndex] = editedFile;
        return updated;
      });
      setFilePreviews((prev) => {
        const updated = { ...prev };
        // Revoke old URL
        if (updated[editingFileIndex]) URL.revokeObjectURL(updated[editingFileIndex]);
        updated[editingFileIndex] = URL.createObjectURL(editedFile);
        return updated;
      });
    } else {
      // Append new file
      setFiles((prev) => {
        const newIdx = prev.length;
        setFilePreviews((fp) => ({ ...fp, [newIdx]: URL.createObjectURL(editedFile) }));
        return [...prev, editedFile];
      });
    }
    setImageEditorSourceFile(null);
    setEditingFileIndex(-1);
  };

  // Callback: editor cancelled
  const handleImageEditorCancel = () => {
    setShowImageEditor(false);
    setImageEditorSourceFile(null);
    setEditingFileIndex(-1);
  };

  // ─── Đặt lại tên file ────────────────────────────────────────────────────────────────

  const startRenameFile = (idx: number) => {
    const f = files[idx];
    const parts = f.name.split('.');
    const baseName = parts.length > 1 ? parts.slice(0, -1).join('.') : f.name;
    setRenamingFileIdx(idx);
    setRenameFileValue(baseName);
  };

  const confirmRenameFile = (idx: number) => {
    const newBase = renameFileValue.trim();
    if (!newBase) { cancelRenameFile(); return; }
    setFiles((prev) => {
      const updated = [...prev];
      const f = updated[idx];
      const ext = f.name.includes('.') ? '.' + f.name.split('.').pop() : '';
      const newName = newBase + ext;
      updated[idx] = new File([f], newName, { type: f.type });
      return updated;
    });
    setRenamingFileIdx(-1);
    setRenameFileValue('');
  };

  const cancelRenameFile = () => {
    setRenamingFileIdx(-1);
    setRenameFileValue('');
  };


  const removeFile = (index: number) => {
    setFiles((prev) => {
      const updated = prev.filter((_, i) => i !== index);
      // Re-map previews
      setFilePreviews((fp) => {
        const updated2: Record<number, string> = {};
        if (fp[index]) URL.revokeObjectURL(fp[index]);
        updated.forEach((_, newIdx) => {
          const oldIdx = newIdx >= index ? newIdx + 1 : newIdx;
          if (fp[oldIdx]) updated2[newIdx] = fp[oldIdx];
        });
        return updated2;
      });
      return updated;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      setErrorMsg('Vui lòng nhập tiêu đề sự cố');
      return;
    }

    // Với guest, tên là bắt buộc
    if (!isLoggedIn && !guestName.trim()) {
      setErrorMsg('Vui lòng nhập tên của bạn');
      return;
    }

    setLoading(true);
    setErrorMsg('');
    setStatusStep('Đang khởi tạo ticket & thư mục Google Drive...');

    try {
      // 1. Tạo ticket kèm tag_ids và thông tin guest (nếu chưa đăng nhập)
      const body: any = {
        title: title.trim(),
        description: description.trim(),
        priority,
        tag_ids: selectedTagIds,
      };

      if (!isLoggedIn) {
        body.guest_name = guestName.trim();
        body.guest_email = guestEmail.trim() || null;
      }

      const res = await fetch('/api/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok || !data.ticket) {
        throw new Error(data.error || 'Không thể tạo ticket');
      }

      const ticketId = data.ticket.id;

      // 2. Upload các file đính kèm ban đầu lên Google Drive (nếu có)
      if (files.length > 0) {
        setStatusStep(`Đang tải ${files.length} tệp đính kèm lên Google Drive...`);
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          const formData = new FormData();
          formData.append('file', file);
          formData.append('message', `Tệp mô tả ban đầu: ${file.name}`);

          await fetch(`/api/tickets/${ticketId}/attachments`, {
            method: 'POST',
            body: formData,
          });
        }
      }

      // 3. Chuyển hướng đến chi tiết ticket
      router.push(`/tickets/${ticketId}`);
    } catch (err: any) {
      console.error('Error creating ticket:', err);
      setErrorMsg(err.message || 'Đã có lỗi xảy ra trong quá trình tạo ticket');
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Back button */}
      <div>
        <Link
          href="/tickets"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Quay lại danh sách ticket
        </Link>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 sm:p-8">
        <div className="mb-6">
          <h1 className="text-xl font-bold text-slate-900">
            Tạo Yêu cầu Hỗ trợ Mới
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Mô tả sự cố bạn gặp phải. Đội ngũ hỗ trợ sẽ phản hồi sớm nhất có thể.
          </p>
        </div>

        {errorMsg && (
          <div className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-3 text-rose-700 text-sm">
            <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-500 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Thông tin người dùng - chỉ hiện khi chưa đăng nhập */}
          {isLoggedIn === false && (
            <div className="p-4 rounded-xl bg-indigo-50 border border-indigo-200 space-y-4">
              <div className="flex items-start gap-2">
                <Info className="w-4 h-4 text-indigo-600 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-indigo-700 font-medium">
                  Bạn không cần đăng nhập để gửi yêu cầu hỗ trợ. Vui lòng nhập thông tin bên dưới để chúng tôi có thể liên hệ lại với bạn.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Tên */}
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    <span className="flex items-center gap-1.5">
                      <User className="w-4 h-4 text-indigo-500" />
                      Tên của bạn <span className="text-rose-500">*</span>
                    </span>
                  </label>
                  <input
                    type="text"
                    required={!isLoggedIn}
                    value={guestName}
                    onChange={(e) => setGuestName(e.target.value)}
                    placeholder="Nguyễn Văn A"
                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 text-slate-900 placeholder:text-slate-400 transition-all"
                  />
                </div>

                {/* Email */}
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    <span className="flex items-center gap-1.5">
                      <Mail className="w-4 h-4 text-indigo-500" />
                      Email{' '}
                      <span className="text-xs text-slate-400 font-normal">(Tùy chọn)</span>
                    </span>
                  </label>
                  <input
                    type="email"
                    value={guestEmail}
                    onChange={(e) => setGuestEmail(e.target.value)}
                    placeholder="email@example.com"
                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 text-slate-900 placeholder:text-slate-400 transition-all"
                  />
                  <p className="text-xs text-slate-400 mt-1.5 flex items-center gap-1">
                    <Mail className="w-3 h-3" />
                    Nhập email để nhận thông báo khi ticket được xử lý
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Tiêu đề */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Tiêu đề sự cố <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="VD: Không xuất được hóa đơn điện tử mẫu số 01GTKT"
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 text-slate-900 placeholder:text-slate-400 transition-all"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Mức độ ưu tiên
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as TicketPriority)}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 text-slate-800 transition-all"
              >
                <option value="low">Thấp (Tư vấn, câu hỏi chung)</option>
                <option value="medium">Trung bình (Sự cố không cản trở ngay)</option>
                <option value="high">Cao (Tính năng quan trọng bị lỗi)</option>
                <option value="urgent">Khẩn cấp (Hệ thống ngừng hoạt động)</option>
              </select>
            </div>
          </div>

          {/* Phân loại nhãn (Tags) */}
          {availableTags.length > 0 && (
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2 flex items-center gap-1.5">
                <TagIcon className="w-4 h-4 text-indigo-500" />
                Gắn nhãn phân loại (Tùy chọn)
              </label>
              <div className="flex flex-wrap items-center gap-2 p-3 bg-slate-50/70 border border-slate-200 rounded-2xl">
                {availableTags.map((tag) => {
                  const isSelected = selectedTagIds.includes(tag.id);
                  const color = tag.color || '#6366f1';

                  return (
                    <button
                      key={tag.id}
                      type="button"
                      onClick={() => toggleTag(tag.id)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                        isSelected ? 'scale-105 shadow-xs' : 'opacity-70 hover:opacity-100'
                      }`}
                      style={{
                        backgroundColor: isSelected ? color : `${color}15`,
                        color: isSelected ? '#ffffff' : color,
                        border: `1px solid ${color}${isSelected ? 'ff' : '40'}`,
                      }}
                    >
                      {isSelected ? (
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                      ) : (
                        <span
                          className="w-1.5 h-1.5 rounded-full"
                          style={{ backgroundColor: color }}
                        />
                      )}
                      <span>{tag.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Mô tả chi tiết sự cố
            </label>
            <textarea
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Mô tả các bước tái hiện lỗi, thông báo lỗi cụ thể bạn nhận được..."
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 text-slate-900 placeholder:text-slate-400 transition-all resize-none"
            />
          </div>

          {/* Attachment upload */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Ảnh chụp màn hình hoặc tài liệu đính kèm
            </label>
            <div className="border-2 border-dashed border-slate-200 rounded-2xl p-6 text-center hover:border-indigo-300 transition-colors bg-slate-50/50">
              <input
                type="file"
                multiple
                ref={fileInputRef}
                id="file-upload"
                onChange={handleFileChange}
                className="hidden"
                accept="image/*,.pdf,.doc,.docx,.xlsx,.xls,.txt,.zip"
              />
              <label
                htmlFor="file-upload"
                className="cursor-pointer flex flex-col items-center justify-center gap-2"
              >
                <div className="w-10 h-10 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <Upload className="w-5 h-5" />
                </div>
                <span className="text-sm font-medium text-indigo-600 hover:text-indigo-700">
                  Nhấn để chọn file
                </span>
                <span className="text-xs text-slate-400">
                  Hỗ trợ PNG, JPG, PDF, Word, Excel · Có thể chọn nhiều file · Bấm ✏️ để chỉnh sửa ảnh
                </span>
              </label>
            </div>

            {files.length > 0 && (
              <div className="mt-4 space-y-2">
                <p className="text-xs font-semibold text-slate-600">
                  Các file đã chọn ({files.length}):
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {files.map((file, idx) => {
                    const isImage = file.type.startsWith('image/');
                    const previewUrl = filePreviews[idx];
                    const isRenaming = renamingFileIdx === idx;
                    return (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-2.5 rounded-xl border border-slate-200 bg-white text-xs text-slate-700 gap-2"
                      >
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          {isImage && previewUrl ? (
                            <img
                              src={previewUrl}
                              alt={file.name}
                              className="w-9 h-9 object-cover rounded-lg border border-slate-200 flex-shrink-0"
                            />
                          ) : (
                            <div className="w-9 h-9 rounded-lg bg-indigo-50 flex items-center justify-center flex-shrink-0">
                              {isImage ? (
                                <ImageIcon className="w-4 h-4 text-indigo-500" />
                              ) : (
                                <FileText className="w-4 h-4 text-indigo-500" />
                              )}
                            </div>
                          )}
                          <div className="truncate min-w-0 flex-1">
                            {isRenaming ? (
                              <input
                                autoFocus
                                type="text"
                                value={renameFileValue}
                                onChange={(e) => setRenameFileValue(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') { e.preventDefault(); confirmRenameFile(idx); }
                                  if (e.key === 'Escape') cancelRenameFile();
                                }}
                                onBlur={() => confirmRenameFile(idx)}
                                className="w-full px-2 py-0.5 border border-indigo-400 rounded-md text-xs text-slate-800 bg-white outline-none ring-1 ring-indigo-400"
                              />
                            ) : (
                              <span
                                className="truncate block font-medium cursor-pointer hover:text-indigo-600 transition-colors"
                                title={`${file.name} — Click để đặt tên lại`}
                                onClick={() => startRenameFile(idx)}
                              >
                                {file.name}
                              </span>
                            )}
                            <span className="text-slate-400">{(file.size / 1024).toFixed(0)} KB</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <button
                            type="button"
                            onClick={() => startRenameFile(idx)}
                            title="Đặt lại tên"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition-colors text-[10px] font-bold leading-none"
                          >
                            Aa
                          </button>
                          {isImage && (
                            <button
                              type="button"
                              onClick={() => handleReEditImage(idx)}
                              title="Chỉnh sửa ảnh"
                              className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => removeFile(idx)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-colors"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Submit */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
            <Link
              href="/tickets"
              className="px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
            >
              Hủy
            </Link>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl shadow-md shadow-indigo-100 transition-all flex items-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{statusStep || 'Đang xử lý...'}</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  Gửi Yêu cầu Hỗ trợ
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Image Editor Modal */}
      {showImageEditor && imageEditorSourceFile && (
        <ImageEditorModal
          file={imageEditorSourceFile}
          onConfirm={handleImageEditorConfirm}
          onCancel={handleImageEditorCancel}
        />
      )}
    </div>
  );
}
