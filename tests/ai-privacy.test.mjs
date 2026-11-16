import test from "node:test";
import assert from "node:assert/strict";
import {
  createPrivacyFilter,
  isIdentityMemory,
  memoryIdentityHints,
} from "../src/lib/ai-privacy.ts";
import { requestPrivateCompletion, logAiFailure } from "../src/lib/ai-provider.ts";

const hints = {
  names: ["Amara Okafor", "Dr. Ada Bello", "José O’Neil"],
  identifiers: ["amara@fictional.invalid", "08031234567", "a1bc0000-1111-4111-8111-123456789abc"],
  locations: ["Veritas fictional clinic", "12 College Road"],
};

test("known patient and doctor identities are removed despite case, spacing and formatting", () => {
  const result = createPrivacyFilter(hints).text(
    "AMARA\nOKAFOR and Am\u200bara met Dr. Ada Bello at Veritas fictional clinic. José O’Neil joined.",
  );
  for (const word of ["Amara", "Okafor", "Ada", "Bello", "Veritas", "José", "Neil"])
    assert.doesNotMatch(result, new RegExp(word, "i"));
});

test("new self-introductions and titled people are filtered without erasing symptoms", () => {
  const result = createPrivacyFilter().text(
    "My name is Chisom Eze and I have chest pain. Dr. Amina Yusuf saw me yesterday.",
  );
  assert.doesNotMatch(result, /Chisom|Eze|Amina|Yusuf/);
  assert.match(result, /chest pain/);
  assert.match(result, /yesterday/);
});

test("curly-apostrophe introductions and standalone name fields are filtered", () => {
  const result = createPrivacyFilter().text(
    "I’m Chisom Eze and I feel sick.\nName: Amina Yusuf\nI am feeling tired.",
  );
  assert.doesNotMatch(result, /Chisom|Eze|Amina|Yusuf/);
  assert.match(result, /feel sick/);
  assert.match(result, /I am feeling tired/);
});

test("an ambiguous name does not erase the modal may or change clinical uncertainty", () => {
  const result = createPrivacyFilter({ names: ["May Brown"] }).text("May Brown may have a fever.");
  assert.doesNotMatch(result, /May|Brown/);
  assert.match(result, /may have a fever/);
});

test("contacts, student numbers, birth dates, URLs, addresses and UUIDs are removed", () => {
  const result = createPrivacyFilter(hints).text(
    "Email: amara@fictional.invalid\nCall +234 803 123 4567. Student number: VU12345. DOB: 2004-03-19. I live at 12 College Road; pulse 82. https://clinic.invalid/records/secret\nRecord: FICTIONAL-VERITAS-001\na1bc0000-1111-4111-8111-123456789abc",
  );
  for (const value of [
    "amara@",
    "234",
    "4567",
    "VU12345",
    "2004-03-19",
    "College",
    "clinic.invalid",
    "VERITAS",
    "a1bc0000",
  ])
    assert.ok(!result.includes(value), value);
  assert.match(result, /pulse 82/);
});

test("medication, allergy, lab, clinical date and symptom details survive", () => {
  const original =
    "20y, female. Penicillin allergy. Salbutamol inhaler, 100 mcg. Paracetamol 500 mg, twice daily. Hb 13.2 g/dL on 2026-10-12. Headache for 3 days. Temperature 38.4 C. BP 120/80. Avoid kola nut.";
  assert.equal(createPrivacyFilter(hints).text(original), original);
});

test("identity-only memories are excluded and their values protect other text", () => {
  const rows = [
    { label: "Location", details: "14 Campus Road" },
    { label: "Supervising doctor", details: "Doctor: Ada Bello\nEmail: ada@fictional.invalid" },
  ];
  assert.ok(rows.every((r) => isIdentityMemory(r.label)));
  assert.equal(isIdentityMemory("Asthma review"), false);
  const p = createPrivacyFilter(memoryIdentityHints(rows));
  assert.doesNotMatch(p.text("Seen by Ada Bello near 14 Campus Road"), /Ada|Bello|Campus/);
});

test("filter state belongs to one request and never carries another patient's names", () => {
  assert.doesNotMatch(
    createPrivacyFilter({ names: ["Aisha Ibrahim"] }).text("Aisha Ibrahim"),
    /Aisha/,
  );
  assert.equal(
    createPrivacyFilter({ names: ["Amara Okafor"] }).text("Aisha Ibrahim"),
    "Aisha Ibrahim",
  );
});

test("provider boundary strips extra message properties and disables stored completions", async () => {
  let body;
  const client = {
    chat: {
      completions: {
        create: async (request) => {
          body = request;
          return { choices: [{ message: { content: "Amara, when did the headache start?" } }] };
        },
      },
    },
  };
  const original = [
    {
      role: "user",
      content: "Amara Okafor has asthma",
      name: "Amara",
      user: "account-id",
      metadata: hints,
    },
  ];
  const response = await requestPrivateCompletion(
    client,
    "test-model",
    original,
    createPrivacyFilter(hints),
  );
  assert.equal(body.store, false);
  assert.equal(body.stream, false);
  assert.deepEqual(Object.keys(body).sort(), ["messages", "model", "store", "stream"]);
  assert.ok(body.messages.every((m) => Object.keys(m).sort().join() === "content,role"));
  assert.doesNotMatch(JSON.stringify(body), /Amara|Okafor|account-id|fictional.invalid/);
  assert.match(JSON.stringify(body), /asthma/);
  assert.doesNotMatch(response, /Amara/);
  assert.equal(original[0].content, "Amara Okafor has asthma");
});

test("unsupported content fails closed before any provider is called", async () => {
  let calls = 0;
  const client = {
    chat: {
      completions: {
        create: async () => {
          calls++;
        },
      },
    },
  };
  await assert.rejects(
    requestPrivateCompletion(
      client,
      "test-model",
      [{ role: "user", content: [{ type: "image_url", image_url: { url: "private" } }] }],
      createPrivacyFilter(),
    ),
    /blocked/,
  );
  assert.equal(calls, 0);
});

test("provider failures log a safe category rather than raw errors or request content", () => {
  const before = console.warn;
  const events = [];
  console.warn = (...args) => events.push(args);
  try {
    logAiFailure("openai", "chat");
  } finally {
    console.warn = before;
  }
  assert.deepEqual(events, [
    ["AI provider unavailable", { provider: "openai", operation: "chat" }],
  ]);
});
