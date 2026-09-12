# Kế Hoạch Triển Khai Giai Đoạn 1 (MVP) — MISA Ticket System

Hệ thống web app nội bộ quản lý ticket hỗ trợ, lưu trữ lịch sử chat realtime giữa người dùng và nhân viên hỗ trợ (agent), đính kèm file/hình ảnh mô tả sự cố trực tiếp lên Google Drive qua Service Account.

## User Review Required

> [!IMPORTANT]
> - Dự án sẽ sử dụng **Next.js 14+ (App Router)**, **TypeScript**, **Tailwind CSS**, và thư viện biểu tượng **Lucide React**.
> - Xác thực tài khoản dựa trên **Supabase Auth** (`@supabase/ssr`), phân chia 3 vai trò: `admin`, `agent`, `user`.
> - Tệp đính kèm và ảnh trong chat sẽ được tải lên Google Drive vào thư mục con của từng ticket (`Ticket_{ticketId}`) qua Service Account.
> - Cần kích hoạt tài khoản Admin đầu tiên để có quyền quản lý và gán vai trò `agent` cho các nhân viên khác.

---

## Proposed Changes

Dự án sẽ được tổ chức theo cấu trúc Next.js App Router chuẩn:

```
d:/Workspace/MISA TICKET/
├── app/
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   └── register/page.tsx
│   ├── (dashboard)/
│   │   ├── layout.tsx             # Navbar, Sidebar, User Profile
│   │   ├── tickets/
│   │   │   ├── page.tsx          # Danh sách ticket, bộ lọc trạng thái
│   │   │   ├── new/page.tsx      # Form tạo ticket mới kèm upload ảnh
│   │   │   └── [id]/page.tsx     # Chi tiết ticket & Cửa sổ Chat Realtime
│   │   └── page.tsx              # Chuyển hướng về /tickets
│   ├── api/
│   │   ├── tickets/
│   │   │   ├── route.ts          # GET list, POST create ticket + tạo Drive folder
│   │   │   └── [id]/
│   │   │       ├── route.ts      # GET ticket detail, PATCH update status/assignee
│   │   │       ├── chat/route.ts # GET messages, POST message
│   │   │       └── attachments/route.ts # POST upload file to Drive
│   │   └── drive/route.ts        # Helper tải file/streaming nếu cần
│   ├── globals.css
│   └── layout.tsx
├── components/
│   ├── Navbar.tsx
│   ├── TicketCard.tsx
│   ├── TicketStatusBadge.tsx
│   ├── ChatBox.tsx               # Khung chat realtime với Supabase subscription
│   ├── FileUploadDropzone.tsx
│   └── AssigneeSelect.tsx
├── lib/
│   ├── supabase/
│   │   ├── client.ts             # Browser client
│   │   ├── server.ts             # Server client (cookies)
│   │   └── admin.ts              # Service role client
│   ├── drive.ts                  # Google Drive API helper (tạo folder, upload file)
│   └── types.ts                  # Types cho Ticket, ChatLog, Attachment, User
├── middleware.ts                 # Bảo vệ route, kiểm tra session
├── package.json
└── tailwind.config.js
```

---

### Bước 1: Khởi tạo và thiết lập Core Dependencies

- Cài đặt Next.js (App Router, TypeScript, Tailwind CSS) trong thư mục gốc.
- Cài đặt các gói phụ thuộc:
  - `@supabase/supabase-js`, `@supabase/ssr`
  - `googleapis`
  - `lucide-react`, `clsx`, `tailwind-merge`

---

### Bước 2: Tầng tích hợp dịch vụ (Core Integrations)

#### [NEW] [lib/types.ts](file:///d:/Workspace/MISA%20TICKET/lib/types.ts)
- Định nghĩa kiểu TypeScript cho `User`, `Ticket`, `ChatLog`, `Attachment`, `TicketStatus`, `TicketPriority`.

#### [NEW] [lib/supabase/client.ts](file:///d:/Workspace/MISA%20TICKET/lib/supabase/client.ts) & [lib/supabase/server.ts](file:///d:/Workspace/MISA%20TICKET/lib/supabase/server.ts) & [lib/supabase/admin.ts](file:///d:/Workspace/MISA%20TICKET/lib/supabase/admin.ts)
- Thiết lập Supabase Client cho trình duyệt, Server Components và Service Role Client cho các API xử lý nội bộ.

#### [NEW] [lib/drive.ts](file:///d:/Workspace/MISA%20TICKET/lib/drive.ts)
- Kết nối Google Drive API thông qua `google.auth.GoogleAuth` với `GOOGLE_CLIENT_EMAIL` và `GOOGLE_PRIVATE_KEY`.
- Viết các hàm:
  - `createTicketFolder(ticketId: string)`: Tạo thư mục con `Ticket_{ticketId}` bên trong `GOOGLE_DRIVE_ROOT_FOLDER_ID`.
  - `uploadFileToFolder(folderId: string, fileBuffer: Buffer, fileName: string, mimeType: string)`: Upload file, đặt quyền xem và trả về `drive_file_id`, link xem.

