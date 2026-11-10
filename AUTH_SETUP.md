# Curable authentication

This checkout is connected to the active **curable1** Supabase project (`zzaqydgtionlzjacgzdu`). Its public URL and publishable key are in the ignored `.env.local` file. No service role key is needed by the app.

Email/password registration, email confirmation, Google sign-in, session restoration and sign-out use Supabase Auth. The landing page and `/auth` are public. Other pages wait for verified identity and account setup; guests return to their requested page after signing in. Patient and doctor areas have separate access checks.

All server functions forward the current access token and verify it with Supabase. Each database client is scoped to that request and obeys row level security. Patients access their own records. An approved doctor accesses only records of patients who assigned that doctor's email in `patient_doctors`. Consultation messages must match their author role, patient and active consultation. Changes to user-editable role metadata do not grant doctor access.

## Deployment

Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in the deployment environment before building. See `.env.example`.

In [Supabase URL Configuration](https://supabase.com/dashboard/project/zzaqydgtionlzjacgzdu/auth/url-configuration), set Site URL to the deployed origin and add its `/auth` URL to the allowed redirects. Add `http://localhost:3000/auth` (or the actual local development port) for local confirmation and Google callback testing. Email and Google providers are already enabled; a real Google login and email confirmation still need to be exercised with a user account and the chosen deployment URL.

## Doctor approval

Doctor signup records a request in `user_metadata.role`; the account remains blocked until approved. An administrator must set `app_metadata.role` to `doctor` through the Supabase Admin API or another trusted admin workflow. Never grant it from the browser or copy every signup request automatically. The doctor should sign out and sign back in after approval so the access token includes the role. Patients must assign the approved doctor's sign-in email before that doctor can see their records.

## Database changes and checks

`supabase-auth-policies.sql` records the policies already applied to curable1. It is a reference for a fresh database, not a script to rerun over existing policies. The database has matching recorded migrations.

Verified: TypeScript checks, production build, guest redirect with return URL, anonymous REST access denied for all nine tables, and rolled-back database tests for patient isolation, denied cross-patient writes, rejected doctor impersonation, assigned doctor access and unassigned doctor denial. No test patient records were retained.

The Supabase security advisor reports no missing RLS policies. Its remaining warning is [leaked-password protection disabled](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection), which can be enabled in project Auth settings.
