-- Manglik Meets: Supabase schema and Row Level Security policies.
-- Run this file once in the Supabase SQL Editor before deploying the frontend.
-- Never run it with the service-role key in the browser.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  username text unique,
  date_of_birth date,
  gender text,
  height text, weight text, religion text, caste text, manglik_status text,
  profession text, education text, income text, languages text[] default '{}',
  bio text, interests text[] default '{}', hobbies text[] default '{}', personality_traits text[] default '{}',
  smoking text, drinking text, food_preference text, fitness text, pets text,
  looking_for text, marriage_timeline text, family_type text, values_text text, expectations text,
  city text, state text, country text default 'India', mobile_number text, recovery_email text,
  avatar_url text, cover_url text, is_verified boolean not null default false,
  is_online boolean not null default false, last_active_at timestamptz default now(),
  private_profile boolean not null default false, hide_age boolean not null default false,
  hide_city boolean not null default false, hide_profession boolean not null default false,
  hide_last_seen boolean not null default false, hide_online_status boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
-- Safe upgrades for the earlier, minimal profiles table.
alter table public.profiles
  add column if not exists username text,
  add column if not exists date_of_birth date,
  add column if not exists gender text,
  add column if not exists height text,
  add column if not exists weight text,
  add column if not exists religion text,
  add column if not exists caste text,
  add column if not exists manglik_status text,
  add column if not exists profession text,
  add column if not exists education text,
  add column if not exists income text,
  add column if not exists languages text[] default '{}',
  add column if not exists bio text,
  add column if not exists interests text[] default '{}',
  add column if not exists hobbies text[] default '{}',
  add column if not exists personality_traits text[] default '{}',
  add column if not exists smoking text,
  add column if not exists drinking text,
  add column if not exists food_preference text,
  add column if not exists fitness text,
  add column if not exists pets text,
  add column if not exists looking_for text,
  add column if not exists marriage_timeline text,
  add column if not exists family_type text,
  add column if not exists values_text text,
  add column if not exists expectations text,
  add column if not exists city text,
  add column if not exists state text,
  add column if not exists country text default 'India',
  add column if not exists mobile_number text,
  add column if not exists recovery_email text,
  add column if not exists avatar_url text,
  add column if not exists cover_url text,
  add column if not exists is_verified boolean not null default false,
  add column if not exists is_online boolean not null default false,
  add column if not exists last_active_at timestamptz default now(),
  add column if not exists private_profile boolean not null default false,
  add column if not exists hide_age boolean not null default false,
  add column if not exists hide_city boolean not null default false,
  add column if not exists hide_profession boolean not null default false,
  add column if not exists hide_last_seen boolean not null default false,
  add column if not exists hide_online_status boolean not null default false;
create unique index if not exists profiles_username_unique on public.profiles (username) where username is not null;

create table if not exists public.profile_preferences (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  preferred_age_min smallint, preferred_age_max smallint, preferred_religions text[] default '{}',
  preferred_professions text[] default '{}', preferred_education text, preferred_height text,
  manglik_preference text, max_distance_km integer, preferred_languages text[] default '{}',
  updated_at timestamptz not null default now()
);

create table if not exists public.profile_media (
  id uuid primary key default gen_random_uuid(), profile_id uuid not null references public.profiles(id) on delete cascade,
  storage_path text not null unique, public_url text, media_type text not null check (media_type in ('avatar','cover','gallery')),
  caption text, sort_order smallint not null default 0, created_at timestamptz not null default now()
);

