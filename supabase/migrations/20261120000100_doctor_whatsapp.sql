-- Existing applications may predate collection of WhatsApp numbers.
alter table public.doctor_applications add column whatsapp_number text
  check (whatsapp_number ~ '^[+][1-9][0-9]{7,14}$');
grant insert (whatsapp_number) on public.doctor_applications to authenticated;
alter policy own_pending_application_insert on public.doctor_applications
  with check (user_id = (select auth.uid()) and status = 'pending' and whatsapp_number is not null);

create or replace function curable_private.admin_queues() returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  perform curable_private.require_admin();
  return jsonb_build_object(
    'applications', coalesce((select jsonb_agg(to_jsonb(a)) from (
      select d.user_id, d.full_name, d.registration_number, d.workplace, d.whatsapp_number, d.status, u.email
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
