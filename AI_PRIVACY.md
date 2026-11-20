# Curable AI request privacy

The local privacy filter runs at the external model boundary for both student chat and AI-generated doctor summaries. It also protects requests to the optional fallback provider. It does not change the authorized patient or doctor record in Supabase.

## Implemented

- External prompt templates omit the patient's name and the medicine prescriber's identity. Identity-only memories, including supervising doctor and location, are not included in clinical context.
- The server uses the current authenticated account, patient profile, selected doctor and identity memories to filter known names, contacts and identifiers if they recur elsewhere.
- All outbound text is filtered again, including the latest message, recent history, memory text, doctor notes, report requests and reasoning snapshots. Common explicit name introductions, emails, phone numbers, labeled record/student IDs, birth dates, addresses, URLs, UUIDs and token patterns have local rules.
- The gateway forwards text roles/content only. It does not forward account IDs, conversation IDs, author names, auth headers, attachments or arbitrary metadata as model input.
- Both providers go through the same gateway. Unsupported content is rejected before transport. No error path retries an unfiltered request. Provider errors are logged as provider/operation categories without raw request or error objects.
- Completions explicitly use `store: false`. This setting is not a guarantee of zero provider retention or a substitute for reviewing provider agreements and settings. See the [OpenAI API reference](https://developers.openai.com/api/reference/resources/chat/subresources/completions/methods/create).
- The reply is attached to the correct account inside Curable. The external model needs no permanent patient pseudonym or identity mapping. Request filter state is local to the request.

## Boundaries

This is deterministic exposure reduction, not anonymisation, a clinical de-identification certification, or HIPAA/NDPA compliance. Unmarked names, unfamiliar address or identifier formats, encoded text and distinctive combinations of health facts may escape detection. The filter can also remove a clinical phrase that overlaps with a known identity. Review representative local-language and clinic-note examples before clinical use. Do not promise that every possible identifier is removed.

There is no external AI request used to perform redaction. Original messages and identities remain in Curable's existing access-controlled database. Moving the identity register to the hospital, changing hosting region, encryption/key management, residency guarantees, retention/deletion policies and consent workflows are separate work and are not implemented by this filter.

Student-to-doctor messages stay direct and retain their authorized clinical context. If that content is later included in an AI prompt, it must enter through the same gateway. The application currently has no image/document upload path to this gateway; adding one requires its own local redaction and review.

## Independent production launch

Curable is launching independently. People can join directly. The release has no dependency on a school partnership, school email, campus clinic or school medical records. Doctor review is optional. Before offering it to users, recruit and verify participating doctors and agree when they will handle requests.

The previous school pilot specified Nigeria-only processing. Confirm the independent service’s data-location policy before selecting production providers. Document where the app, identity records, clinical records, AI inference, backups and logs are processed, including fallback providers. Verify encryption in transit and at rest, restrict access to keys and identity records, and use fictional cases to inspect which clinical fields reach the model. Keep identifiers outside model inputs and minimize free text.

Once there is enough information for review, offer a short handover. Request doctor opens an editable draft. The student chooses whether to send it. Only report submission or doctor acceptance after the corresponding action succeeds. Urgent guidance takes precedence over waiting for a reply.

## Independent launch assessment — draft for review

Curable decides why and how account-linked symptoms, medicines and chat history are processed. The proposed purposes are personalized AI conversations, longitudinal recall and student-requested doctor reviews. Contact details support authentication. Evaluate a lawful basis for each purpose and a sensitive-data condition for health information. The proposed AI consent is recorded as a version and latest change time in the user's account. Doctor sharing has a separate confirmation step. Review whether additional consent evidence is required.

| Recipient | Processing observed | Evidence still needed |
| --- | --- | --- |
| Vercel | US application functions handle requests | Signed processor terms, locations and retention of logs, subprocessors and transfer basis |
| Supabase | Account and health records in Ireland | Processor terms, backup and support locations, retention, deletion and transfer basis |
| OpenAI | Filtered health context for chat and clinical note generation | Account-specific terms, inference and retention locations, safeguards and transfer basis |
| DeepSeek | Conditional fallback for chat and notes | Verify whether enabled on production and document the same evidence before use |
| Selected doctor | Receives the confirmed handover | Verify identity, restricted access and encounter lifecycle with separate test accounts |

Key risks include identification through free text, inappropriate access to records, inaccurate summaries, and retention after withdrawal. Existing controls include local filtering, authenticated requests and patient review. Residual risk has not been assessed or accepted. Confirm retention periods, encryption and key access, deletion and rights contacts, handling of minors, incident response, actual vendor contracts and the transfer basis for each recipient. The operator must verify and sign off on the factual record, obtain qualified advice on NDPC registration and filing, and complete the filing as applicable. This document is a working assessment, not a filed DPIA.

## Verification

Run `npm run test:privacy` and `node --test tests/quick-replies.test.mjs` with Node 22.22 or later. Privacy tests use fictional data and mocked providers, including both real server handlers, primary/fallback provider failures, clinical detail preservation and local persistence of the original student message. No real clinical data or live API call is needed.

UI cleanup follows [unslop](https://github.com/heydamir/unslop) by Damir Sokolovsky, licensed CC BY 4.0, adapted to the existing Curable purple/pink direction. No skill files or third-party scripts are installed or executed as part of the application.
