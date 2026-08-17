-- PDF Tools active-session presence backend for Supabase.
-- Stores only a random browser-session UUID and last_seen timestamp. No PDF names/content, IP, user name or document metadata.
-- Run once in Supabase SQL Editor, then put only the Project URL + PUBLISHABLE key in presence-config-v1.js.

create schema if not exists private;

create table if not exists private.pdftools_presence_sessions (
  session_id uuid primary key,
  last_seen timestamptz not null default now()
);
create index if not exists pdftools_presence_last_seen_idx on private.pdftools_presence_sessions(last_seen);

revoke all on table private.pdftools_presence_sessions from public, anon, authenticated;

create or replace function private.pdftools_presence_heartbeat_impl(p_session_id uuid, p_active_window_seconds integer default 90)
returns integer
language plpgsql
security definer
set search_path = pg_catalog, private
as $$
declare
  v_window integer := greatest(45, least(coalesce(p_active_window_seconds,90), 300));
  v_count integer;
begin
  insert into private.pdftools_presence_sessions(session_id,last_seen)
  values (p_session_id, now())
  on conflict (session_id) do update set last_seen=excluded.last_seen;

  delete from private.pdftools_presence_sessions where last_seen < now() - interval '10 minutes';
  select count(*)::integer into v_count
  from private.pdftools_presence_sessions
  where last_seen >= now() - make_interval(secs => v_window);
  return v_count;
end;
$$;

create or replace function private.pdftools_presence_leave_impl(p_session_id uuid)
returns void
language sql
security definer
set search_path = pg_catalog, private
as $$
  delete from private.pdftools_presence_sessions where session_id = p_session_id;
$$;

-- Thin API wrappers. These contain no privileged SQL; privileged functions/tables remain in the non-exposed private schema.
create or replace function public.pdftools_presence_heartbeat(p_session_id uuid, p_active_window_seconds integer default 90)
returns table(active_count integer)
language sql
security invoker
set search_path = pg_catalog, private
as $$
  select private.pdftools_presence_heartbeat_impl(p_session_id,p_active_window_seconds) as active_count;
$$;

create or replace function public.pdftools_presence_leave(p_session_id uuid)
returns void
language sql
security invoker
set search_path = pg_catalog, private
as $$
  select private.pdftools_presence_leave_impl(p_session_id);
$$;

revoke all on function private.pdftools_presence_heartbeat_impl(uuid,integer) from public;
revoke all on function private.pdftools_presence_leave_impl(uuid) from public;
grant execute on function private.pdftools_presence_heartbeat_impl(uuid,integer) to anon, authenticated;
grant execute on function private.pdftools_presence_leave_impl(uuid) to anon, authenticated;

revoke all on function public.pdftools_presence_heartbeat(uuid,integer) from public;
revoke all on function public.pdftools_presence_leave(uuid) from public;
grant execute on function public.pdftools_presence_heartbeat(uuid,integer) to anon, authenticated;
grant execute on function public.pdftools_presence_leave(uuid) to anon, authenticated;
