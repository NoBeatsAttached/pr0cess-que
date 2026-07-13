-- =============================================================
-- PR0CESS // QUEUE — one-paste backend setup for Supabase
-- Paste this WHOLE file into: Supabase > SQL Editor > Run once.
-- =============================================================

-- YOUR DASHBOARD PIN. Change it if you want (keep the quotes).
-- You and G-REX type this once to unlock the dashboard.
do $$ begin
  perform set_config('pq.pin', 'PQ-TEAROUT-7391', false);
end $$;

-- ---------- private secrets (never exposed to the site) ----------
create schema if not exists private;
create table if not exists private.secrets ( id int primary key default 1, pin text not null );
insert into private.secrets (id, pin)
  values (1, current_setting('pq.pin'))
  on conflict (id) do update set pin = excluded.pin;

-- ---------- queue ----------
create table if not exists public.queue (
  id         uuid primary key default gen_random_uuid(),
  handle     text not null check (char_length(handle) between 1 and 40),
  title      text not null check (char_length(title) between 1 and 80),
  link       text not null check (link ~* '^https?://'),
  note       text check (char_length(note) <= 240),
  genre      text check (char_length(genre) <= 30),
  status     text not null default 'queued' check (status in ('queued','reviewing','done','skipped')),
  sort_key   bigint not null default (extract(epoch from now())*1000)::bigint,
  created_at timestamptz not null default now()
);

-- one ACTIVE submission per handle — a spammer gets one slot, then blocked
create unique index if not exists one_active_per_handle
  on public.queue (lower(handle)) where (status in ('queued','reviewing'));

-- ---------- session open/close ----------
create table if not exists public.session ( id int primary key default 1, open boolean not null default true );
insert into public.session (id, open) values (1, true) on conflict (id) do nothing;

-- ---------- row security ----------
alter table public.queue   enable row level security;
alter table public.session enable row level security;

drop policy if exists "public read queue"   on public.queue;
drop policy if exists "public submit queue" on public.queue;
drop policy if exists "public read session" on public.session;

create policy "public read queue"   on public.queue   for select using (true);
create policy "public read session" on public.session for select using (true);

-- anyone can SUBMIT (insert only, only while session is open, only as 'queued')
create policy "public submit queue" on public.queue for insert
  with check (
    status = 'queued'
    and (select open from public.session where id = 1)
  );
-- no public update/delete policies exist — only the PIN functions below can manage the queue.

-- ---------- PIN-guarded admin functions ----------
create or replace function public.pq_verify_pin(p_pin text)
returns boolean language sql security definer set search_path = '' as $$
  select exists (select 1 from private.secrets where id = 1 and pin = p_pin);
$$;

create or replace function public.pq_admin(p_pin text, p_cmd text, p_id uuid default null)
returns void language plpgsql security definer set search_path = '' as $$
declare v_min bigint;
begin
  if not exists (select 1 from private.secrets where id = 1 and pin = p_pin) then
    raise exception 'bad pin';
  end if;

  if p_cmd = 'review' then
    update public.queue set status = 'done' where status = 'reviewing';
    update public.queue set status = 'reviewing' where id = p_id;
  elsif p_cmd = 'done' then
    update public.queue set status = 'done' where id = p_id;
  elsif p_cmd = 'skip' then
    update public.queue set status = 'skipped' where id = p_id;
  elsif p_cmd = 'requeue' then
    update public.queue set status = 'queued' where id = p_id;
  elsif p_cmd = 'bump' then
    select min(sort_key) into v_min from public.queue where status = 'queued';
    update public.queue set sort_key = coalesce(v_min,0) - 1000 where id = p_id;
  elsif p_cmd = 'delete' then
    delete from public.queue where id = p_id;
  elsif p_cmd = 'open' then
    update public.session set open = true where id = 1;
  elsif p_cmd = 'close' then
    update public.session set open = false where id = 1;
  elsif p_cmd = 'clear_reviewed' then
    delete from public.queue where status in ('done','skipped');
  elsif p_cmd = 'clear_all' then
    delete from public.queue;
  else
    raise exception 'unknown command %', p_cmd;
  end if;
end $$;

grant execute on function public.pq_verify_pin(text) to anon;
grant execute on function public.pq_admin(text, text, uuid) to anon;

-- ---------- live updates for dashboard + overlay ----------
do $$ begin
  begin
    alter publication supabase_realtime add table public.queue;
  exception when duplicate_object then null; end;
  begin
    alter publication supabase_realtime add table public.session;
  exception when duplicate_object then null; end;
end $$;

select 'PR0CESS QUEUE backend ready. Your dashboard PIN: ' || pin as result
from private.secrets where id = 1;
