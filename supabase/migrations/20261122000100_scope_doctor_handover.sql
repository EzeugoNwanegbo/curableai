-- Bind confirmed handovers to their recipient independently of the patient's current selection.
alter table public.review_queue add column recipient_doctor uuid references auth.users(id) on delete set null;

-- Recover only recipients recorded in the original handover.
update public.review_queue r set recipient_doctor = u.id
from auth.users u
where r.confirmed_at is not null and u.raw_app_meta_data->>'role'='doctor'
and lower(substring(split_part(r.ai_recommendation,E'\n',1) from '^Assigned doctor: .* \(([^()]+)\)$'))=lower(u.email);

create function curable_private.bind_review_recipient() returns trigger
language plpgsql security definer set search_path='' as $$
declare recipient uuid;
begin
 select u.id into recipient from public.patient_doctors pd
 join auth.users u on lower(u.email)=lower(pd.doctor_email)
 join public.doctor_applications d on d.user_id=u.id and d.status='approved'
 where pd.patient_id=new.patient_id and pd.status='active' and u.raw_app_meta_data->>'role'='doctor'
 and lower(substring(split_part(new.ai_recommendation,E'\n',1) from '^Assigned doctor: .* \(([^()]+)\)$'))=lower(u.email)
 for share of pd;
 if recipient is null then raise exception 'Your selected doctor changed. Reopen the summary and confirm the recipient.'; end if;
 new.recipient_doctor := recipient;
 return new;
end $$;
revoke all on function curable_private.bind_review_recipient() from public,anon,authenticated;
create trigger assign_review_recipient before insert on public.review_queue for each row execute function curable_private.bind_review_recipient();

create policy scoped_review on public.review_queue as restrictive for select to authenticated
using(patient_id=auth.uid() or recipient_doctor=auth.uid());
create policy scoped_review_update on public.review_queue as restrictive for update to authenticated
using(recipient_doctor=auth.uid()) with check(recipient_doctor=auth.uid());
create policy scoped_request on public.doctor_reports as restrictive for all to authenticated
using(patient_id=auth.uid() or exists(select 1 from public.review_queue r where r.id=doctor_reports.review_id and r.patient_id=doctor_reports.patient_id and r.recipient_doctor=auth.uid()));
create policy scoped_request on public.consultations as restrictive for all to authenticated
using(patient_id=auth.uid() or exists(select 1 from public.review_queue r where r.id=consultations.review_id and r.patient_id=consultations.patient_id and r.recipient_doctor=auth.uid()));
create policy scoped_thread on public.consultation_messages as restrictive for all to authenticated
using(patient_id=auth.uid() or exists(select 1 from public.consultations c where c.id=consultation_messages.consultation_id and c.patient_id=consultation_messages.patient_id));
create or replace function public.curable_choose_doctor(target uuid) returns void
language plpgsql security definer set search_path='' as $$
declare selected record;
begin
 select d.full_name,d.workplace,u.email into strict selected from public.doctor_applications d
 join auth.users u on d.user_id=u.id where d.user_id=target and d.status='approved' and u.raw_app_meta_data->>'role'='doctor';
 if not exists(select 1 from public.patients where id=auth.uid()) then raise exception 'Patient account required'; end if;
 insert into public.patient_doctors(patient_id,doctor_name,doctor_email,clinic_name,status)
 values(auth.uid(),selected.full_name,selected.email,selected.workplace,'active')
 on conflict(patient_id) do update set doctor_name=excluded.doctor_name,doctor_email=excluded.doctor_email,clinic_name=excluded.clinic_name,status='active',updated_at=now();
end $$;

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
      select q.id, p.full_name as patient_name, coalesce(c.doctor_name, d.full_name) as doctor_name, q.status, q.created_at
      from public.review_queue q join public.patients p on p.id = q.patient_id
      left join public.doctor_applications d on d.user_id = q.recipient_doctor
      left join lateral (select doctor_name from public.consultations where review_id = q.id order by started_at desc limit 1) c on true
      where q.confirmed_at is not null
      order by q.created_at desc limit 100
    ) r), '[]'::jsonb)
  );
end;
$$;