create table if not exists public.profile_likes (
  user_id uuid not null references auth.users(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(), primary key (user_id, profile_id),
  check (user_id <> profile_id)
);

create table if not exists public.saved_profiles (
  user_id uuid not null references auth.users(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(), primary key (user_id, profile_id),
  check (user_id <> profile_id)
);

create table if not exists public.match_actions (
  user_id uuid not null references auth.users(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  action text not null check (action in ('like','pass','save','view')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  primary key (user_id, profile_id, action), check (user_id <> profile_id)
);

create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(), user_one_id uuid not null references auth.users(id) on delete cascade,
  user_two_id uuid not null references auth.users(id) on delete cascade,
  compatibility_score smallint check (compatibility_score between 0 and 100), shared_interests text[] default '{}',
  shared_values text[] default '{}', mutual_preferences text[] default '{}', distance_km integer,
  status text not null default 'suggested' check (status in ('suggested','pending','mutual','passed')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (user_one_id, user_two_id), check (user_one_id <> user_two_id)
);

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.conversation_members (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade, last_read_at timestamptz,
  is_favorite boolean not null default false, joined_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(), conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade, body text, image_path text,
  reply_to_id uuid references public.messages(id) on delete set null, deleted_at timestamptz,
  created_at timestamptz not null default now(), check (body is not null or image_path is not null)
);

-- Extra profile foreign keys make nested profile selects explicit in PostgREST.
alter table public.conversation_members drop constraint if exists conversation_members_profile_fkey;
alter table public.conversation_members add constraint conversation_members_profile_fkey foreign key (user_id) references public.profiles(id) on delete cascade;
alter table public.messages drop constraint if exists messages_sender_profile_fkey;
alter table public.messages add constraint messages_sender_profile_fkey foreign key (sender_id) references public.profiles(id) on delete cascade;
alter table public.matches drop constraint if exists matches_user_one_profile_fkey;
alter table public.matches add constraint matches_user_one_profile_fkey foreign key (user_one_id) references public.profiles(id) on delete cascade;
alter table public.matches drop constraint if exists matches_user_two_profile_fkey;
alter table public.matches add constraint matches_user_two_profile_fkey foreign key (user_two_id) references public.profiles(id) on delete cascade;

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null, category text not null check (category in ('message','match','like','view','verification','community','system')),
  title text not null, body text, target_url text, is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email_notifications boolean not null default true, push_notifications boolean not null default true,
  marketing_notifications boolean not null default false, message_notifications boolean not null default true,
  match_notifications boolean not null default true, theme text not null default 'light', font_size smallint not null default 100,
  reduce_motion boolean not null default false, updated_at timestamptz not null default now()
);

create table if not exists public.community_posts (
  id uuid primary key default gen_random_uuid(), author_id uuid not null references auth.users(id) on delete cascade,
  post_type text not null default 'discussion', body text not null, image_path text, is_published boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.post_reactions (
  post_id uuid not null references public.community_posts(id) on delete cascade, user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(), primary key (post_id,user_id)
);
alter table public.community_posts drop constraint if exists community_posts_author_profile_fkey;
alter table public.community_posts add constraint community_posts_author_profile_fkey foreign key (author_id) references public.profiles(id) on delete cascade;

create or replace function public.get_or_create_conversation(other_user_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare conversation_uuid uuid;
begin
  if other_user_id = auth.uid() then raise exception 'You cannot message yourself'; end if;
  select cm1.conversation_id into conversation_uuid from public.conversation_members cm1
  join public.conversation_members cm2 on cm2.conversation_id = cm1.conversation_id
  where cm1.user_id = auth.uid() and cm2.user_id = other_user_id limit 1;
  if conversation_uuid is null then
    insert into public.conversations default values returning id into conversation_uuid;
    insert into public.conversation_members (conversation_id, user_id) values (conversation_uuid, auth.uid()), (conversation_uuid, other_user_id);
  end if;
  return conversation_uuid;
end; $$;

create or replace function public.set_updated_at() returns trigger language plpgsql as $$ begin new.updated_at = now(); return new; end; $$;
drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at before update on public.profiles for each row execute procedure public.set_updated_at();
drop trigger if exists preferences_updated_at on public.profile_preferences;
create trigger preferences_updated_at before update on public.profile_preferences for each row execute procedure public.set_updated_at();
drop trigger if exists settings_updated_at on public.user_settings;
create trigger settings_updated_at before update on public.user_settings for each row execute procedure public.set_updated_at();

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, username) values (new.id, new.raw_user_meta_data ->> 'full_name', nullif(lower(new.raw_user_meta_data ->> 'username'), '')) on conflict (id) do nothing;
  insert into public.user_settings (user_id) values (new.id) on conflict (user_id) do nothing;
  return new;
end; $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.profile_preferences enable row level security;
alter table public.profile_media enable row level security;
alter table public.profile_likes enable row level security;
alter table public.saved_profiles enable row level security;
alter table public.match_actions enable row level security;
alter table public.matches enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages enable row level security;
alter table public.notifications enable row level security;
alter table public.user_settings enable row level security;
alter table public.community_posts enable row level security;
alter table public.post_reactions enable row level security;

create policy "Profiles are visible to members" on public.profiles for select to authenticated using (not private_profile or id = (select auth.uid()));
create policy "Users update own profile" on public.profiles for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy "Users insert own profile" on public.profiles for insert to authenticated with check (id = (select auth.uid()));
create policy "Preferences own" on public.profile_preferences for all to authenticated using (profile_id = (select auth.uid())) with check (profile_id = (select auth.uid()));
create policy "Media visible with profile" on public.profile_media for select to authenticated using (exists (select 1 from public.profiles p where p.id = profile_id and (not p.private_profile or p.id = (select auth.uid()))));
create policy "Media managed by owner" on public.profile_media for all to authenticated using (profile_id = (select auth.uid())) with check (profile_id = (select auth.uid()));
create policy "Likes own" on public.profile_likes for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "Saves own" on public.saved_profiles for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "Match actions own" on public.match_actions for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "Matches participants only" on public.matches for select to authenticated using (user_one_id = (select auth.uid()) or user_two_id = (select auth.uid()));
create policy "Members create conversations" on public.conversations for insert to authenticated with check (true);
create policy "Members add conversation memberships" on public.conversation_members for insert to authenticated with check (user_id = (select auth.uid()));
create policy "Conversation members view conversations" on public.conversations for select to authenticated using (exists (select 1 from public.conversation_members cm where cm.conversation_id = id and cm.user_id = (select auth.uid())));
create policy "Members view memberships" on public.conversation_members for select to authenticated using (user_id = (select auth.uid()) or exists (select 1 from public.conversation_members mine where mine.conversation_id = conversation_id and mine.user_id = (select auth.uid())));
create policy "Members update own membership" on public.conversation_members for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "Members view messages" on public.messages for select to authenticated using (exists (select 1 from public.conversation_members cm where cm.conversation_id = messages.conversation_id and cm.user_id = (select auth.uid())));
create policy "Members send messages" on public.messages for insert to authenticated with check (sender_id = (select auth.uid()) and exists (select 1 from public.conversation_members cm where cm.conversation_id = messages.conversation_id and cm.user_id = (select auth.uid())));
create policy "Senders delete own messages" on public.messages for update to authenticated using (sender_id = (select auth.uid())) with check (sender_id = (select auth.uid()));
create policy "Notifications own" on public.notifications for select to authenticated using (user_id = (select auth.uid()));
create policy "Notifications update own" on public.notifications for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "Notifications delete own" on public.notifications for delete to authenticated using (user_id = (select auth.uid()));
create policy "Settings own" on public.user_settings for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "Published posts visible" on public.community_posts for select to authenticated using (is_published or author_id = (select auth.uid()));
create policy "Authors manage posts" on public.community_posts for all to authenticated using (author_id = (select auth.uid())) with check (author_id = (select auth.uid()));
create policy "Reactions visible" on public.post_reactions for select to authenticated using (true);
create policy "Reactions own" on public.post_reactions for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- In Storage create a PRIVATE bucket named profile-media. Folder convention: <user-id>/avatar, cover, gallery.
-- These policies keep browser uploads scoped to each authenticated user.
insert into storage.buckets (id, name, public) values ('profile-media','profile-media',false) on conflict (id) do nothing;
create policy "Authenticated read profile media" on storage.objects for select to authenticated using (bucket_id = 'profile-media');
create policy "Users upload own profile media" on storage.objects for insert to authenticated with check (bucket_id = 'profile-media' and (storage.foldername(name))[1] = (select auth.uid()::text));
create policy "Users update own profile media" on storage.objects for update to authenticated using (bucket_id = 'profile-media' and owner_id = (select auth.uid())) with check (bucket_id = 'profile-media' and owner_id = (select auth.uid()));
create policy "Users delete own profile media" on storage.objects for delete to authenticated using (bucket_id = 'profile-media' and owner_id = (select auth.uid()));

-- Enable realtime in Dashboard > Database > Replication for: messages, notifications, matches.
