# Tính năng Edit Ảnh Trước Khi Gửi

## Mô tả

Bổ sung tính năng **Image Editor** cho phép người dùng (user, admin, agent, guest) chỉnh sửa ảnh trực tiếp ngay trong trình duyệt trước khi gửi — áp dụng cho cả **ChatBox** và **trang Tạo Ticket**.

## Phạm vi tính năng

- ✏️ **Bút vẽ tự do** (freehand pen)
- 🖊️ **Highlight** (tô sáng vùng chú ý, 35% opacity)
- 🔲 **Hình chữ nhật** (rectangle)
- ⭕ **Hình tròn** (ellipse)
- ➡️ **Mũi tên** (arrow)
- ➖ **Đường thẳng** (line)
- 💬 **Văn bản** (text chú thích, click để đặt vị trí)
- 🎨 **Bảng màu** nhanh + color picker tùy chỉnh
- 📏 **4 cỡ bút**: 2px, 4px, 8px, 14px
- ↩️ **Undo** từng bước (Ctrl+Z)
- 🗑️ **Xóa sạch** (reset về ảnh gốc)
- ⌨️ **Keyboard shortcuts**: Esc = Hủy, Enter = Confirm text
- 📱 Hỗ trợ **touch events** (mobile/tablet)

## Không có crop

Không triển khai crop. Chỉ annotation/markup tools.

## Files đã thay đổi

### [NEW] components/ImageEditorModal.tsx
- Canvas-based image editor, không thư viện ngoài
- Dark UI chuyên nghiệp (#1a1a2e)
- Toolbar bên trái với icons Lucide
- Overlay canvas cho live shape preview
- Export ảnh qua `canvas.toBlob()` → File PNG

### [MODIFY] components/ChatBox.tsx
- Thêm `showImageEditor`, `imageEditorSourceFile` states
- `handleSelectFile()`: ảnh → mở editor; non-image → gắn trực tiếp
- `handleImageEditorConfirm()`: nhận File PNG đã edit → set pendingFile
- `handleImageEditorCancel()`: reset input refs
- Render `<ImageEditorModal>` cuối JSX

### [MODIFY] app/(dashboard)/tickets/new/page.tsx
- Thêm `filePreviews` state (thumbnail preview map)
- Thêm `showImageEditor`, `imageEditorSourceFile`, `editingFileIndex` states
- `handleFileChange()`: ảnh → mở editor; non-image → thêm thẳng
- `handleReEditImage(idx)`: re-edit ảnh đã có trong danh sách
- `handleImageEditorConfirm()`: thay thế hoặc thêm mới File
- Danh sách file: hiển thị thumbnail + nút ✏️ re-edit cho ảnh
- Render `<ImageEditorModal>` cuối JSX

## Verification

- ✅ `npx tsc --noEmit` → exit code 0, không có lỗi TypeScript
