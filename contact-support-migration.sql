-- Manglik Meets contact and support system migration.
-- Run after outputs/supabase-schema.sql in the Supabase SQL Editor.

create table if not exists public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  name text not null check (char_length(name) between 2 and 100),
  email text not null check (char_length(email) between 5 and 254),
  subject text not null check (char_length(subject) between 3 and 160),
  message text not null check (char_length(message) between 10 and 4000),
  status text not null default 'new' check (status in ('new', 'in_progress', 'resolved', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists contact_messages_status_created_idx on public.contact_messages (status, created_at desc);
create index if not exists contact_messages_email_created_idx on public.contact_messages (email, created_at desc);
create index if not exists contact_messages_user_id_idx on public.contact_messages (user_id);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$ begin new.updated_at = now(); return new; end; $$;

create or replace function public.is_support_admin()
returns boolean language sql stable as $$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false);
$$;

drop trigger if exists contact_messages_updated_at on public.contact_messages;
create trigger contact_messages_updated_at
  before update on public.contact_messages
  for each row execute procedure public.set_updated_at();

alter table public.contact_messages enable row level security;

drop policy if exists "Users can view their own contact messages" on public.contact_messages;
create policy "Users can view their own contact messages"
  on public.contact_messages for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "Admins can view contact messages" on public.contact_messages;
create policy "Admins can view contact messages"
  on public.contact_messages for select to authenticated
  using (public.is_support_admin());

drop policy if exists "Admins can update contact messages" on public.contact_messages;
create policy "Admins can update contact messages"
  on public.contact_messages for update to authenticated
  using (public.is_support_admin()) with check (public.is_support_admin());

drop policy if exists "Admins can delete contact messages" on public.contact_messages;
create policy "Admins can delete contact messages"
  on public.contact_messages for delete to authenticated
  using (public.is_support_admin());

-- Guest submissions are inserted only from the Netlify Function using the
-- service-role key. There is deliberately no public browser INSERT policy.
-- Mark an admin in Supabase Auth app_metadata, for example:
-- { "role": "admin" }
