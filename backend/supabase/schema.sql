-- MyKampung online backend (Supabase). Run once in the Supabase SQL editor.
-- NOT deployed by this repository: someone with access to the Supabase project must run it.

-- ------------------------------------------------------------------ cloud saves: one row per player
create table if not exists public.saves (
  user_id      uuid primary key references auth.users (id) on delete cascade,
  data         jsonb not null check (jsonb_typeof(data) = 'object' and octet_length(data::text) < 262144), -- 256 KB cap
  save_version int not null default 0,
  saved_at     timestamptz not null,
  updated_at   timestamptz not null default now()
);
alter table public.saves enable row level security;

-- players can only read their own save; writes go through put_save() only
drop policy if exists "read own save" on public.saves;
create policy "read own save" on public.saves for select to authenticated using (user_id = auth.uid());
drop policy if exists "insert own save" on public.saves;
create policy "insert own save" on public.saves for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "update own save" on public.saves;
create policy "update own save" on public.saves for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- keep the newer save: an older device can never overwrite newer cloud progress. Returns true if stored.
-- security invoker: runs as the caller, so the RLS policies above still apply.
create or replace function public.put_save(p_data jsonb, p_saved_at timestamptz, p_version int)
returns boolean language plpgsql security invoker set search_path = public as $$
declare n int;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if p_saved_at > now() + interval '5 minutes' then raise exception 'saved_at in the future'; end if;
  insert into public.saves (user_id, data, save_version, saved_at, updated_at)
  values (auth.uid(), p_data, coalesce(p_version, 0), p_saved_at, now())
  on conflict (user_id) do update set data = excluded.data, save_version = excluded.save_version, saved_at = excluded.saved_at, updated_at = now()
    where public.saves.saved_at < excluded.saved_at;
  get diagnostics n = row_count;
  return n > 0;
end $$;
revoke all on function public.put_save(jsonb, timestamptz, int) from public, anon;
grant execute on function public.put_save(jsonb, timestamptz, int) to authenticated;

-- ------------------------------------------------------------------ rooms: Realtime private channels "room:<CODE>"
-- Only signed-in players may join a room channel and share presence. (Supabase Realtime Authorization.)
drop policy if exists "signed-in players use rooms" on realtime.messages;
create policy "signed-in players use rooms" on realtime.messages for select to authenticated
  using (realtime.topic() ~ '^room:[A-Z0-9]{4,8}$');
drop policy if exists "signed-in players send in rooms" on realtime.messages;
create policy "signed-in players send in rooms" on realtime.messages for insert to authenticated
  with check (realtime.topic() ~ '^room:[A-Z0-9]{4,8}$');
