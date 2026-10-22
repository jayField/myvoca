-- 単語ノート: per-user study data synced from the browser.
-- Run once in the Supabase dashboard: SQL Editor → New query → paste → Run.
-- Row Level Security limits every row to the signed-in user who owns it.

create table if not exists public.progress (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  item_id text not null,
  ease real not null,
  interval_days integer not null check (interval_days >= 0),
  reps integer not null check (reps >= 0),
  lapses integer not null check (lapses >= 0),
  due date not null,
  first_seen date not null,
  last_grade text not null check (last_grade in ('again', 'hard', 'good')),
  missed_on date,
  updated_at timestamptz not null,
  primary key (user_id, item_id)
);

-- Added after the first release; safe to run again on an existing project.
alter table public.progress add column if not exists missed_on date;

create table if not exists public.day_counts (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  day date not null,
  count integer not null check (count >= 0),
  primary key (user_id, day)
);

create table if not exists public.user_settings (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  deck_id text not null,
  daily_new integer not null check (daily_new between 1 and 100),
  order_mode text not null check (order_mode in ('sequential', 'random')),
  updated_at timestamptz not null
);

alter table public.progress enable row level security;
alter table public.day_counts enable row level security;
alter table public.user_settings enable row level security;

drop policy if exists "own progress" on public.progress;
create policy "own progress" on public.progress
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "own day counts" on public.day_counts;
create policy "own day counts" on public.day_counts
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "own settings" on public.user_settings;
create policy "own settings" on public.user_settings
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Feedback board: every signed-in user can read all notes and delete their own.
-- The author name comes from the account (set by the trigger), never from the browser.
create table if not exists public.feedback (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  author text not null default '',
  category text not null check (category in ('idea', 'bug', 'etc')),
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now()
);

alter table public.feedback enable row level security;

drop policy if exists "read feedback" on public.feedback;
create policy "read feedback" on public.feedback
  for select to authenticated using (true);

drop policy if exists "write own feedback" on public.feedback;
create policy "write own feedback" on public.feedback
  for insert to authenticated with check ((select auth.uid()) = user_id);

drop policy if exists "delete own feedback" on public.feedback;
create policy "delete own feedback" on public.feedback
  for delete to authenticated using ((select auth.uid()) = user_id);

create or replace function public.set_feedback_author()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.user_id := auth.uid();
  new.author := coalesce(
    (select raw_user_meta_data ->> 'username' from auth.users where id = auth.uid()),
    '익명'
  );
  new.created_at := now();
  return new;
end;
$$;

drop trigger if exists feedback_author on public.feedback;
create trigger feedback_author before insert on public.feedback
  for each row execute function public.set_feedback_author();
