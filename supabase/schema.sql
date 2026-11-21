-- Run this entire file in Supabase Dashboard > SQL Editor.
-- Employees must first be created under Authentication > Users.
-- Set each user's User Metadata field "full_name" if you want a display name.

create table if not exists public.attendance (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  work_date date not null default (now() at time zone 'Asia/Manila')::date,
  time_in timestamptz,
  time_out timestamptz,
  created_at timestamptz not null default now(),
  constraint attendance_one_record_per_day unique (user_id, work_date),
  constraint attendance_time_order check (time_out is null or (time_in is not null and time_out >= time_in))
);

alter table public.attendance enable row level security;

drop policy if exists "Employees can view their own attendance" on public.attendance;
create policy "Employees can view their own attendance"
on public.attendance for select
to authenticated
using (auth.uid() = user_id);

-- No direct insert/update/delete policies are created.
-- Employees can change records only through the two controlled RPC functions.

create or replace function public.clock_in()
returns public.attendance
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  result public.attendance;
  current_user_id uuid := auth.uid();
  today_manila date := (now() at time zone 'Asia/Manila')::date;
begin
  if current_user_id is null then
    raise exception 'You must be signed in.';
  end if;

  insert into public.attendance (user_id, work_date, time_in)
  values (current_user_id, today_manila, now())
  on conflict (user_id, work_date) do nothing
  returning * into result;

  if result.id is null then
    raise exception 'You have already recorded time in for today.';
  end if;

  return result;
end;
$$;

create or replace function public.clock_out()
returns public.attendance
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  result public.attendance;
  current_user_id uuid := auth.uid();
  today_manila date := (now() at time zone 'Asia/Manila')::date;
begin
  if current_user_id is null then
    raise exception 'You must be signed in.';
  end if;

  update public.attendance
  set time_out = now()
  where user_id = current_user_id
    and work_date = today_manila
    and time_in is not null
    and time_out is null
  returning * into result;

  if result.id is null then
    raise exception 'No active time-in record found for today, or time out was already recorded.';
  end if;

  return result;
end;
$$;

grant usage on schema public to authenticated;
grant select on public.attendance to authenticated;
grant execute on function public.clock_in() to authenticated;
grant execute on function public.clock_out() to authenticated;
