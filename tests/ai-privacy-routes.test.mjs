import test from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import { pathToFileURL } from "node:url";

// Execute the real two server handlers with local DB/provider doubles. No credentials or network.
const work = await mkdtemp(join(tmpdir(), "curable-privacy-routes-"));
const output = join(work, "chat.mjs");
const root = resolve(import.meta.dirname, "..");
const stubs = {
  "@tanstack/react-start": `export const createServerFn=()=>({inputValidator(){return this},handler(fn){return fn}});`,
  "@/api/doctor-connection": `export const readDoctorConnection=async()=>globalThis.__privacyFixture.doctor;`,
  "@/api/medications": `export const fetchMedicationsForPatient=async()=>globalThis.__privacyFixture.medicines;`,
  "@/lib/supabase-server": `export const getAuthenticatedClient=async()=>globalThis.__privacyFixture.client;`,
  openai: `export class OpenAI { constructor(options){this.chat={completions:{create:async(body)=>globalThis.__privacyFixture.complete(body,options.baseURL?'deepseek':'openai')}}} }`,
};
await build({
  entryPoints: [resolve(root, "src/api/chat.ts")],
  outfile: output,
  bundle: true,
  platform: "node",
  format: "esm",
  plugins: [
    {
      name: "local-fixtures",
      setup(b) {
        b.onResolve({ filter: /^(?:@tanstack\/react-start|@\/|openai$)/ }, ({ path }) => {
          if (stubs[path]) return { path, namespace: "privacy-test" };
          if (path.startsWith("@/")) return { path: resolve(root, "src", path.slice(2) + ".ts") };
        });
        b.onLoad({ filter: /.*/, namespace: "privacy-test" }, ({ path }) => ({
          contents: stubs[path],
          loader: "js",
        }));
      },
    },
  ],
});
const { sendMessage, createDoctorReviewReport } = await import(pathToFileURL(output).href);

const patientId = "a1bc0000-1111-4111-8111-123456789abc";
const patient = {
  id: patientId,
  full_name: "Amara Okafor",
  age: 20,
  sex: "female",
  conditions: ["asthma"],
  allergies: ["Penicillin"],
  pinned_by_doctor: "Dr. Ada Bello says avoid kola nut. Contact 08031234567.",
};
const memories = [
  { label: "Location", details: "12 College Road", layer: 1 },
  {
    label: "Supervising doctor",
    details: "Doctor: Ada Bello\nEmail: ada@fictional.invalid",
    layer: 1,
  },
  {
    label: "Previous concern",
    details: "Amara Okafor had a headache for 3 days. Student number: VU12345",
    layer: 3,
  },
];

function fixture(failures = []) {
  const state = {
    requests: [],
    writes: [],
    failures,
    doctor: {
      doctorName: "Dr. Ada Bello",
      doctorEmail: "ada@fictional.invalid",
      clinicName: "Fictional Clinic",
    },
    medicines: [
      {
        name: "Salbutamol",
        dosage: "100 mcg",
        frequency: "as prescribed",
        time: "",
        purpose: "asthma",
        source: "hospital",
        adherence: 1,
        prescriber: "Ada Bello",
        sideEffects: [],
      },
    ],
    complete: async (body, provider) => {
      state.requests.push({ provider, body });
      if (failures.includes(provider))
        throw new Error("DO NOT LOG Amara Okafor amara@fictional.invalid secret-key request body");
      const report = body.messages.some((m) =>
        m.content.includes("Create a concise doctor handoff"),
      );
      return {
        choices: [
          {
            message: {
              content: report
                ? JSON.stringify({
                    summary: "Headache for 3 days",
                    doctorQuestion: "Please review",
                    risk: "low",
                  })
                : "When did the headache start?",
            },
          },
        ],
      };
    },
  };
  state.client = {
    auth: {
      getUser: async () => ({
        data: {
          user: {
            id: patientId,
            email: "amara@fictional.invalid",
            phone: "08031234567",
            user_metadata: { full_name: "Amara Okafor" },
          },
        },
        error: null,
      }),
    },
    from(table) {
      let inserted;
      const result = () => ({
        data: inserted
          ? { id: "saved-message", ...inserted }
          : table === "patients"
            ? patient
            : table === "memory_snapshots"
              ? memories
              : [
                  {
                    role: "patient",
                    content: "Amara Okafor has a headache. Email amara@fictional.invalid",
                    metadata: {
                      reasoning: {
                        concernSummary: "Amara Okafor has asthma",
                        conditions: [{ name: "More information needed", score: 20 }],
                      },
                    },
                  },
                ],
        error: null,
      });
      const q = {
        select() {
          return this;
        },
        eq() {
          return this;
        },
        order() {
          return this;
        },
        limit() {
          return this;
        },
        contains() {
          return this;
        },
        ilike() {
          return this;
        },
        insert(value) {
          inserted = value;
          state.writes.push({ table, value });
          return this;
        },
        update() {
          return this;
        },
        single: async () => result(),
        maybeSingle: async () => ({ data: null, error: null }),
        then(resolve) {
          return Promise.resolve(result()).then(resolve);
        },
      };
      return q;
    },
  };
  return state;
}

