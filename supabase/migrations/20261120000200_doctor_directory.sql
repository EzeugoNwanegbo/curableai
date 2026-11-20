alter table public.doctor_applications add column specialty text check (length(trim(specialty)) between 1 and 100);
grant insert (specialty) on public.doctor_applications to authenticated;
alter policy own_pending_application_insert on public.doctor_applications
with check (user_id = (select auth.uid()) and status = 'pending' and whatsapp_number is not null and specialty is not null);

-- Only new consultations have a reliably identified accepting doctor.
alter table public.consultations add column accepting_doctor uuid references auth.users(id) on delete set null;
alter table public.consultations alter column accepting_doctor set default auth.uid();
create table curable_private.doctor_ratings (
  consultation_id uuid primary key references public.consultations(id) on delete cascade,
  stars smallint not null check (stars between 1 and 5)
);
revoke all on curable_private.doctor_ratings from public, anon, authenticated;

create function public.curable_directory() returns table
(id uuid, name text, specialty text, workplace text, rating numeric, ratings bigint)
language sql stable security definer set search_path='' as $$
 select d.user_id,d.full_name,d.specialty,d.workplace,round(avg(r.stars),1),count(r.stars)
 from public.doctor_applications d join auth.users u on u.id=d.user_id
 left join public.consultations c on c.accepting_doctor=d.user_id
 left join curable_private.doctor_ratings r on r.consultation_id=c.id
 where d.status='approved' and u.raw_app_meta_data->>'role'='doctor'
 group by d.user_id order by d.full_name,d.user_id
$$;
create function public.curable_choose_doctor(target uuid) returns void
language plpgsql security definer set search_path='' as $$
declare selected record;
begin
 select d.full_name,d.workplace,u.email into strict selected from public.doctor_applications d
 join auth.users u on d.user_id=u.id where d.user_id=target and d.status='approved' and u.raw_app_meta_data->>'role'='doctor';
 if not exists(select 1 from public.patients where id=auth.uid()) then raise exception 'Patient account required'; end if;
 if exists(select 1 from public.review_queue where patient_id=auth.uid() and confirmed_at is not null)
 and not exists(select 1 from public.patient_doctors where patient_id=auth.uid() and lower(doctor_email)=lower(selected.email))
 then raise exception 'Doctor change requires a new sharing authorization'; end if;
 insert into public.patient_doctors(patient_id,doctor_name,doctor_email,clinic_name,status)
 values(auth.uid(),selected.full_name,selected.email,selected.workplace,'active')
 on conflict(patient_id) do update set doctor_name=excluded.doctor_name,doctor_email=excluded.doctor_email,clinic_name=excluded.clinic_name,status='active',updated_at=now();
end $$;
create function public.curable_rate_visit(visit uuid, score smallint) returns void
language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.consultations where id=visit and patient_id=auth.uid()
 and accepting_doctor is not null and status in ('active','closed')) then raise exception 'Consultation unavailable'; end if;
 insert into curable_private.doctor_ratings values(visit,score) on conflict(consultation_id) do update set stars=excluded.stars;
end $$;
revoke all on function public.curable_directory(),public.curable_choose_doctor(uuid),public.curable_rate_visit(uuid,smallint) from public,anon;
grant execute on function public.curable_directory(),public.curable_choose_doctor(uuid),public.curable_rate_visit(uuid,smallint) to authenticated;

create or replace function curable_private.admin_queues() returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  perform curable_private.require_admin();
  return jsonb_build_object(
    'applications', coalesce((select jsonb_agg(to_jsonb(a)) from (
      select d.user_id, d.full_name, d.registration_number, d.workplace, d.whatsapp_number, d.specialty, d.status, u.email
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
