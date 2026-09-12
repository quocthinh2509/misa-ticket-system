-- ==============================================================================
-- MISA TICKET SYSTEM - SUPABASE DATABASE INITIALIZATION SCRIPT
-- Copy và dán toàn bộ nội dung này vào Supabase Dashboard -> SQL Editor -> Run
-- ==============================================================================

-- 1. BẢNG USERS (Mở rộng từ auth.users)
create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text unique not null,
  role text not null default 'user' check (role in ('admin', 'agent', 'user')),
  department text,
  created_at timestamptz not null default now()
);

-- 2. BẢNG TICKETS
create table if not exists public.tickets (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  status text not null default 'open' check (status in ('open', 'in_progress', 'resolved', 'closed')),
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high', 'urgent')),
  created_by uuid not null references public.users(id),
  assigned_to uuid references public.users(id),
  drive_folder_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_tickets_status_assigned on public.tickets(status, assigned_to);
create index if not exists idx_tickets_created_by on public.tickets(created_by);

-- 3. BẢNG CHAT_LOGS
create table if not exists public.chat_logs (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.tickets(id) on delete cascade,
  sender_id uuid not null references public.users(id),
  message text not null,
  message_type text not null default 'text' check (message_type in ('text', 'system', 'file_ref')),
  created_at timestamptz not null default now()
);

create index if not exists idx_chatlogs_ticket_created on public.chat_logs(ticket_id, created_at);

-- 4. BẢNG ATTACHMENTS
create table if not exists public.attachments (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.tickets(id) on delete cascade,
  chat_log_id uuid references public.chat_logs(id) on delete set null,
  drive_file_id text not null,
  file_name text not null,
  file_type text,
  uploaded_by uuid not null references public.users(id),
  created_at timestamptz not null default now()
);

create index if not exists idx_attachments_ticket on public.attachments(ticket_id);

-- ------------------------------------------------------------------------------
-- 5. TRIGGER TỰ ĐỘNG TẠO USER PROFILE KHI ĐĂNG KÝ TRÊN SUPABASE AUTH
-- ------------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.users (id, full_name, email, role, department)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.email,
    coalesce(new.raw_user_meta_data->>'role', 'user'),
    coalesce(new.raw_user_meta_data->>'department', '')
  )
  on conflict (id) do update set
    email = excluded.email,
    full_name = coalesce(excluded.full_name, public.users.full_name);
  return new;
end;
$$ language plpgsql security definer;

-- Drop trigger nếu đã tồn tại để tránh trùng lặp
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Trigger cập nhật updated_at cho bảng tickets
create or replace function public.set_current_timestamp_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trigger_update_ticket_timestamp on public.tickets;
create trigger trigger_update_ticket_timestamp
  before update on public.tickets
  for each row execute function public.set_current_timestamp_updated_at();

-- ------------------------------------------------------------------------------
-- 6. ROW LEVEL SECURITY (RLS) POLICIES
-- ------------------------------------------------------------------------------
alter table public.users enable row level security;
alter table public.tickets enable row level security;
alter table public.chat_logs enable row level security;
alter table public.attachments enable row level security;

-- Helper function lấy role của user hiện tại
create or replace function public.get_current_user_role()
returns text as $$
  select role from public.users where id = auth.uid();
$$ language sql security definer stable;

-- Users policies
drop policy if exists "Users can read own profile or admin/agent read all" on public.users;
create policy "Users can read own profile or admin/agent read all"
  on public.users for select
  using (
    auth.uid() = id or public.get_current_user_role() in ('admin', 'agent')
  );

drop policy if exists "Users can update own profile or admin update all" on public.users;
create policy "Users can update own profile or admin update all"
  on public.users for update
  using (
    auth.uid() = id or public.get_current_user_role() = 'admin'
  );

-- Tickets policies
drop policy if exists "View tickets policy" on public.tickets;
create policy "View tickets policy"
  on public.tickets for select
  using (
    created_by = auth.uid()
    or assigned_to = auth.uid()
    or public.get_current_user_role() in ('admin', 'agent')
  );

drop policy if exists "Create ticket policy" on public.tickets;
create policy "Create ticket policy"
  on public.tickets for insert
  with check (
    auth.uid() is not null
  );

drop policy if exists "Update ticket policy" on public.tickets;
create policy "Update ticket policy"
  on public.tickets for update
  using (
    created_by = auth.uid()
    or assigned_to = auth.uid()
    or public.get_current_user_role() in ('admin', 'agent')
  );

-- Chat logs policies
drop policy if exists "View chat logs policy" on public.chat_logs;
create policy "View chat logs policy"
  on public.chat_logs for select
  using (
    exists (
      select 1 from public.tickets t
      where t.id = chat_logs.ticket_id
      and (
        t.created_by = auth.uid()
        or t.assigned_to = auth.uid()
        or public.get_current_user_role() in ('admin', 'agent')
      )
    )
  );

drop policy if exists "Insert chat logs policy" on public.chat_logs;
create policy "Insert chat logs policy"
  on public.chat_logs for insert
  with check (
    sender_id = auth.uid()
    and exists (
      select 1 from public.tickets t
      where t.id = chat_logs.ticket_id
      and (
        t.created_by = auth.uid()
        or t.assigned_to = auth.uid()
        or public.get_current_user_role() in ('admin', 'agent')
      )
    )
  );

-- Attachments policies
drop policy if exists "View attachments policy" on public.attachments;
create policy "View attachments policy"
  on public.attachments for select
  using (
    exists (
      select 1 from public.tickets t
      where t.id = attachments.ticket_id
      and (
        t.created_by = auth.uid()
        or t.assigned_to = auth.uid()
        or public.get_current_user_role() in ('admin', 'agent')
      )
    )
  );

drop policy if exists "Insert attachments policy" on public.attachments;
create policy "Insert attachments policy"
  on public.attachments for insert
  with check (
    uploaded_by = auth.uid()
  );

-- ------------------------------------------------------------------------------
-- 7. KÍCH HOẠT SUPABASE REALTIME CHO BẢNG CHAT_LOGS & TICKETS
-- ------------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables 
    where pubname = 'supabase_realtime' and tablename = 'chat_logs'
  ) then
    alter publication supabase_realtime add table public.chat_logs;
  end if;

  if not exists (
    select 1 from pg_publication_tables 
    where pubname = 'supabase_realtime' and tablename = 'tickets'
  ) then
    alter publication supabase_realtime add table public.tickets;
  end if;
end $$;
