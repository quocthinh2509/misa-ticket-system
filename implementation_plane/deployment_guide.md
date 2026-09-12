# Hướng Dẫn Deploy Lên Vercel & Cấu Hình Google Cloud

Tài liệu này hướng dẫn chi tiết từng bước đưa hệ thống **MISA Ticket & Chat Log** lên nền tảng đám mây **Vercel** và cập nhật các liên kết với **Google Cloud Console** cùng **Supabase**.

---

## BƯỚC 1: Đẩy Mã Nguồn Lên GitHub

1. Mở terminal tại thư mục dự án `d:\Workspace\MISA TICKET`.
2. Khởi tạo Git (nếu chưa có) và commit toàn bộ code:
   ```bash
   git init
   git add .
   git commit -m "feat: complete MISA Ticket system with Drive & Tags"
   ```
3. Truy cập [GitHub](https://github.com), tạo một repository mới (ví dụ: `misa-ticket-system`).
4. Đẩy mã nguồn lên GitHub:
   ```bash
   git branch -M main
   git remote add origin https://github.com/TÊN_TÀI_KHOẢN/misa-ticket-system.git
   git push -u origin main
   ```
*(Lưu ý: File `.gitignore` đã được tạo sẵn để tự động loại bỏ `.env.local` và `node_modules`, đảm bảo không lộ key bảo mật lên GitHub).*

---

## BƯỚC 2: Deploy Dự Án Lên Vercel

1. Truy cập [vercel.com](https://vercel.com) và đăng nhập bằng tài khoản GitHub của bạn.
2. Tại trang Dashboard, bấm **Add New...** $\rightarrow$ chọn **Project**.
3. Tìm repository `misa-ticket-system` vừa đẩy lên và bấm **Import**.
4. Tại mục **Configure Project**:
   - **Framework Preset**: Chọn `Next.js` (Vercel tự động nhận diện).
   - **Root Directory**: Để trống `./`.
5. Mở rộng mục **Environment Variables** và thêm đầy đủ các biến môi trường sau (lấy giá trị từ file `.env.local` của bạn):

| Tên biến | Giá trị |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Lấy từ `.env.local` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Lấy từ `.env.local` |
| `SUPABASE_SERVICE_ROLE_KEY` | Lấy từ `.env.local` |
| `GOOGLE_CLIENT_ID` | Lấy từ `.env.local` |
| `GOOGLE_CLIENT_SECRET` | Lấy từ `.env.local` |
| `GOOGLE_REFRESH_TOKEN` | Lấy từ `.env.local` |
| `GOOGLE_DRIVE_ROOT_FOLDER_ID` | Lấy từ `.env.local` |
| `NEXT_PUBLIC_APP_URL` | Tạm thời để `https://misa-ticket.vercel.app` (sẽ cập nhật domain chính xác sau) |

6. Bấm nút **Deploy** và chờ khoảng 1 - 2 phút cho đến khi Vercel build xong.
7. Sau khi hoàn tất, Vercel sẽ cấp cho bạn một tên miền chính thức, ví dụ:  
   👉 **`https://misa-ticket-xyz.vercel.app`**

---

## BƯỚC 3: Cấu Hình Lại Trên Google Cloud Console

> [!NOTE]
> Nhờ hệ thống đã lấy thành công **`GOOGLE_REFRESH_TOKEN`**, backend khi chạy trên server Vercel sẽ tự động dùng token này để upload/quản lý file trên Drive mà **người dùng cuối trên web không cần phải đăng nhập Google**.

Tuy nhiên, bạn cần thêm domain của Vercel vào Google Cloud để cấp phép bảo mật:

1. Truy cập [Google Cloud Console — Credentials](https://console.cloud.google.com/apis/credentials).
2. Nhấp vào tên OAuth 2.0 Client ID bạn đã tạo (ví dụ: `MISA Ticket App`).
3. Tại mục **Authorized JavaScript origins (Nguồn gốc JavaScript được ủy quyền)**:
   - Bấm **+ Add URI**.
   - Dán URL Vercel của bạn vào (không có dấu gạch chéo `/` ở cuối):
     ```text
     https://misa-ticket-xyz.vercel.app
     ```
4. Tại mục **Authorized redirect URIs (URI chuyển hướng được ủy quyền)**:
   - Bấm **+ Add URI**.
   - Dán thêm đường link:
     ```text
     https://misa-ticket-xyz.vercel.app/oauth2callback
     ```
5. Cuộn xuống cuối trang và bấm **Save (Lưu)**.

---

## BƯỚC 4: Cấu Hình Lại Trên Supabase Dashboard

Cần cập nhật domain Vercel vào Supabase Auth để chức năng đăng nhập, đăng ký và phiên làm việc cookie hoạt động chuẩn xác:

1. Truy cập [Supabase Dashboard](https://supabase.com/dashboard/project/dsfphqmepfpjjywhzpth).
2. Vào **Authentication** (biểu tượng chiếc khiên ở thanh bên) $\rightarrow$ chọn **URL Configuration**.
3. **Site URL**: Đổi từ `http://localhost:3000` thành domain Vercel của bạn:
   ```text
   https://misa-ticket-xyz.vercel.app
   ```
4. **Redirect URLs**: Bấm **Add URL** và thêm:
   ```text
   https://misa-ticket-xyz.vercel.app/**
   ```
5. Bấm **Save**.

---

## BƯỚC 5: Cập Nhật Biến `NEXT_PUBLIC_APP_URL` Trên Vercel

1. Mở dự án của bạn trên Vercel $\rightarrow$ vào tab **Settings** $\rightarrow$ **Environment Variables**.
2. Tìm biến `NEXT_PUBLIC_APP_URL`, chỉnh sửa giá trị thành:
   `https://misa-ticket-xyz.vercel.app`
3. Chuyển sang tab **Deployments**, bấm vào biểu tượng dấu 3 chấm `...` ở bản deploy mới nhất $\rightarrow$ chọn **Redeploy** để nạp biến môi trường mới.

---

🎉 **Hoàn tất!** Hệ thống Ticket & Chat Log của bạn hiện đã chạy trực tuyến 24/7 trên Vercel, kết nối mượt mà với Supabase Database & Google Drive!
