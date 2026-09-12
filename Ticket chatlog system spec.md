# Ticket & Chat Log Management System — Project Specification

## 1. Tổng quan dự án

**Mục tiêu:** Xây dựng web app nội bộ để quản lý ticket hỗ trợ, lưu trữ lịch sử chat giữa người dùng và agent xử lý, đính kèm file/hình ảnh mô tả sự cố.

**Quy mô mục tiêu:** ~100 người dùng đồng thời (nội bộ tổ chức).

**Tech stack:**

| Thành phần | Công nghệ | Ghi chú |
|---|---|---|
| Frontend | Next.js 14+ (App Router), React, TypeScript | |
| Styling | Tailwind CSS | |
| Backend/API | Next.js API routes (serverless) | Chạy trên Vercel |
| Database | Supabase (Postgres) | Lưu ticket, chat log, metadata |
| Auth | Supabase Auth | Email/password, có thể mở rộng SSO sau |
| Realtime | Supabase Realtime | Cho chat live giữa user/agent |
| File/ảnh | Google Drive API (Service Account) | Không dùng Supabase Storage để tránh giới hạn dung lượng |
| Hosting | Vercel (Pro tier khuyến nghị) | |

**Chi phí ước tính vận hành ổn định:** ~$45-50/tháng (Supabase Pro ~$25 + Vercel Pro ~$20), có thể bắt đầu ở free tier để test trước khi lên production.

---

## 2. Database Schema (Supabase / Postgres)

### 2.1. Bảng `users`
```sql
create table users (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text unique not null,
  role text not null default 'user' check (role in ('admin', 'agent', 'user')),
  department text,
  created_at timestamptz not null default now()
);
```

### 2.2. Bảng `tickets`
```sql
create table tickets (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  status text not null default 'open' check (status in ('open', 'in_progress', 'resolved', 'closed')),
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high', 'urgent')),
  created_by uuid not null references users(id),
  assigned_to uuid references users(id),
  drive_folder_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_tickets_status_assigned on tickets(status, assigned_to);
create index idx_tickets_created_by on tickets(created_by);
```

### 2.3. Bảng `chat_logs`
```sql
create table chat_logs (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references tickets(id) on delete cascade,
  sender_id uuid not null references users(id),
  message text not null,
  message_type text not null default 'text' check (message_type in ('text', 'system', 'file_ref')),
  created_at timestamptz not null default now()
);

create index idx_chatlogs_ticket_created on chat_logs(ticket_id, created_at);
```

### 2.4. Bảng `attachments`
```sql
create table attachments (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references tickets(id) on delete cascade,
  chat_log_id uuid references chat_logs(id) on delete set null,
  drive_file_id text not null,
  file_name text not null,
  file_type text,
  uploaded_by uuid not null references users(id),
  created_at timestamptz not null default now()
);

create index idx_attachments_ticket on attachments(ticket_id);
```

### 2.5. Row Level Security (RLS) — bắt buộc bật cho tất cả bảng
- `users`: user chỉ đọc/sửa được profile của chính mình; admin đọc/sửa tất cả.
- `tickets`: user chỉ thấy ticket mình tạo; agent/admin thấy ticket được gán hoặc tất cả (tùy role).
- `chat_logs`: chỉ user liên quan đến ticket đó (created_by, assigned_to) hoặc admin mới đọc/ghi được.
- `attachments`: theo logic tương tự chat_logs.

---

## 3. Cấu trúc Google Drive

```
/TicketSystem (root folder, share quyền Editor cho Service Account)
  /Ticket_{ticket_id}
    /attachments/     ← file/ảnh người dùng gửi trong chat
    /descriptions/    ← ảnh/file mô tả ban đầu khi tạo ticket
```

- Mỗi ticket có 1 folder riêng, `drive_folder_id` lưu vào bảng `tickets` khi tạo ticket.
- Dùng **Service Account** (không phải OAuth từng user) để backend upload/đọc file thay mặt hệ thống.
- Nếu tổ chức dùng Google Workspace: cân nhắc bật **Domain-wide Delegation** để Service Account có quyền tạo folder trong Shared Drive thay vì My Drive cá nhân (tránh vấn đề quota lưu trữ cá nhân).
- Link xem file: `https://drive.google.com/uc?id={drive_file_id}` (ảnh) hoặc `https://drive.google.com/file/d/{drive_file_id}/view` (file khác).

