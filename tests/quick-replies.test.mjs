import test from "node:test";
import assert from "node:assert/strict";
import { quickRepliesFor } from "../src/lib/quick-replies.ts";

test("shortcuts match onset, duration, severity and a simple yes/no question", () => {
  assert.deepEqual(quickRepliesFor("When did the headache start?"), [
    "Today",
    "Yesterday",
    "A few days ago",
    "Not sure",
  ]);
  assert.deepEqual(quickRepliesFor("How long have you felt tired?"), [
    "Less than a day",
    "1–3 days",
    "More than 3 days",
    "Not sure",
  ]);
  assert.deepEqual(quickRepliesFor("How severe is the pain?"), [
    "Mild",
    "Moderate",
    "Severe",
    "Not sure",
  ]);
  assert.deepEqual(quickRepliesFor("Do you have a fever?"), ["Yes", "No", "Not sure"]);
});

test("ambiguous, numeric-scale and multiple questions do not suggest misleading answers", () => {
  for (const q of [
    undefined,
    "",
    "Is it sharp or dull?",
    "Do you have nausea and fever?",
    "Do you have fever, vomiting?",
    "When did it start? Do you have fever?",
    "Where does it hurt?",
    "Rate your pain on a scale of 1 to 10?",
  ]) {
    assert.deepEqual(quickRepliesFor(q), []);
  }
});

test("offers activity-impact answers for a single focused question", () => {
  assert.deepEqual(quickRepliesFor("How much is this affecting your usual activities?"),
    ["Not much", "Slowing me down", "Can’t do them", "Not sure"]);
  assert.deepEqual(quickRepliesFor("How much is this affecting your activities? Do you have fever?"), []);
});
