-- Curable Auth: ownership and explicitly assigned, approved doctors.
create table if not exists public.patient_doctors (
 patient_id uuid primary key references public.patients(id) on delete cascade,
 doctor_name text not null, doctor_email text not null default '', clinic_name text not null default '',
 status text not null default 'active' check (status in ('active','removed')),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table public.patient_doctors enable row level security;
revoke all on public.patient_doctors from anon;
grant select, insert, update, delete on public.patient_doctors to authenticated;
create policy connection_read on public.patient_doctors for select to authenticated
 using ((select auth.uid()) = patient_id or (
 (select auth.jwt()->'app_metadata'->>'role') = 'doctor'
 and lower(doctor_email) = lower((select auth.jwt()->>'email')) and status = 'active'));
create policy connection_insert on public.patient_doctors for insert to authenticated with check ((select auth.uid()) = patient_id);
create policy connection_update on public.patient_doctors for update to authenticated using ((select auth.uid()) = patient_id) with check ((select auth.uid()) = patient_id);
create policy connection_delete on public.patient_doctors for delete to authenticated using ((select auth.uid()) = patient_id);

alter table public.patients enable row level security;
revoke all on public.patients from anon;
grant select, insert, update, delete on public.patients to authenticated;
create policy patients_read on public.patients for select to authenticated using (((select auth.uid()) = patients.id) or ((select auth.jwt()->'app_metadata'->>'role') = 'doctor' and exists (select 1 from public.patient_doctors pd where pd.patient_id = patients.id and pd.status = 'active' and lower(pd.doctor_email) = lower((select auth.jwt()->>'email')))));
create policy patients_insert on public.patients for insert to authenticated  with check (((select auth.uid()) = patients.id));
create policy patients_update on public.patients for update to authenticated using (((select auth.uid()) = patients.id)) with check (((select auth.uid()) = patients.id));
create policy patients_delete on public.patients for delete to authenticated using (((select auth.uid()) = patients.id)) ;

alter table public.messages enable row level security;
revoke all on public.messages from anon;
grant select, insert, update, delete on public.messages to authenticated;
create policy messages_read on public.messages for select to authenticated using (((select auth.uid()) = messages.patient_id) or ((select auth.jwt()->'app_metadata'->>'role') = 'doctor' and exists (select 1 from public.patient_doctors pd where pd.patient_id = messages.patient_id and pd.status = 'active' and lower(pd.doctor_email) = lower((select auth.jwt()->>'email')))));
create policy messages_insert on public.messages for insert to authenticated with check ((((select auth.uid()) = messages.patient_id) and role in ('patient','ai') and coalesce(metadata->>'type','') <> 'doctor_review_card') or (((select auth.jwt()->'app_metadata'->>'role') = 'doctor' and exists (select 1 from public.patient_doctors pd where pd.patient_id = messages.patient_id and pd.status = 'active' and lower(pd.doctor_email) = lower((select auth.jwt()->>'email')))) and role in ('doctor','ai')));

alter table public.memory_snapshots enable row level security;
revoke all on public.memory_snapshots from anon;
grant select, insert, update, delete on public.memory_snapshots to authenticated;
create policy memory_snapshots_read on public.memory_snapshots for select to authenticated using (((select auth.uid()) = memory_snapshots.patient_id) or ((select auth.jwt()->'app_metadata'->>'role') = 'doctor' and exists (select 1 from public.patient_doctors pd where pd.patient_id = memory_snapshots.patient_id and pd.status = 'active' and lower(pd.doctor_email) = lower((select auth.jwt()->>'email')))));
create policy memory_snapshots_insert on public.memory_snapshots for insert to authenticated  with check (((select auth.uid()) = memory_snapshots.patient_id));
create policy memory_snapshots_update on public.memory_snapshots for update to authenticated using (((select auth.uid()) = memory_snapshots.patient_id)) with check (((select auth.uid()) = memory_snapshots.patient_id));
create policy memory_snapshots_delete on public.memory_snapshots for delete to authenticated using (((select auth.uid()) = memory_snapshots.patient_id)) ;

alter table public.review_queue enable row level security;
revoke all on public.review_queue from anon;
grant select, insert, update, delete on public.review_queue to authenticated;
create policy review_queue_read on public.review_queue for select to authenticated using (((select auth.uid()) = review_queue.patient_id) or ((select auth.jwt()->'app_metadata'->>'role') = 'doctor' and exists (select 1 from public.patient_doctors pd where pd.patient_id = review_queue.patient_id and pd.status = 'active' and lower(pd.doctor_email) = lower((select auth.jwt()->>'email')))));
create policy review_queue_insert on public.review_queue for insert to authenticated with check (((select auth.uid()) = review_queue.patient_id));
create policy review_queue_update on public.review_queue for update to authenticated using (((select auth.jwt()->'app_metadata'->>'role') = 'doctor' and exists (select 1 from public.patient_doctors pd where pd.patient_id = review_queue.patient_id and pd.status = 'active' and lower(pd.doctor_email) = lower((select auth.jwt()->>'email'))))) with check (((select auth.jwt()->'app_metadata'->>'role') = 'doctor' and exists (select 1 from public.patient_doctors pd where pd.patient_id = review_queue.patient_id and pd.status = 'active' and lower(pd.doctor_email) = lower((select auth.jwt()->>'email')))));

alter table public.medications enable row level security;
revoke all on public.medications from anon;
grant select, insert, update, delete on public.medications to authenticated;
create policy medications_read on public.medications for select to authenticated using (((select auth.uid()) = medications.patient_id) or ((select auth.jwt()->'app_metadata'->>'role') = 'doctor' and exists (select 1 from public.patient_doctors pd where pd.patient_id = medications.patient_id and pd.status = 'active' and lower(pd.doctor_email) = lower((select auth.jwt()->>'email')))));
create policy medications_insert on public.medications for insert to authenticated  with check (((select auth.uid()) = medications.patient_id));
create policy medications_update on public.medications for update to authenticated using (((select auth.uid()) = medications.patient_id)) with check (((select auth.uid()) = medications.patient_id));
create policy medications_delete on public.medications for delete to authenticated using (((select auth.uid()) = medications.patient_id)) ;

alter table public.doctor_reports enable row level security;
revoke all on public.doctor_reports from anon;
grant select, insert, update, delete on public.doctor_reports to authenticated;
create policy doctor_reports_read on public.doctor_reports for select to authenticated using (((select auth.uid()) = doctor_reports.patient_id) or ((select auth.jwt()->'app_metadata'->>'role') = 'doctor' and exists (select 1 from public.patient_doctors pd where pd.patient_id = doctor_reports.patient_id and pd.status = 'active' and lower(pd.doctor_email) = lower((select auth.jwt()->>'email')))));
create policy doctor_reports_insert on public.doctor_reports for insert to authenticated with check (((select auth.uid()) = doctor_reports.patient_id));
create policy doctor_reports_update on public.doctor_reports for update to authenticated using (((select auth.jwt()->'app_metadata'->>'role') = 'doctor' and exists (select 1 from public.patient_doctors pd where pd.patient_id = doctor_reports.patient_id and pd.status = 'active' and lower(pd.doctor_email) = lower((select auth.jwt()->>'email'))))) with check (((select auth.jwt()->'app_metadata'->>'role') = 'doctor' and exists (select 1 from public.patient_doctors pd where pd.patient_id = doctor_reports.patient_id and pd.status = 'active' and lower(pd.doctor_email) = lower((select auth.jwt()->>'email')))));

alter table public.consultations enable row level security;
revoke all on public.consultations from anon;
grant select, insert, update, delete on public.consultations to authenticated;
create policy consultations_read on public.consultations for select to authenticated using (((select auth.uid()) = consultations.patient_id) or ((select auth.jwt()->'app_metadata'->>'role') = 'doctor' and exists (select 1 from public.patient_doctors pd where pd.patient_id = consultations.patient_id and pd.status = 'active' and lower(pd.doctor_email) = lower((select auth.jwt()->>'email')))));
create policy consultations_insert on public.consultations for insert to authenticated with check (((select auth.jwt()->'app_metadata'->>'role') = 'doctor' and exists (select 1 from public.patient_doctors pd where pd.patient_id = consultations.patient_id and pd.status = 'active' and lower(pd.doctor_email) = lower((select auth.jwt()->>'email')))));
create policy consultations_update on public.consultations for update to authenticated using (((select auth.jwt()->'app_metadata'->>'role') = 'doctor' and exists (select 1 from public.patient_doctors pd where pd.patient_id = consultations.patient_id and pd.status = 'active' and lower(pd.doctor_email) = lower((select auth.jwt()->>'email'))))) with check (((select auth.jwt()->'app_metadata'->>'role') = 'doctor' and exists (select 1 from public.patient_doctors pd where pd.patient_id = consultations.patient_id and pd.status = 'active' and lower(pd.doctor_email) = lower((select auth.jwt()->>'email')))));

alter table public.consultation_messages enable row level security;
revoke all on public.consultation_messages from anon;
grant select, insert, update, delete on public.consultation_messages to authenticated;
create policy consultation_messages_read on public.consultation_messages for select to authenticated using (((select auth.uid()) = consultation_messages.patient_id) or ((select auth.jwt()->'app_metadata'->>'role') = 'doctor' and exists (select 1 from public.patient_doctors pd where pd.patient_id = consultation_messages.patient_id and pd.status = 'active' and lower(pd.doctor_email) = lower((select auth.jwt()->>'email')))));
create policy consultation_messages_insert on public.consultation_messages for insert to authenticated with check (((((select auth.uid()) = consultation_messages.patient_id) and role = 'patient') or (((select auth.jwt()->'app_metadata'->>'role') = 'doctor' and exists (select 1 from public.patient_doctors pd where pd.patient_id = consultation_messages.patient_id and pd.status = 'active' and lower(pd.doctor_email) = lower((select auth.jwt()->>'email')))) and role = 'doctor')) and exists (select 1 from public.consultations c where c.id = consultation_messages.consultation_id and c.patient_id = consultation_messages.patient_id and c.status = 'active'));