---

## 4. API Routes cần triển khai (Next.js)

| Route | Method | Chức năng |
|---|---|---|
| `/api/tickets` | GET, POST | Danh sách ticket (có filter status/priority), tạo ticket mới |
| `/api/tickets/[id]` | GET, PATCH | Chi tiết ticket, cập nhật trạng thái/assignee |
| `/api/tickets/[id]/chat` | GET, POST | Lấy lịch sử chat, gửi tin nhắn mới |
| `/api/tickets/[id]/attachments` | POST | Upload file lên Drive + ghi record vào `attachments` |
| `/api/drive/upload` | POST | Helper nội bộ gọi Google Drive API |
| `/api/auth/*` | — | Xử lý qua Supabase Auth client SDK, không cần route riêng |

**Lưu ý kỹ thuật cho Antigravity khi triển khai:**
- Set `maxDuration` cho các API route liên quan upload file lớn (Vercel Pro cho phép tới 60s, Hobby chỉ 10s).
- Dùng Supabase service role key **chỉ ở server-side** (API routes), không bao giờ expose ra client.
- Google Service Account credentials (JSON key) lưu qua biến môi trường (`GOOGLE_SERVICE_ACCOUNT_KEY`), không commit vào repo.

---

## 5. Luồng hoạt động chính (User flow)

1. **Tạo ticket**: User điền title/description → backend tạo row `tickets` → tạo folder con trên Drive → lưu `drive_folder_id`.
2. **Chat**: User/agent trao đổi qua lại → mỗi tin nhắn insert vào `chat_logs` → Supabase Realtime broadcast tới client đang mở ticket đó (không cần WebSocket server riêng).
3. **Đính kèm file**: Upload trực tiếp lên Drive folder tương ứng qua Service Account → lưu `drive_file_id` vào `attachments`, liên kết với `chat_log_id` nếu gửi kèm trong tin nhắn cụ thể.
4. **Cập nhật trạng thái**: Agent đổi status/assignee → tự động insert 1 dòng `chat_logs` với `message_type = 'system'` để làm log lịch sử (VD: "Agent A đã nhận ticket").

---

## 6. Roadmap triển khai theo giai đoạn

### Giai đoạn 1 — MVP
- [ ] Setup Next.js project + Supabase project + kết nối Google Drive Service Account
- [ ] Auth (đăng ký/đăng nhập qua Supabase Auth)
- [ ] CRUD ticket cơ bản
- [ ] Chat log realtime trong 1 ticket
- [ ] Upload/xem file đính kèm qua Drive
- [ ] Phân quyền cơ bản: admin / agent / user

### Giai đoạn 2 — Mở rộng
- [ ] Bộ lọc và tìm kiếm ticket (theo status, priority, người tạo, ngày)
- [ ] Thông báo email khi có phản hồi mới (dùng Supabase Edge Function + Resend/SendGrid)
- [ ] Dashboard thống kê: số ticket mở/đóng, thời gian phản hồi trung bình

### Giai đoạn 3 — Nâng cao
- [ ] Export lịch sử chat của 1 ticket ra PDF
- [ ] Gắn nhãn (tags) cho ticket
- [ ] SLA tracking (cảnh báo ticket quá hạn xử lý)

---

## 7. Cân nhắc về khả năng đáp ứng (100 users)

| Thành phần | Giới hạn free tier | Đủ cho 100 user? |
|---|---|---|
| Vercel | 100GB bandwidth/tháng, function timeout 10s | Đủ, nhưng nên Pro nếu upload file lớn |
| Supabase | 500MB DB, ~60 connections, auto-pause sau 7 ngày không hoạt động | Đủ dung lượng; cần Pro nếu cần uptime 24/7 |
| Google Drive API | 12.000 requests/phút/project | Dư sức, giới hạn thực tế là dung lượng Drive theo tài khoản |

**Khuyến nghị**: Bắt đầu free tier để phát triển/test MVP, chuyển sang Pro tier (Vercel + Supabase, ~$45-50/tháng) khi đưa vào dùng thật để tránh gián đoạn do auto-pause hoặc timeout.