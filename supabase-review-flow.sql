-- Apply after supabase-curable-schema.sql and supabase-auth-policies.sql.
alter table public.review_queue add column if not exists confirmed_at timestamptz;
alter table public.review_queue drop constraint if exists review_queue_status_check;
alter table public.review_queue add constraint review_queue_status_check check (status in ('pending','approved','corrected','escalated','reviewed','consultation_started'));
drop policy if exists review_requires_confirmation on public.review_queue;
create policy review_requires_confirmation on public.review_queue as restrictive for insert to authenticated with check (confirmed_at is not null);


create or replace function public.accept_student_review(review_id_input uuid, doctor_note text default '') returns uuid
language plpgsql security invoker set search_path = '' as $$
declare request_row public.review_queue%rowtype; consultation_id uuid; report_id_value uuid; doctor_display text;
begin
 if coalesce(auth.jwt()->'app_metadata'->>'role','') <> 'doctor' then raise exception 'An approved doctor account is required'; end if;
 select * into request_row from public.review_queue where id=review_id_input for update;
 if not found or request_row.confirmed_at is null then raise exception 'No confirmed review request is available'; end if;
 select id into consultation_id from public.consultations where review_id=review_id_input and status='active' order by started_at desc limit 1;
 if consultation_id is not null then return consultation_id; end if;
 if request_row.status <> 'pending' then raise exception 'This request is no longer pending'; end if;
 select id into report_id_value from public.doctor_reports where review_id=review_id_input order by created_at desc limit 1;
 select doctor_name into doctor_display from public.patient_doctors where patient_id=request_row.patient_id and status='active';
 insert into public.consultations(review_id,report_id,patient_id,doctor_name,status) values(review_id_input,report_id_value,request_row.patient_id,coalesce(doctor_display,'Doctor'),'active') returning id into consultation_id;
 insert into public.consultation_messages(consultation_id,patient_id,role,content) values(consultation_id,request_row.patient_id,'doctor','I have accepted your review request. '||coalesce(nullif(btrim(doctor_note),''),'What would you like to discuss first?'));
 update public.review_queue set status='consultation_started' where id=review_id_input;
 update public.doctor_reports set status='consultation_started' where review_id=review_id_input;
 insert into public.messages(patient_id,role,content,metadata) values(request_row.patient_id,'doctor','Your doctor accepted your request. Continue in your separate consultation.',jsonb_build_object('type','doctor_review_card','outcome','consultation_started','reviewId',review_id_input,'consultationId',consultation_id,'doctorName',doctor_display,'title','Your doctor accepted your request','actionLabel','Enter consultation'));
 return consultation_id;
end; $$;
revoke all on function public.accept_student_review(uuid,text) from public,anon;
grant execute on function public.accept_student_review(uuid,text) to authenticated;
create policy patients_confirmed_sharing on public.patients as restrictive for select to authenticated using ((select auth.uid())=id or exists (select 1 from public.review_queue rq where rq.patient_id=patients.id and rq.confirmed_at is not null));
create policy memory_snapshots_confirmed_sharing on public.memory_snapshots as restrictive for select to authenticated using ((select auth.uid())=patient_id or exists (select 1 from public.review_queue rq where rq.patient_id=memory_snapshots.patient_id and rq.confirmed_at is not null));
create policy medications_confirmed_sharing on public.medications as restrictive for select to authenticated using ((select auth.uid())=patient_id or exists (select 1 from public.review_queue rq where rq.patient_id=medications.patient_id and rq.confirmed_at is not null));
create policy messages_confirmed_sharing on public.messages as restrictive for select to authenticated using ((select auth.uid())=patient_id or exists (select 1 from public.review_queue rq where rq.patient_id=messages.patient_id and rq.confirmed_at is not null));

