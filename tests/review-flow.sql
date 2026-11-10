begin;
set local role authenticated;
select set_config('request.jwt.claims',json_build_object('sub','11111111-1111-4111-8111-111111111111','email','student-fixture@example.invalid','role','authenticated','app_metadata',json_build_object('role','patient'))::text,true);
insert into public.patients(id,full_name) values('11111111-1111-4111-8111-111111111111','Fictional integration test');
insert into public.patient_doctors(patient_id,doctor_name,doctor_email) values('11111111-1111-4111-8111-111111111111','Test clinician','doctor-fixture@example.invalid');
insert into public.review_queue(id,patient_id,summary,risk_level,status,confirmed_at) values('22222222-2222-4222-8222-222222222222','11111111-1111-4111-8111-111111111111','Fictional test summary','low','pending',now());
insert into public.doctor_reports(review_id,patient_id,summary,doctor_question) values('22222222-2222-4222-8222-222222222222','11111111-1111-4111-8111-111111111111','Fictional test summary','Test review');
do $$begin
 begin
 insert into public.review_queue(patient_id,summary,risk_level,status) values('11111111-1111-4111-8111-111111111111','Unconfirmed test','low','pending');
 raise exception 'Unconfirmed request was incorrectly allowed';
 exception when insufficient_privilege then null;
 end;
end$$;
select set_config('request.jwt.claims',json_build_object('sub','33333333-3333-4333-8333-333333333333','email','doctor-fixture@example.invalid','role','authenticated','app_metadata',json_build_object('role','doctor'))::text,true);
select public.accept_student_review('22222222-2222-4222-8222-222222222222','Fictional integration test') is not null as acceptance_succeeded;
select public.accept_student_review('22222222-2222-4222-8222-222222222222','Retry test') is not null as retry_succeeded;
do $$begin if (select count(*) from public.consultations where review_id='22222222-2222-4222-8222-222222222222')<>1 then raise exception 'Acceptance retry created duplicate consultations';end if;end$$;
do $$begin if (select count(*) from public.consultation_messages where patient_id='11111111-1111-4111-8111-111111111111')<>1 then raise exception 'Welcome message was not saved exactly once';end if;end$$;
select set_config('request.jwt.claims',json_build_object('sub','44444444-4444-4444-8444-444444444444','email','stranger-fixture@example.invalid','role','authenticated','app_metadata',json_build_object('role','patient'))::text,true);
select count(*)=0 as other_student_cannot_read from public.consultations where patient_id='11111111-1111-4111-8111-111111111111';
rollback;