---

### Bước 3: Xác thực & Phân quyền (Auth & Roles)

#### [NEW] [middleware.ts](file:///d:/Workspace/MISA%20TICKET/middleware.ts)
- Tự động chuyển hướng người dùng chưa đăng nhập về `/login`.
- Refresh session tự động qua Supabase SSR.

#### [NEW] [app/(auth)/login/page.tsx](file:///d:/Workspace/MISA%20TICKET/app/(auth)/login/page.tsx) & [app/(auth)/register/page.tsx](file:///d:/Workspace/MISA%20TICKET/app/(auth)/register/page.tsx)
- Giao diện đăng nhập / đăng ký đẹp mắt, hỗ trợ validation, hiển thị lỗi rõ ràng.
- Đăng ký tài khoản với họ tên, phòng ban (department).

---

### Bước 4: Quản lý Ticket (CRUD & Drive Folder Creation)

#### [NEW] [app/api/tickets/route.ts](file:///d:/Workspace/MISA%20TICKET/app/api/tickets/route.ts)
- `GET`: Lấy danh sách ticket theo quyền (user: ticket của mình; agent/admin: tất cả hoặc được gán).
- `POST`: Tạo ticket mới $\rightarrow$ tự động gọi Google Drive API tạo thư mục `Ticket_{ticket_id}` $\rightarrow$ lưu `drive_folder_id` vào Postgres.

#### [NEW] [app/(dashboard)/tickets/page.tsx](file:///d:/Workspace/MISA%20TICKET/app/(dashboard)/tickets/page.tsx)
- Danh sách ticket hiển thị dạng bảng/card hiện đại, có badge trạng thái (Open, In Progress, Resolved, Closed), mức độ ưu tiên (Low, Medium, High, Urgent).
- Bộ lọc nhanh theo trạng thái và độ ưu tiên.

#### [NEW] [app/(dashboard)/tickets/new/page.tsx](file:///d:/Workspace/MISA%20TICKET/app/(dashboard)/tickets/new/page.tsx)
- Form tạo ticket: Tiêu đề, Mô tả, Độ ưu tiên, Kéo thả đính kèm hình ảnh/tài liệu ban đầu.

---

### Bước 5: Cửa sổ chi tiết Ticket & Realtime Chat

#### [NEW] [app/(dashboard)/tickets/[id]/page.tsx](file:///d:/Workspace/MISA%20TICKET/app/(dashboard)/tickets/[id]/page.tsx)
- Khung bên trái/trên: Chi tiết ticket, người tạo, ngày tạo, folder Google Drive đính kèm, đổi trạng thái và người xử lý (agent/admin).
- Khung bên phải/dưới: Khung chat trực tiếp (Realtime Chatbox).

#### [NEW] [components/ChatBox.tsx](file:///d:/Workspace/MISA%20TICKET/components/ChatBox.tsx)
- Kết nối kênh Supabase Realtime (`channel('ticket:' + ticketId)`), lắng nghe sự kiện `INSERT` trên bảng `chat_logs`.
- Gửi tin nhắn tức thì, hiển thị tin nhắn của bản thân và đối phương khác màu (chat bubbles).
- Đính kèm file ngay trong khung chat: Tải lên Google Drive $\rightarrow$ lưu vào `attachments` $\rightarrow$ render trực tiếp preview ảnh hoặc link tải file trong khung chat.
- Hiển thị tin nhắn hệ thống (VD: "Agent Nguyễn Văn A đã đổi trạng thái thành In Progress").

---

## Verification Plan

### 1. Kiểm tra tích hợp Supabase & Google Drive
- Tạo 1 ticket thử nghiệm từ giao diện:
  - Kiểm tra dòng dữ liệu được insert vào Supabase bảng `tickets`.
  - Kiểm tra thư mục con mới xuất hiện trên Google Drive với ID trùng khớp.
- Tải lên file ảnh đính kèm:
  - File xuất hiện trong thư mục trên Drive.
  - Link ảnh xem được và lưu trong bảng `attachments`.

### 2. Kiểm tra Realtime Chat
- Mở 2 trình duyệt (1 cửa sổ ẩn danh và 1 cửa sổ thường) với 2 tài khoản khác nhau (User và Agent):
  - User gửi tin nhắn $\rightarrow$ Agent nhìn thấy ngay lập tức không cần F5.
  - Agent đổi trạng thái ticket $\rightarrow$ Dòng log hệ thống xuất hiện trong cửa sổ chat realtime.

### 3. Kiểm tra phân quyền RLS
- User bình thường chỉ nhìn thấy ticket do mình tạo.
- Agent và Admin nhìn thấy các ticket của hệ thống.
