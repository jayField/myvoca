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
  updated_at timestamptz not null,
  primary key (user_id, item_id)
);

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
