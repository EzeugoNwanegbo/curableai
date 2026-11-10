-- Run as the database owner in the Supabase SQL editor. All fixtures are rolled back.
begin;
insert into public.patients(id, full_name, age, sex) values
 ('00000000-0000-4000-a000-000000000001','Auth test A',30,'female'),
 ('00000000-0000-4000-a000-000000000002','Auth test B',31,'male');
insert into public.patient_doctors(patient_id,doctor_name,doctor_email)
 values ('00000000-0000-4000-a000-000000000001','Test doctor','auth-doctor@example.invalid');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-a000-000000000001","role":"authenticated","email":"auth-patient@example.invalid","app_metadata":{},"user_metadata":{"role":"doctor"}}',true);
do $$ begin
 if (select count(*) from public.patients where id in ('00000000-0000-4000-a000-000000000001','00000000-0000-4000-a000-000000000002')) <> 1 then raise exception 'Patient isolation failed'; end if;
 begin
  insert into public.medications(patient_id,name) values ('00000000-0000-4000-a000-000000000002','Forbidden');
  raise exception 'Cross-patient insert unexpectedly allowed';
 exception when insufficient_privilege then null; end;
 begin
  insert into public.messages(patient_id,role,content) values ('00000000-0000-4000-a000-000000000001','doctor','Forged');
  raise exception 'Doctor impersonation unexpectedly allowed';
 exception when insufficient_privilege then null; end;
 begin
  insert into public.messages(patient_id,role,content,metadata) values ('00000000-0000-4000-a000-000000000001','ai','Forged review','{"type":"doctor_review_card"}');
  raise exception 'Doctor review metadata impersonation unexpectedly allowed';
 exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-a000-000000000003","role":"authenticated","email":"auth-doctor@example.invalid","app_metadata":{"role":"doctor"}}',true);
do $$ begin
 if (select count(*) from public.patients where id in ('00000000-0000-4000-a000-000000000001','00000000-0000-4000-a000-000000000002')) <> 1 then raise exception 'Assigned doctor isolation failed'; end if;
end $$;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-a000-000000000004","role":"authenticated","email":"unassigned@example.invalid","app_metadata":{"role":"doctor"}}',true);
do $$ begin
 if exists(select 1 from public.patients where id in ('00000000-0000-4000-a000-000000000001','00000000-0000-4000-a000-000000000002')) then raise exception 'Unassigned doctor access allowed'; end if;
end $$;
select 'PASS: patient isolation, cross-patient writes denied, doctor role and review spoofing denied, assigned doctor isolation, unassigned doctor denied' as result;
rollback;
