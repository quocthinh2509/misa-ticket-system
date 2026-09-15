# Kế Hoạch Triển Khai Tính Năng Thêm, Sửa, Xóa Thành Viên (CRUD Thành Viên)

Tài liệu này đặc tả phương án xây dựng đầy đủ bộ tính năng **Thêm, Chỉnh sửa và Xóa tài khoản thành viên** dành riêng cho Quản trị viên (Admin) trong hệ thống TLT Ticket.

---

## 1. Mục tiêu & Nghiệp vụ

1. **Thêm thành viên (Đã có sẵn & Tối ưu hóa)**:
   - Admin nhập Email, Họ tên, Vai trò (`agent` | `admin`), Phòng ban.
   - Gửi email mời kích hoạt qua Supabase Auth và cung cấp liên kết kích hoạt dự phòng trực tiếp.

2. **Chỉnh sửa thành viên (Mới)**:
   - Cho phép Admin thay đổi:
     - Họ và tên (`full_name`)
     - Vai trò (`role`: Admin hoặc Agent)
     - Phòng ban (`department`)
   - Đồng bộ cập nhật đồng thời cả trong bảng `public.users` và metadata của `auth.users`.
   - **Quy tắc an toàn**: Không cho phép Admin tự giáng cấp tài khoản của chính mình thành Agent để tránh nguy cơ mất quyền quản trị viên cao nhất.

3. **Xóa thành viên (Mới)**:
   - Cho phép Admin xóa tài khoản thành viên khỏi hệ thống.
   - **Quy tắc an toàn & Bảo toàn dữ liệu**:
     - Không cho phép Admin tự xóa chính mình.
     - Tự động gỡ bỏ phân công (`assigned_to = null`) đối với các Ticket mà nhân viên đó đang phụ trách.
     - Xóa tài khoản khỏi `auth.users` qua `supabaseAdmin.auth.admin.deleteUser(id)`.
     - Xử lý mượt mà ràng buộc dữ liệu: Nếu nhân viên đã từng tạo ticket hoặc có tin nhắn chat quan trọng trong hệ thống, hệ thống sẽ xóa phiên đăng nhập trong `auth.users` và đánh dấu tài khoản đã vô hiệu hóa trong `public.users` để đảm bảo không làm mất lịch sử trao đổi của khách hàng.

---

## 2. Chi tiết các tệp tin sẽ chỉnh sửa & tạo mới

### A. Backend API
#### [NEW] `app/api/users/[id]/route.ts`
- **PATCH**:
  - Kiểm tra quyền Admin của người gửi yêu cầu.
  - Nhận `{ full_name, role, department }`.
  - Validate dữ liệu, cập nhật bảng `public.users` và gọi `supabaseAdmin.auth.admin.updateUserById()`.
- **DELETE**:
  - Kiểm tra quyền Admin.
  - Ngăn chặn xóa chính mình (`targetUserId === currentAdmin.id`).
  - Gỡ phân công ticket: `tickets.update({ assigned_to: null }).eq('assigned_to', id)`.
  - Xóa tài khoản trong `auth.users` và `public.users`.

---

### B. Giao diện Người Dùng
#### [MODIFY] `app/(dashboard)/users/page.tsx`
- Bổ sung cột **Hành động (Thao tác)** trong bảng danh sách thành viên:
  - Nút **Sửa** (icon `Pencil`): Mở Modal chỉnh sửa thành viên.
  - Nút **Xóa** (icon `Trash2`): Mở Modal xác nhận xóa thành viên (bị vô hiệu hóa đối với dòng của chính Admin đang đăng nhập).
- **Modal Chỉnh sửa Thành viên**:
  - Hiển thị form có sẵn thông tin: Email (readonly), Họ tên, Vai trò, Phòng ban.
  - Xử lý submit gọi API `PATCH /api/users/[id]`.
- **Modal Xác nhận Xóa Thành viên**:
  - Cảnh báo trực quan màu đỏ: Tên, Email thành viên sẽ bị xóa.
  - Xử lý submit gọi API `DELETE /api/users/[id]`.

---

## 3. Kế hoạch Kiểm Thử (Verification Plan)
1. **Kiểm tra Thêm thành viên**: Xác nhận modal mời vẫn hoạt động trơn tru.
2. **Kiểm tra Sửa thành viên**:
   - Mở modal sửa của 1 Agent -> Đổi họ tên và phòng ban -> Lưu lại -> Kiểm tra bảng cập nhật ngay lập tức.
   - Thử nâng quyền Agent lên Admin hoặc đổi ngược lại.
   - Kiểm tra Admin đang đăng nhập không thể tự hạ quyền chính mình.
3. **Kiểm tra Xóa thành viên**:
   - Thử bấm nút xóa trên chính dòng tài khoản của Admin -> Nút bị ẩn hoặc vô hiệu hóa.
   - Bấm xóa một tài khoản thử nghiệm -> Xác nhận popup cảnh báo -> Kiểm tra tài khoản biến mất khỏi bảng và không thể đăng nhập lại.
4. **Kiểm tra Build**:
   - Chạy `npm run build` để đảm bảo 100% không có lỗi biên dịch.
