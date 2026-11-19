create schema if not exists curable_private;
revoke all on schema curable_private from public;
grant usage on schema curable_private to authenticated;

create table public.doctor_applications (
  user_id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null check (length(trim(full_name)) between 1 and 120),
  registration_number text not null check (length(trim(registration_number)) between 1 and 80),
  workplace text not null check (length(trim(workplace)) between 1 and 160),
  status text not null default 'pending' check (status in ('pending', 'approved', 'declined')),
  created_at timestamptz not null default now()
);
alter table public.doctor_applications enable row level security;
revoke all on public.doctor_applications from public, anon, authenticated;
grant select on public.doctor_applications to authenticated;
grant insert (user_id, full_name, registration_number, workplace) on public.doctor_applications to authenticated;
create policy own_application_read on public.doctor_applications for select to authenticated
using (user_id = (select auth.uid()));
create policy own_pending_application_insert on public.doctor_applications for insert to authenticated
with check (user_id = (select auth.uid()) and status = 'pending');

-- Provision the curable_admin app metadata flag separately for the verified administrator.
create function curable_private.require_admin() returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from auth.users where id = auth.uid() and email_confirmed_at is not null
    and raw_app_meta_data @> '{"curable_admin":true}'::jsonb) then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;
end;
$$;

create function curable_private.admin_queues() returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  perform curable_private.require_admin();
  return jsonb_build_object(
    'applications', coalesce((select jsonb_agg(to_jsonb(a)) from (
      select d.user_id, d.full_name, d.registration_number, d.workplace, d.status, u.email
      from public.doctor_applications d join auth.users u on u.id = d.user_id
      order by (d.status = 'pending') desc, d.created_at desc limit 100
    ) a), '[]'::jsonb),
    'requests', coalesce((select jsonb_agg(to_jsonb(r)) from (
      select q.id, p.full_name as patient_name, coalesce(c.doctor_name, pd.doctor_name) as doctor_name, q.status, q.created_at
      from public.review_queue q join public.patients p on p.id = q.patient_id
      left join public.patient_doctors pd on pd.patient_id = q.patient_id
      left join lateral (select doctor_name from public.consultations where review_id = q.id order by started_at desc limit 1) c on true
      where q.confirmed_at is not null
      order by q.created_at desc limit 100
    ) r), '[]'::jsonb)
  );
end;
$$;

create function curable_private.review_application(target uuid, decision text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform curable_private.require_admin();
  if decision is null or decision not in ('approved', 'declined') then
    raise exception 'Invalid decision';
  end if;
  update public.doctor_applications set status = decision where user_id = target and status = 'pending';
  if not found then raise exception 'This application is no longer pending'; end if;
  if decision = 'approved' then
    update auth.users set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role":"doctor"}'::jsonb
    where id = target and email_confirmed_at is not null;
    if not found then raise exception 'The applicant must verify their email first'; end if;
  end if;
end;
$$;

create function public.curable_admin_queues() returns jsonb
language sql security invoker set search_path = '' as $$ select curable_private.admin_queues() $$;
create function public.curable_review_application(target uuid, decision text) returns void
language sql security invoker set search_path = '' as $$ select curable_private.review_application(target, decision) $$;

revoke execute on function curable_private.require_admin() from public, anon, authenticated;
revoke execute on function curable_private.admin_queues(), curable_private.review_application(uuid, text),
  public.curable_admin_queues(), public.curable_review_application(uuid, text) from public, anon;
grant execute on function curable_private.admin_queues(), curable_private.review_application(uuid, text),
  public.curable_admin_queues(), public.curable_review_application(uuid, text) to authenticated;

create function curable_private.mark_new_health_setup() returns trigger
language plpgsql set search_path = '' as $$
begin
  if coalesce(new.raw_app_meta_data ->> 'provider', '') in ('google', 'email') then
    new.raw_user_meta_data := coalesce(new.raw_user_meta_data, '{}'::jsonb) || '{"health_setup_pending":true}'::jsonb;
  end if;
  return new;
end;
$$;
revoke execute on function curable_private.mark_new_health_setup() from public, anon, authenticated;
create trigger curable_mark_new_health_setup before insert on auth.users
for each row execute function curable_private.mark_new_health_setup();
