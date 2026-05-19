-- Curable MVP schema extension.
-- Run this in Supabase SQL Editor after the existing patients/messages/memory_snapshots/review_queue tables exist.

create table if not exists public.medications (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  name text not null,
  dosage text not null default '',
  frequency text not null default '',
  time text not null default '',
  purpose text not null default '',
  source text not null default 'patient' check (source in ('hospital', 'patient')),
  side_effects text[] not null default '{}',
  adherence numeric not null default 1 check (adherence >= 0 and adherence <= 1),
  prescriber text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.patient_doctors (
  patient_id uuid primary key references public.patients(id) on delete cascade,
  doctor_name text not null,
  doctor_email text not null default '',
  clinic_name text not null default '',
  status text not null default 'active' check (status in ('active', 'removed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.doctor_reports (
  id uuid primary key default gen_random_uuid(),
  review_id uuid references public.review_queue(id) on delete set null,
  patient_id uuid not null references public.patients(id) on delete cascade,
  summary text not null,
  risk_level text not null default 'moderate',
  doctor_question text not null,
  patient_context jsonb not null default '[]',
  medication_context jsonb not null default '[]',
  memory_context jsonb not null default '[]',
  recent_conversation jsonb not null default '[]',
  ai_safety_note text,
  status text not null default 'sent',
  created_at timestamptz not null default now()
);

create table if not exists public.consultations (
  id uuid primary key default gen_random_uuid(),
  review_id uuid references public.review_queue(id) on delete set null,
  report_id uuid references public.doctor_reports(id) on delete set null,
  patient_id uuid not null references public.patients(id) on delete cascade,
  doctor_name text not null default 'Doctor',
  status text not null default 'active' check (status in ('waiting', 'active', 'closed')),
  started_at timestamptz not null default now(),
  closed_at timestamptz
);

create table if not exists public.consultation_messages (
  id uuid primary key default gen_random_uuid(),
  consultation_id uuid not null references public.consultations(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  role text not null check (role in ('doctor', 'patient')),
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists medications_patient_id_idx on public.medications(patient_id);
create index if not exists patient_doctors_doctor_email_idx on public.patient_doctors(doctor_email);
create index if not exists doctor_reports_patient_id_idx on public.doctor_reports(patient_id);
create index if not exists consultations_patient_status_idx on public.consultations(patient_id, status);
create index if not exists consultation_messages_consultation_id_idx on public.consultation_messages(consultation_id, created_at);
