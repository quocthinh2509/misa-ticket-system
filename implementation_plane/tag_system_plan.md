# Kế Hoạch Triển Khai Tính Năng Gắn Nhãn (Tags) Cho Ticket

## Mục tiêu
Bổ sung tính năng phân loại ticket theo nhãn (Tags).
- **Admin**: Có toàn quyền tạo mới, chỉnh sửa, xóa các nhãn trong hệ thống (tên nhãn, màu sắc).
- **Agent & User**: Được quyền xem và chọn/gắn các nhãn có sẵn vào ticket (khi tạo mới hoặc trong trang chi tiết ticket), lọc ticket theo nhãn.

---

## 1. Cơ sở dữ liệu (Supabase SQL)

### 1.1. Bảng `tags` (Danh mục nhãn)
```sql
create table if not exists public.tags (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  color text not null default '#6366f1',
  created_at timestamptz not null default now()
);
```

### 1.2. Bảng trung gian `ticket_tags` (Liên kết nhiều - nhiều)
```sql
create table if not exists public.ticket_tags (
  ticket_id uuid not null references public.tickets(id) on delete cascade,
  tag_id uuid not null references public.tags(id) on delete cascade,
  primary key (ticket_id, tag_id)
);

create index if not exists idx_ticket_tags_ticket on public.ticket_tags(ticket_id);
create index if not exists idx_ticket_tags_tag on public.ticket_tags(tag_id);
```

### 1.3. Phân quyền RLS (Row Level Security)
- **Bảng `tags`**:
  - `SELECT`: Cho phép tất cả người dùng đã đăng nhập (Admin, Agent, User).
  - `INSERT / UPDATE / DELETE`: **Chỉ Admin** (`public.get_current_user_role() = 'admin'`).
- **Bảng `ticket_tags`**:
  - `SELECT`: Bất kỳ ai có quyền xem ticket.
  - `INSERT / DELETE`: Người tạo ticket, Agent phụ trách hoặc Admin.

---

## 2. API Routes cần triển khai

| Endpoint | Phương thức | Quyền | Chức năng |
|---|---|---|---|
| `/api/tags` | GET | Tất cả | Lấy danh sách tất cả các nhãn |
| `/api/tags` | POST | **Chỉ Admin** | Tạo nhãn mới (tên, mã màu hex) |
| `/api/tags/[id]` | PATCH, DELETE | **Chỉ Admin** | Sửa tên/màu hoặc xóa nhãn |
| `/api/tickets/[id]/tags` | POST, DELETE | User/Agent/Admin | Gắn thêm hoặc gỡ nhãn khỏi ticket |

---

## 3. Giao diện người dùng (Frontend Components)

1. **Trang Quản trị Nhãn dành riêng cho Admin** ([/tags](http://localhost:3000/tags)):
   - Nút dẫn tới trang quản lý nhãn hiển thị trên Navbar (chỉ hiện với tài khoản Admin).
   - Bảng quản lý danh sách nhãn, xem trước màu sắc hiển thị.
   - Modal tạo mới nhãn và sửa nhãn (kèm bảng chọn màu đẹp mắt).
   - Nút xóa nhãn kèm cảnh báo xác nhận.

2. **Gắn nhãn trong Form Tạo Ticket** ([/tickets/new](http://localhost:3000/tickets/new)):
   - Thêm trường chọn nhãn dạng multi-select chips với màu sắc trực quan.

3. **Gắn và Gỡ nhãn trong Trang Chi tiết Ticket** ([/tickets/[id]](http://localhost:3000/tickets)):
   - Hiển thị danh sách các nhãn đang gắn ở cột thông tin bên trái.
   - Nút `+ Gắn nhãn` mở popover chọn nhanh nhãn để thêm.
   - Nút `x` trên từng nhãn để gỡ bỏ tức thì.

4. **Hiển thị & Bộ lọc trong Trang Danh sách Ticket** ([/tickets](http://localhost:3000/tickets)):
   - Thẻ `TicketCard` hiển thị các nhãn nhỏ kèm màu sắc tương ứng.
   - Thêm thanh lọc ticket theo nhãn cạnh bộ lọc trạng thái và độ ưu tiên.

---

## Verification Plan

1. **Kiểm tra quyền Admin**:
   - Đăng nhập bằng tài khoản Admin $\rightarrow$ Tạo 3 tag mẫu: `Kế toán` (xanh ngọc), `Lỗi phần mềm` (đỏ), `Cần gấp` (cam).
   - Sửa đổi màu sắc / tên tag.
   - Xóa thử 1 tag.
2. **Kiểm tra giới hạn Agent / User**:
   - Đăng nhập tài khoản User / Agent $\rightarrow$ Không thấy nút Quản lý tag; nếu truy cập trực tiếp URL `/tags` hoặc gọi API POST/DELETE `/api/tags` sẽ bị từ chối `403 Forbidden`.
   - User / Agent tạo ticket mới hoặc mở ticket có sẵn $\rightarrow$ Gắn được các tag đã tạo vào ticket.
3. **Kiểm tra lọc theo tag**:
   - Bấm chọn tag `Kế toán` $\rightarrow$ Chỉ danh sách các ticket có gắn tag này được hiển thị.
