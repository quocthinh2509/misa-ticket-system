-- ============================================================
-- Migration: Public Ticket Portal
-- Thêm cột guest_name và guest_email vào bảng tickets
-- Cho phép created_by nullable (cho guest tickets)
-- ============================================================

-- 1. Thêm cột guest_name và guest_email vào bảng tickets
ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS guest_name TEXT,
  ADD COLUMN IF NOT EXISTS guest_email TEXT;

-- 2. Cho phép created_by là NULL (để hỗ trợ guest tickets)
ALTER TABLE public.tickets
  ALTER COLUMN created_by DROP NOT NULL;

-- 3. Comment mô tả
COMMENT ON COLUMN public.tickets.guest_name IS 'Tên người tạo ticket khi không có tài khoản (guest)';
COMMENT ON COLUMN public.tickets.guest_email IS 'Email người tạo ticket khi không có tài khoản (guest), dùng để nhận thông báo';

-- ============================================================
-- RLS (Row Level Security) - Cập nhật cho phép public access
-- ============================================================

-- Bật RLS nếu chưa bật
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;

-- Xóa policy cũ nếu có
DROP POLICY IF EXISTS "Allow public read tickets" ON public.tickets;
DROP POLICY IF EXISTS "Allow authenticated read own tickets" ON public.tickets;
DROP POLICY IF EXISTS "Allow public insert guest tickets" ON public.tickets;
DROP POLICY IF EXISTS "Allow authenticated insert tickets" ON public.tickets;
DROP POLICY IF EXISTS "Allow staff update tickets" ON public.tickets;

-- Policy: Cho phép tất cả mọi người đọc tickets (public portal)
CREATE POLICY "Allow public read tickets"
  ON public.tickets
  FOR SELECT
  USING (true);

-- Policy: Cho phép guest tạo ticket (created_by = NULL)
CREATE POLICY "Allow public insert guest tickets"
  ON public.tickets
  FOR INSERT
  WITH CHECK (created_by IS NULL);

-- Policy: Cho phép authenticated user tạo ticket của mình
CREATE POLICY "Allow authenticated insert tickets"
  ON public.tickets
  FOR INSERT
  WITH CHECK (auth.uid() = created_by);

-- Policy: Cho phép staff (admin/agent) cập nhật bất kỳ ticket nào
CREATE POLICY "Allow staff update tickets"
  ON public.tickets
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
      AND role IN ('admin', 'agent')
    )
  );

-- Policy: Cho phép creator cập nhật ticket của mình
CREATE POLICY "Allow creator update own ticket"
  ON public.tickets
  FOR UPDATE
  USING (auth.uid() = created_by);

-- ============================================================
-- Tags: Cho phép public đọc tags
-- ============================================================

ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read tags" ON public.tags;

CREATE POLICY "Allow public read tags"
  ON public.tags
  FOR SELECT
  USING (true);

-- ============================================================
-- Ticket Tags: Cho phép public đọc
-- ============================================================

ALTER TABLE public.ticket_tags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read ticket_tags" ON public.ticket_tags;

CREATE POLICY "Allow public read ticket_tags"
  ON public.ticket_tags
  FOR SELECT
  USING (true);

-- ============================================================
-- NOTES:
-- - API routes dùng createAdminClient() (service role) để bypass RLS
--   nên các policy trên chủ yếu ảnh hưởng direct DB access
-- - Nếu bạn dùng Supabase JS client trực tiếp từ frontend thì
--   các RLS policy này sẽ apply
-- ============================================================

-- ============================================================
-- chat_logs: Cho phép sender_id nullable (cho system log của guest ticket)
-- ============================================================

ALTER TABLE public.chat_logs
  ALTER COLUMN sender_id DROP NOT NULL;