for (const operation of ["chat", "report"]) {
  for (const failures of [[], ["openai"], ["openai", "deepseek"]]) {
    test(`${operation}: protected requests survive provider ${failures.length ? "failure " + failures.join("+") : "success"}`, async () => {
      const state = fixture(failures);
      globalThis.__privacyFixture = state;
      const oldDeepseek = process.env.DEEPSEEK_API_KEY;
      const oldWarn = console.warn;
      const logs = [];
      process.env.DEEPSEEK_API_KEY = "fictional-test-key";
      console.warn = (...args) => logs.push(args);
      try {
        if (operation === "chat")
          await sendMessage({
            data: {
              patientId,
              conversationId: "private-thread-id",
              message:
                "I am Amara Okafor. My headache lasted 3 days. Student number VU12345. Call 08031234567.",
            },
          });
        else
          await createDoctorReviewReport({
            data: { patientId, reason: "Amara Okafor wants review. Email amara@fictional.invalid" },
          });
        assert.equal(state.requests.length, failures.length ? 2 : 1);
        for (const { body } of state.requests) {
          const sent = JSON.stringify(body);
          const leaked = sent.match(
            /\b(?:Amara|Okafor|Ada|Bello|VU12345|08031234567|College|a1bc0000)\b|amara@|ada@|private-thread-id|Fictional Clinic/i,
          );
          assert.equal(
            Boolean(leaked),
            false,
            `An identity fixture reached the provider: ${leaked?.[0] || "none"}`,
          );
          assert.match(sent, /asthma/);
          assert.match(sent, /Penicillin/);
          assert.match(sent, /Salbutamol/);
          assert.match(sent, /100 mcg/);
          assert.match(sent, /headache/);
          assert.match(sent, /3 days/);
          assert.match(sent, /avoid kola nut/);
          assert.equal(body.store, false);
        }
        assert.doesNotMatch(
          JSON.stringify(logs),
          /Amara|secret-key|fictional.invalid|request body/,
        );
        if (operation === "chat") {
          // The original stays in the authorized account. Only the outbound copy is filtered.
          assert.match(
            state.writes.find((w) => w.table === "messages" && w.value.role === "patient").value
              .content,
            /Amara Okafor/,
          );
          assert.equal(
            state.writes.find((w) => w.value.role === "ai").value.metadata.privacy
              .externalRequestsFiltered,
            true,
          );
        }
      } finally {
        console.warn = oldWarn;
        if (oldDeepseek === undefined) delete process.env.DEEPSEEK_API_KEY;
        else process.env.DEEPSEEK_API_KEY = oldDeepseek;
        delete globalThis.__privacyFixture;
      }
    });
  }
}

test.after(async () => {
  await rm(work, { recursive: true, force: true });
});
