# Hướng Dẫn Chuẩn Bị & Cung Cấp Cấu Hình Hệ Thống MISA Ticket

Tài liệu này tổng hợp toàn bộ các dịch vụ bên ngoài, tài khoản, API key và biến môi trường cần chuẩn bị trước khi bắt đầu khởi tạo và chạy dự án **Ticket & Chat Log Management System**.

---

## 1. Supabase (Database, Auth, Realtime)

### 1.1. Mục đích
- Lưu trữ cơ sở dữ liệu quan hệ (PostgreSQL) gồm: tài khoản, ticket, chat log, metadata đính kèm.
- Xử lý xác thực người dùng (Supabase Auth).
- Hỗ trợ Realtime WebSockets để nhận tin nhắn chat và cập nhật ticket tức thời.

### 1.2. Các bước thiết lập trên Supabase
1. **Tạo tài khoản & dự án mới:**
   - Truy cập [https://supabase.com](https://supabase.com), đăng nhập hoặc đăng ký.
   - Nhấn **New Project**, chọn Organization, đặt tên dự án (ví dụ: `misa-ticket-system`), mật khẩu database và chọn Region (khuyến nghị: `Singapore` để có độ trễ thấp nhất về Việt Nam).
2. **Lấy API Keys và URL:**
   - Vào **Project Settings** (biểu tượng bánh răng ở sidebar) > **API**.
   - Sao chép các thông tin sau:
     - **Project URL** (VD: `https://xyzcompany.supabase.co`)
     - **anon / public key** (Dùng cho Client-side Next.js)
     - **service_role key** (Secret key có quyền admin, chỉ dùng ở Server-side/API route Next.js, **tuyệt đối không chia sẻ**)
3. **Cấu hình Authentication:**
   - Vào **Authentication** > **Providers** > chọn **Email**:
     - Bật **Enable Email provider**.
     - Trong giai đoạn dev/test: Có thể tạm thời tắt **Confirm email** để khi tạo tài khoản có thể đăng nhập ngay mà không cần đợi xác nhận email.
4. **Cấu hình Realtime:**
   - Vào **Database** > **Replication** (hoặc **Publications**).
   - Đảm bảo bảng `chat_logs` (và `tickets`) sau khi tạo sẽ được bật tính năng Realtime.

---

## 2. Google Cloud Platform & Google Drive API

### 2.1. Mục đích
- Hệ thống sử dụng Google Drive làm kho lưu trữ ảnh và file đính kèm (cho mô tả ticket và tệp tin trong chat), tránh bị giới hạn dung lượng lưu trữ của database.
- Backend sử dụng **Service Account** (tài khoản dịch vụ dạng bot) để tự động tạo thư mục con cho từng ticket và upload/download file thay mặt người dùng.

### 2.2. Các bước thiết lập trên Google Cloud Console
1. **Tạo Google Cloud Project:**
   - Truy cập [Google Cloud Console](https://console.cloud.google.com).
   - Nhấn vào menu chọn project ở góc trên bên trái > **New Project**.
   - Đặt tên (ví dụ: `misa-ticket-drive`) và nhấn **Create**.
2. **Kích hoạt Google Drive API:**
   - Vào menu bên trái > **APIs & Services** > **Library**.
   - Tìm kiếm từ khóa `Google Drive API`.
   - Nhấn vào kết quả và bấm nút **Enable**.
3. **Tạo Service Account (Tài khoản dịch vụ):**
   - Vào **APIs & Services** > **Credentials**.
   - Nhấn **+ Create Credentials** > chọn **Service Account**.
   - Đặt tên: `misa-ticket-uploader` (hệ thống sẽ tạo 1 email bot dạng `misa-ticket-uploader@<project-id>.iam.gserviceaccount.com`).
   - Nhấn **Done** (không bắt buộc cấp Role ở bước này).
4. **Tạo & Tải Private Key (JSON):**
   - Tại danh sách Service Accounts, nhấp vào email Service Account vừa tạo.
   - Chọn tab **Keys** > nhấn **Add Key** > **Create new key**.
   - Chọn định dạng **JSON** và nhấn **Create**.
   - Một file JSON sẽ tự động được tải về máy của bạn. File này chứa `client_email`, `private_key`, `project_id`, v.v.
5. **Tạo thư mục gốc trên Google Drive & Cấp quyền:**
   - Mở tài khoản Google Drive của bạn (Drive cá nhân hoặc Shared Drive của tổ chức).
   - Tạo một thư mục mới, đặt tên ví dụ: `TicketSystem_Storage`.
   - Chuột phải vào thư mục đó > chọn **Share (Chia sẻ)**.
   - Dán **email của Service Account** (ở bước 3) vào ô chia sẻ, gán quyền **Editor (Người chỉnh sửa)** và nhấn **Send/Share**.
   - Mở thư mục đó trên trình duyệt, quan sát URL:
     `https://drive.google.com/drive/folders/1a2b3c4d5e6f7g8h9...`
     Chuỗi ký tự phía sau `folders/` chính là **Folder ID** của thư mục gốc.

---

## 3. Môi trường triển khai (Hosting & Runtime)

- **Node.js**: Cần cài đặt phiên bản Node.js LTS v18 hoặc v20+.
- **Vercel** (khi chuẩn bị đưa lên mạng nội bộ / internet):
  - Tài khoản Vercel liên kết với GitHub/GitLab repository.
  - Cấu hình Environment Variables tương tự file `.env.local`.

---

## 4. Danh sách biến môi trường cần cung cấp (.env.local)

Khi dự án được khởi tạo, file `.env.local` trong dự án sẽ cần các giá trị sau:

```env
# ---------------------------------------------
# SUPABASE CONFIGURATION
# ---------------------------------------------
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# ---------------------------------------------
# GOOGLE DRIVE API CONFIGURATION (SERVICE ACCOUNT)
# ---------------------------------------------
# Cách 1: Truyền trực tiếp JSON một dòng (hoặc Base64)
GOOGLE_SERVICE_ACCOUNT_KEY='{"type":"service_account","project_id":"...","private_key_id":"...","private_key":"-----BEGIN PRIVATE KEY-----\\n...\\n-----END PRIVATE KEY-----\\n","client_email":"...","client_id":"...","auth_uri":"https://accounts.google.com/o/oauth2/auth","token_uri":"https://oauth2.googleapis.com/token"}'

# Hoặc Cách 2: Tách riêng các trường chính nếu muốn gọn gàng
GOOGLE_CLIENT_EMAIL=misa-ticket-uploader@your-project-id.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# ID thư mục gốc đã chia sẻ cho Service Account
GOOGLE_DRIVE_ROOT_FOLDER_ID=1a2b3c4d5e6f7g8h9...

# ---------------------------------------------
# APP CONFIGURATION
# ---------------------------------------------
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## 5. Danh sách các thứ bạn cần chuẩn bị sẵn để bàn giao cho việc code
1. `NEXT_PUBLIC_SUPABASE_URL`
2. `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. `SUPABASE_SERVICE_ROLE_KEY`
4. File JSON Service Account tải từ Google Cloud (chứa `client_email` và `private_key`)
5. `GOOGLE_DRIVE_ROOT_FOLDER_ID` (ID của folder đã chia sẻ quyền Editor cho Service Account)
