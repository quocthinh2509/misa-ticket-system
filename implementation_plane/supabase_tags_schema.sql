-- ==============================================================================
-- MISA TICKET SYSTEM - TAGS SYSTEM MIGRATION SCRIPT
-- Copy và dán vào Supabase Dashboard -> SQL Editor -> Run
-- ==============================================================================

-- 1. BẢNG TAGS (DANH MỤC NHÃN)
create table if not exists public.tags (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  color text not null default '#6366f1',
  created_at timestamptz not null default now()
);

-- 2. BẢNG TICKET_TAGS (LIÊN KẾT TICKET VÀ TAG)
create table if not exists public.ticket_tags (
  ticket_id uuid not null references public.tickets(id) on delete cascade,
  tag_id uuid not null references public.tags(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (ticket_id, tag_id)
);

create index if not exists idx_ticket_tags_ticket on public.ticket_tags(ticket_id);
create index if not exists idx_ticket_tags_tag on public.ticket_tags(tag_id);

-- 3. ROW LEVEL SECURITY (RLS) CHO TAGS VÀ TICKET_TAGS
alter table public.tags enable row level security;
alter table public.ticket_tags enable row level security;

-- Policies cho bảng tags:
-- Mọi người dùng đã đăng nhập đều có quyền XEM (select)
drop policy if exists "Authenticated users can view tags" on public.tags;
create policy "Authenticated users can view tags"
  on public.tags for select
  using (auth.uid() is not null);

-- CHỈ ADMIN mới có quyền THÊM (insert) nhãn
drop policy if exists "Only admin can create tags" on public.tags;
create policy "Only admin can create tags"
  on public.tags for insert
  with check (public.get_current_user_role() = 'admin');

-- CHỈ ADMIN mới có quyền SỬA (update) nhãn
drop policy if exists "Only admin can update tags" on public.tags;
create policy "Only admin can update tags"
  on public.tags for update
  using (public.get_current_user_role() = 'admin');

-- CHỈ ADMIN mới có quyền XÓA (delete) nhãn
drop policy if exists "Only admin can delete tags" on public.tags;
create policy "Only admin can delete tags"
  on public.tags for delete
  using (public.get_current_user_role() = 'admin');

-- Policies cho bảng ticket_tags:
-- Xem liên kết tag của ticket: Bất kỳ ai có quyền xem ticket
drop policy if exists "Users can view ticket tags" on public.ticket_tags;
create policy "Users can view ticket tags"
  on public.ticket_tags for select
  using (
    exists (
      select 1 from public.tickets t
      where t.id = ticket_tags.ticket_id
      and (
        t.created_by = auth.uid()
        or t.assigned_to = auth.uid()
        or public.get_current_user_role() in ('admin', 'agent')
      )
    )
  );

-- Gắn nhãn vào ticket: Người tạo ticket, agent phụ trách hoặc admin
drop policy if exists "Users can assign tags to tickets" on public.ticket_tags;
create policy "Users can assign tags to tickets"
  on public.ticket_tags for insert
  with check (
    exists (
      select 1 from public.tickets t
      where t.id = ticket_tags.ticket_id
      and (
        t.created_by = auth.uid()
        or t.assigned_to = auth.uid()
        or public.get_current_user_role() in ('admin', 'agent')
      )
    )
  );

-- Gỡ nhãn khỏi ticket: Người tạo ticket, agent phụ trách hoặc admin
drop policy if exists "Users can remove tags from tickets" on public.ticket_tags;
create policy "Users can remove tags from tickets"
  on public.ticket_tags for delete
  using (
    exists (
      select 1 from public.tickets t
      where t.id = ticket_tags.ticket_id
      and (
        t.created_by = auth.uid()
        or t.assigned_to = auth.uid()
        or public.get_current_user_role() in ('admin', 'agent')
      )
    )
  );

-- 4. INSERT MỘT SỐ TAG MẪU BAN ĐẦU (NẾU CHƯA CÓ)
insert into public.tags (name, color) values
  ('Lỗi phần mềm', '#ef4444'),
  ('Kế toán / Thuế', '#06b6d4'),
  ('Hóa đơn điện tử', '#8b5cf6'),
  ('Cần xử lý gấp', '#f97316'),
  ('Tư vấn sử dụng', '#10b981')
on conflict (name) do nothing;
