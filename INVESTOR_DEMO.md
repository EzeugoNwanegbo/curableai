# Curable investor walkthrough

Use Node.js 22.16 or newer. Run `npm ci`, then `npm run dev`. The server loads `.env.local`; this file is ignored by Git and contains the locally approved OpenAI key and public Supabase configuration. Never put the OpenAI key in a `VITE_` variable.

The public homepage offers the fictional, scripted demo. **Sign in to Curable** opens the connected application. Student accounts use Supabase authentication and saved conversations; approved doctor accounts use a separate review workspace.

1. Sign in as a student and open **Health records**.
2. Choose **Add fictional clinic record**. The sample is stored as a labelled memory entry, separate from the student's actual profile. Repeating the import updates that entry rather than duplicating it. It can be removed using the profile's existing memory controls.
3. Open **Ask Curable**. The server retrieves saved context and uses OpenAI. Sample entries explicitly identify themselves as fictional and must not be treated as verified clinical facts.
4. In **Doctor conversations**, enter the approved doctor's exact sign-in email. There is no live doctor directory or university partnership connection.
5. Return to the conversation and request a review. Edit the summary and what you want help with, then confirm sharing the summary and available history. The database rejects unconfirmed requests.
6. The assigned, approved doctor signs in separately and accepts the request. Acceptance opens the corresponding consultation and saves a welcome message and notification together. Repeating acceptance reopens the existing active consultation.
7. Both accounts can exchange saved consultation messages. The available patient history is included in the consultation context. Conversations refresh periodically.

Doctors require trusted administrator approval through `app_metadata.role`, as described in AUTH_SETUP.md. A student cannot grant doctor privileges by changing their profile.

No real Veritas EMR is connected. The `ClinicRecord` type provides a consistent shape for a future authenticated EMR adapter; no API endpoint is claimed to exist. The live feature uses the active `curable1` Supabase project.

## Verification

`npm run typecheck` and `npm run build` check the application. `tests/review-flow.sql` exercises confirmation enforcement, atomic and repeated doctor acceptance, message persistence and cross-student isolation inside a rolled-back database transaction. `supabase-review-flow.sql` records the additional schema and access changes already applied to the connected project.

Live OpenAI authentication and a minimal generated response were verified. Full sign-in, email confirmation, Google OAuth and the complete two-account browser walkthrough still require user-controlled student and approved doctor accounts.
