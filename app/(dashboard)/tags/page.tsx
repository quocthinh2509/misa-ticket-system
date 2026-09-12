'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Tag, UserProfile } from '@/lib/types';
import { TagBadge } from '@/components/TagBadge';
import { formatDate } from '@/lib/utils';
import {
  Tag as TagIcon,
  PlusCircle,
  Edit2,
  Trash2,
  Loader2,
  AlertCircle,
  ShieldCheck,
  Check,
  X,
  Search,
} from 'lucide-react';

const COLOR_PRESETS = [
  '#ef4444', // Red
  '#f97316', // Orange
  '#f59e0b', // Amber
  '#10b981', // Emerald
  '#06b6d4', // Cyan
  '#3b82f6', // Blue
  '#6366f1', // Indigo
  '#8b5cf6', // Purple
  '#ec4899', // Pink
  '#64748b', // Slate
];

export default function TagsManagementPage() {
  const router = useRouter();
  const supabase = createClient();

  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Modal State (Create / Edit)
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTag, setEditingTag] = useState<Tag | null>(null);
  const [tagName, setTagName] = useState('');
  const [tagColor, setTagColor] = useState('#6366f1');
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Check auth and admin role
  useEffect(() => {
    const init = async () => {
      setLoading(true);
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push('/login');
        return;
      }

      const { data: profile } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single();

      if (!profile || profile.role !== 'admin') {
        router.push('/tickets');
        return;
      }

      setCurrentUser(profile);
      fetchTags();
    };

    init();
  }, [router, supabase]);

  const fetchTags = async () => {
    try {
      const res = await fetch('/api/tags');
      const data = await res.json();
      if (data.tags) {
        setTags(data.tags);
      }
    } catch (err) {
      console.error('Lỗi khi lấy danh sách nhãn:', err);
    } finally {
      setLoading(false);
    }
  };

  const openCreateModal = () => {
    setEditingTag(null);
    setTagName('');
    setTagColor('#6366f1');
    setErrorMsg('');
    setIsModalOpen(true);
  };

  const openEditModal = (tag: Tag) => {
    setEditingTag(tag);
    setTagName(tag.name);
    setTagColor(tag.color || '#6366f1');
    setErrorMsg('');
    setIsModalOpen(true);
  };

  const handleSaveTag = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tagName.trim()) {
      setErrorMsg('Vui lòng nhập tên nhãn');
      return;
    }

    setSaving(true);
    setErrorMsg('');

    try {
      if (editingTag) {
        // Update tag
        const res = await fetch(`/api/tags/${editingTag.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: tagName.trim(), color: tagColor }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Không thể cập nhật nhãn');

        setTags((prev) =>
          prev.map((t) => (t.id === editingTag.id ? data.tag : t))
        );
      } else {
        // Create tag
        const res = await fetch('/api/tags', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: tagName.trim(), color: tagColor }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Không thể tạo nhãn');

        setTags((prev) => [...prev, data.tag]);
      }

      setIsModalOpen(false);
    } catch (err: any) {
      setErrorMsg(err.message || 'Thao tác thất bại');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTag = async (tag: Tag) => {
    if (
      !window.confirm(
        `Bạn có chắc chắn muốn xóa nhãn "${tag.name}" không? Các ticket đang gắn nhãn này sẽ tự động được gỡ nhãn.`
      )
    ) {
      return;
    }

    try {
      const res = await fetch(`/api/tags/${tag.id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Không thể xóa nhãn');

      setTags((prev) => prev.filter((t) => t.id !== tag.id));
    } catch (err: any) {
      alert(err.message || 'Xóa nhãn thất bại');
    }
  };

  const filteredTags = tags.filter((t) =>
    t.name.toLowerCase().includes(searchQuery.toLowerCase().trim())
  );

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-28">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mb-3" />
        <p className="text-sm text-slate-500 font-medium">Đang tải danh mục nhãn...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              Quản lý Danh mục Nhãn (Tags)
            </h1>
            <span className="inline-flex items-center gap-1 text-xs bg-purple-100 text-purple-800 border border-purple-200 px-2 py-0.5 rounded-full font-semibold">
              <ShieldCheck className="w-3.5 h-3.5" /> Chỉ Admin
            </span>
          </div>
          <p className="text-sm text-slate-500">
            Thêm, chỉnh sửa và quản lý các nhãn phân loại ticket dùng chung cho toàn hệ thống
          </p>
        </div>

        <button
          onClick={openCreateModal}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl shadow-md shadow-indigo-100 transition-all cursor-pointer"
        >
          <PlusCircle className="w-4 h-4" />
          Thêm Nhãn Mới
        </button>
      </div>

      {/* Search & Overview Card */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm kiếm nhãn..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 text-slate-900 placeholder:text-slate-400 transition-all"
          />
        </div>

        <div className="text-xs text-slate-500 font-medium">
          Tổng cộng: <span className="font-bold text-slate-800">{tags.length}</span> nhãn
        </div>
      </div>

      {/* Tags Grid List */}
      {filteredTags.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {filteredTags.map((tag) => (
            <div
              key={tag.id}
              className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm hover:shadow-md transition-all flex items-center justify-between gap-3 group"
            >
              <div className="flex items-center gap-3 overflow-hidden">
                <div
                  className="w-4 h-4 rounded-full flex-shrink-0 shadow-xs"
                  style={{ backgroundColor: tag.color }}
                />
                <div className="truncate">
                  <div className="font-semibold text-slate-800 text-sm truncate">
                    {tag.name}
                  </div>
                  <div className="text-[11px] text-slate-400 font-mono">
                    {tag.color}
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => openEditModal(tag)}
                  title="Chỉnh sửa nhãn"
                  className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDeleteTag(tag)}
                  title="Xóa nhãn"
                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-slate-200 p-6">
          <TagIcon className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-sm font-medium text-slate-700">
            {searchQuery ? 'Không tìm thấy nhãn nào khớp với từ khóa' : 'Chưa có nhãn nào được tạo'}
          </p>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
            Nhấn nút &quot;Thêm Nhãn Mới&quot; ở trên để tạo các nhãn phân loại đầu tiên cho hệ thống.
          </p>
        </div>
      )}

      {/* Create / Edit Tag Modal */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in"
          onClick={() => !saving && setIsModalOpen(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md p-6 space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">
                {editingTag ? 'Chỉnh sửa Nhãn' : 'Thêm Nhãn Mới'}
              </h3>
              <button
                disabled={saving}
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {errorMsg && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleSaveTag} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Tên nhãn <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={tagName}
                  onChange={(e) => setTagName(e.target.value)}
                  placeholder="VD: Lỗi phần mềm, Kế toán, Hóa đơn..."
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                  Chọn màu sắc
                </label>
                <div className="grid grid-cols-5 gap-2.5 mb-3">
                  {COLOR_PRESETS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setTagColor(color)}
                      className="h-8 rounded-lg flex items-center justify-center transition-transform hover:scale-105 relative"
                      style={{ backgroundColor: color }}
                    >
                      {tagColor.toLowerCase() === color.toLowerCase() && (
                        <Check className="w-4 h-4 text-white stroke-[3]" />
                      )}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={tagColor}
                    onChange={(e) => setTagColor(e.target.value)}
                    className="w-9 h-9 rounded-lg border border-slate-200 cursor-pointer p-0.5 bg-white"
                  />
                  <input
                    type="text"
                    value={tagColor}
                    onChange={(e) => setTagColor(e.target.value)}
                    placeholder="#6366f1"
                    className="flex-1 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono text-slate-700"
                  />
                </div>
              </div>

              {/* Tag Preview */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-xs text-slate-400 block mb-1.5">
                  Xem trước hiển thị:
                </span>
                <TagBadge
                  tag={{
                    id: 'preview',
                    name: tagName.trim() || 'Tên nhãn mẫu',
                    color: tagColor,
                  }}
                  size="md"
                />
              </div>

              {/* Actions */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-sm transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Đang lưu...
                    </>
                  ) : editingTag ? (
                    'Cập nhật'
                  ) : (
                    'Tạo nhãn'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
