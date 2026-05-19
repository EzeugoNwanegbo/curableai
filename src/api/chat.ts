import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { readDoctorConnection } from "@/api/doctor-connection";
import { fetchMedicationsForPatient } from "@/api/medications";
import {
  buildPatientState,
  runDifferentialEngine,
  type DifferentialResult,
} from "@/lib/differential-engine";

const memoryLayerNames: Record<number, string> = {
  1: "Structured health fact",
  2: "Behavior or medication pattern",
  3: "Recent symptom or event",
};

const DEEPSEEK_BASE_URL = "https://api.deepseek.com";
const DEEPSEEK_MODEL = "deepseek-chat";

const structuredFallbackSafetyNote =
  "OpenAI and DeepSeek were both unavailable, so Curable created this structured report from saved profile, medications, memory, and recent messages.";

const conditionLabels = [
  "Strong pattern match",
  "Possible match",
  "Partial match",
  "Weak match",
  "Needs more information",
];

function labelForScore(score: number) {
  if (score >= 76) return "Strong pattern match";
  if (score >= 52) return "Possible match";
  if (score >= 30) return "Partial match";
  return "Needs more information";
}

function normalizeTimeline(value: any) {
  if (!Array.isArray(value)) return [];

  return value
    .slice(0, 6)
    .map((item) => ({
      event: String(item?.event || item?.label || "").slice(0, 140),
      whenText: String(item?.whenText || item?.when || "").slice(0, 90),
      estimatedDate: String(item?.estimatedDate || "").slice(0, 90),
      certainty: ["user_reported", "inferred", "unknown"].includes(item?.certainty)
        ? item.certainty
        : "user_reported",
      source: String(item?.source || "chat_message").slice(0, 80),
    }))
    .filter((item) => item.event);
}

function normalizeUsedContext(value: any) {
  return {
    profile: toStringArray(value?.profile).slice(0, 5),
    medications: toStringArray(value?.medications).slice(0, 5),
    memory: toStringArray(value?.memory).slice(0, 5),
    conversation: toStringArray(value?.conversation).slice(0, 5),
  };
}

function normalizeUncertaintyGaps(value: any) {
  return toStringArray(value)
    .slice(0, 6)
    .map((item) => item.slice(0, 120));
}

function normalizeStewardship(value: any, nextQuestion: string) {
  const allowedActions = [
    "ask_one_question",
    "update_reasoning",
    "suggest_doctor_validation",
    "urgent_care_warning",
    "reassure_and_monitor",
    "wait_for_user",
  ];
  const nextAction = allowedActions.includes(value?.nextAction)
    ? value.nextAction
    : nextQuestion
      ? "ask_one_question"
      : "update_reasoning";

  return {
    nextAction,
    reason: String(value?.reason || "").slice(0, 240),
    shouldOfferDoctorValidation: Boolean(value?.shouldOfferDoctorValidation),
    shouldWarnUrgentCare: Boolean(value?.shouldWarnUrgentCare),
    shouldStopQuestioning: Boolean(value?.shouldStopQuestioning),
  };
}

function normalizeReasoning(value: any) {
  if (!value || typeof value !== "object") return null;

  const rawConditions = Array.isArray(value.possibleConditions)
    ? value.possibleConditions
    : Array.isArray(value.conditions)
      ? value.conditions
      : [];
  const nextQuestion = String(value.nextQuestion || "").slice(0, 180);

  const conditions = rawConditions
    .slice(0, 4)
    .map((condition: any) => {
      const score = Number(condition?.score);
      const normalizedScore = Number.isFinite(score)
        ? Math.min(95, Math.max(5, Math.round(score)))
        : 20;
      const matchLabel = conditionLabels.includes(condition?.matchLabel)
        ? condition.matchLabel
        : labelForScore(normalizedScore);

      return {
        name: String(condition?.name || "Needs more information").slice(0, 80),
        score: normalizedScore,
        matchLabel,
        support: toStringArray(condition?.support || condition?.supports).slice(0, 3),
        weakens: toStringArray(
          condition?.weakens || condition?.challenge || condition?.against,
        ).slice(0, 3),
      };
    })
    .filter((condition: any) => condition.name);

  return {
    readiness:
      value.readiness === "ready" || value.stage === "reasoning_ready" ? "ready" : "collecting",
    stage: value.stage === "reasoning_ready" ? "reasoning_ready" : "collecting",
    concernSummary: String(value.concernSummary || "Building symptom picture.").slice(0, 240),
    timeline: normalizeTimeline(value.timeline),
    nextQuestion,
    uncertaintyGaps: normalizeUncertaintyGaps(
      value.uncertaintyGaps || value.missingInformation || value.unknowns,
    ),
    conditions,
    stewardship: normalizeStewardship(value.stewardship, nextQuestion),
    usedContext: normalizeUsedContext(value.usedContext),
  };
}

function reasoningTag(reasoning: any) {
  return `\n<curable_reasoning>${JSON.stringify(reasoning)}</curable_reasoning>`;
}

function parseReasoning(raw: string) {
  const match = raw.match(/<curable_reasoning>\s*([\s\S]*?)\s*<\/curable_reasoning>/i);
  if (!match) return null;

  try {
    return normalizeReasoning(JSON.parse(match[1]));
  } catch {
    return null;
  }
}

function stripClinicalTags(content: string) {
  return content
    .replace(/\[SIGNAL:\s*(.*?)\s*\|\s*(\d)\s*\|\s*(.*?)\s*\]/g, "")
    .replace(/\[ESCALATE:\s*(.*?)\s*\|\s*(.*?)\s*\|\s*(.*?)\s*\]/g, "")
    .replace(/<curable_reasoning>[\s\S]*?<\/curable_reasoning>/gi, "")
    .replace(/```json/g, "")
    .replace(/```/g, "")
    .trim();
}

function buildEngineTaggedResponse(message: string, patient: any, patientMedications: any[]) {
  const state = buildPatientState({
    message,
    patient: {
      age: Number(patient.age) || undefined,
      sex: patient.sex,
    },
    medications: patientMedications.map((m) => m.name),
    country: "Nigeria",
  });
  const result = runDifferentialEngine(state);

  if (!state.concepts.length) return null;

  const reasoning = {
    readiness: result.nextQuestion ? "collecting" : "ready",
    stage: result.nextQuestion ? "collecting" : "reasoning_ready",
    concernSummary: result.concernSummary,
    timeline: [
      {
        event: `${state.concepts.map((concept) => concept.replace(/_/g, " ")).join(", ")} reported`,
        whenText: state.modifiers.durationMentioned
          ? "timing partly mentioned by patient"
          : "timing not yet known",
        estimatedDate: "",
        certainty: state.modifiers.durationMentioned ? "user_reported" : "unknown",
        source: "chat_message",
      },
    ],
    nextQuestion: result.nextQuestion?.text || "",
    uncertaintyGaps: result.uncertaintyGaps,
    conditions: result.possibleConditions,
    stewardship: {
      nextAction: actionForEngineResult(result),
      reason:
        result.nextQuestion?.rationale ||
        "Curable has enough detail to summarize the current pattern.",
      shouldOfferDoctorValidation: result.careLevel === "clinician_today",
      shouldWarnUrgentCare: result.careLevel === "urgent_now",
      shouldStopQuestioning: result.careLevel === "urgent_now" || !result.nextQuestion,
    },
    usedContext: {
      profile: [`${patient.full_name}, ${patient.age}y, ${patient.sex}`],
      medications: patientMedications.map((m) => m.name).slice(0, 3),
      memory: [],
      conversation: ["Current symptom report"],
    },
  };

  const visibleReply = visibleEngineReply(result);

  return `${visibleReply}${reasoningTag(reasoning)}

[SIGNAL: Adaptive symptom report | 3 | Patient said: ${message}]
[ESCALATE: ${riskForEngineResult(result)} | Adaptive differential engine result | ${recommendationForEngineResult(result)}]`;
}

function visibleEngineReply(result: DifferentialResult) {
  if (result.careLevel === "urgent_now") {
    return "This combination is important to check promptly. Please seek urgent medical care now, especially if symptoms are worsening.";
  }

  if (result.nextQuestion) {
    return `Okay, let's narrow this down carefully. ${result.nextQuestion.text}`;
  }

  const top = result.possibleConditions[0];
  if (!top) return "I hear you. When did this start?";

  return `Based on what you've shared, ${top.name.toLowerCase()} is the strongest current pattern. I can prepare this clearly for a doctor if you want review.`;
}

function actionForEngineResult(result: DifferentialResult) {
  if (result.careLevel === "urgent_now") return "urgent_care_warning";
  if (result.nextQuestion) return "ask_one_question";
  if (result.careLevel === "clinician_today") return "suggest_doctor_validation";
  return "update_reasoning";
}

function riskForEngineResult(result: DifferentialResult) {
  if (result.careLevel === "urgent_now") return "emergency";
  if (result.careLevel === "clinician_today") return "high";
  if (result.careLevel === "self_care_guidance") return "low";
  return "low";
}

function recommendationForEngineResult(result: DifferentialResult) {
  if (result.careLevel === "urgent_now") return "Seek urgent medical evaluation now";
  if (result.nextQuestion) return "Continue adaptive symptom questioning";
  return "Summarize possible causes and offer doctor review";
}

function buildFallbackTaggedResponse(message: string, patient: any, patientMedications: any[]) {
  const lower = message.toLowerCase();
  const matchedMedication = patientMedications.find((m) => lower.includes(m.name.toLowerCase()));
  const emergencyTerms = [
    "chest pain",
    "trouble breathing",
    "shortness of breath",
    "faint",
    "stroke",
    "numbness",
    "suicidal",
  ];
  const isEmergency = emergencyTerms.some((term) => lower.includes(term));
  const hasFever =
    lower.includes("fever") || lower.includes("temperature") || lower.includes("hot body");
  const hasHeadache = lower.includes("headache") || lower.includes("head pain");
  const hasBodyPain =
    lower.includes("body pain") || lower.includes("body ache") || lower.includes("aches");
  const hasNausea =
    lower.includes("nausea") || lower.includes("nauseous") || lower.includes("vomit");
  const hasDuration = /yesterday|today|hour|day|week|started|since/i.test(message);
  const engineResponse = buildEngineTaggedResponse(message, patient, patientMedications);

  if (isEmergency) {
    const reasoning = {
      readiness: "ready",
      stage: "reasoning_ready",
      concernSummary: `You mentioned a symptom that can become urgent: ${message}`,
      timeline: [
        {
          event: "Urgent symptom reported",
          whenText: "now",
          estimatedDate: "",
          certainty: "user_reported",
          source: "chat_message",
        },
      ],
      nextQuestion: "",
      conditions: [
        {
          name: "Urgent symptom pattern",
          score: 88,
          matchLabel: "Strong pattern match",
          support: ["The symptom can need immediate medical assessment."],
          weakens: ["Curable cannot examine vital signs or severity directly."],
        },
      ],
      stewardship: {
        nextAction: "urgent_care_warning",
        reason: "The message contains a symptom pattern that can require immediate care.",
        shouldOfferDoctorValidation: false,
        shouldWarnUrgentCare: true,
        shouldStopQuestioning: true,
      },
      usedContext: {
        profile: [`${patient.full_name}, ${patient.age}y, ${patient.sex}`],
        medications: patientMedications.map((m) => m.name).slice(0, 3),
        memory: [],
        conversation: ["Current symptom report"],
      },
    };

    return `This symptom pattern can be urgent. Please seek emergency medical care now or call local emergency services.${reasoningTag(reasoning)}

[SIGNAL: Urgent symptom report | 3 | Patient said: ${message}]
[ESCALATE: emergency | Urgent symptom reported by patient | Seek immediate medical evaluation]`;
  }

  if (engineResponse) {
    return engineResponse;
  }

  if (hasNausea && matchedMedication) {
    const reasoning = {
      readiness: "collecting",
      stage: "collecting",
      concernSummary: `You reported nausea while ${matchedMedication.name} is on your medication list.`,
      timeline: [
        {
          event: "Nausea reported while medication is active in profile",
          whenText: "current report",
          estimatedDate: "",
          certainty: "user_reported",
          source: "chat_message",
        },
      ],
      nextQuestion: `Did the nausea start soon after taking ${matchedMedication.name}, or after eating?`,
      conditions: [
        {
          name: `${matchedMedication.name} timing effect`,
          score: 64,
          matchLabel: "Possible match",
          support: [
            "Nausea can be related to medication timing.",
            `${matchedMedication.name} is currently listed in your medications.`,
          ],
          weakens: ["The timing relative to the dose is not confirmed yet."],
        },
        {
          name: "Food or stomach irritation",
          score: 48,
          matchLabel: "Partial match",
          support: ["Nausea can also follow meals or stomach irritation."],
          weakens: ["Meal timing and other stomach symptoms are not known yet."],
        },
        {
          name: "Stomach infection",
          score: 38,
          matchLabel: "Partial match",
          support: ["Vomiting or diarrhea would make this more relevant."],
          weakens: ["Vomiting, diarrhea, or fever have not been confirmed."],
        },
      ],
      stewardship: {
        nextAction: "ask_one_question",
        reason:
          "Medication timing is the highest-value detail to separate medication effect from food or infection.",
        shouldOfferDoctorValidation: false,
        shouldWarnUrgentCare: false,
        shouldStopQuestioning: false,
      },
      usedContext: {
        profile: [`${patient.full_name}, ${patient.age}y, ${patient.sex}`],
        medications: [`${matchedMedication.name} is listed as current medication`],
        memory: [],
        conversation: ["Current nausea report"],
      },
    };

    return `This may relate to timing, food, or how your body is tolerating ${matchedMedication.name}. Did it start soon after taking ${matchedMedication.name}, or after eating?${reasoningTag(reasoning)}

[SIGNAL: Possible ${matchedMedication.name} side effect | 2 | Patient reports nausea about one hour after ${matchedMedication.name}]
[ESCALATE: moderate | Nausea possibly related to ${matchedMedication.name} timing | Doctor should review if persistent or worsening]`;
  }

  if (hasNausea) {
    const reasoning = {
      readiness: "collecting",
      stage: "collecting",
      concernSummary: `You reported nausea or vomiting: ${message}`,
      timeline: [
        {
          event: "Nausea or vomiting reported",
          whenText: "current report",
          estimatedDate: "",
          certainty: "user_reported",
          source: "chat_message",
        },
      ],
      nextQuestion: "When did the nausea start?",
      conditions: [
        {
          name: "Food or stomach irritation",
          score: 50,
          matchLabel: "Possible match",
          support: ["Nausea often relates to food intake or stomach irritation."],
          weakens: ["Food timing has not been described yet."],
        },
        {
          name: "Stomach infection",
          score: 42,
          matchLabel: "Partial match",
          support: ["Vomiting, diarrhea, or fever would make this more likely."],
          weakens: ["Diarrhea, fever, or exposure history is not known yet."],
        },
        {
          name: "Medication timing effect",
          score: 34,
          matchLabel: "Partial match",
          support: ["Medication timing can contribute, but we need to know what was taken."],
          weakens: ["No medication timing was reported in this message."],
        },
      ],
      stewardship: {
        nextAction: "ask_one_question",
        reason: "Onset is needed before comparing causes.",
        shouldOfferDoctorValidation: false,
        shouldWarnUrgentCare: false,
        shouldStopQuestioning: false,
      },
      usedContext: {
        profile: [`${patient.full_name}, ${patient.age}y, ${patient.sex}`],
        medications: patientMedications.map((m) => m.name).slice(0, 3),
        memory: [],
        conversation: ["Current nausea report"],
      },
    };

    return `I understand. When did the nausea start?${reasoningTag(reasoning)}

[SIGNAL: Nausea report | 3 | Patient said: ${message}]
[ESCALATE: low | Patient reports nausea | Monitor pattern and seek review if persistent]`;
  }

  if (hasFever || hasHeadache || hasBodyPain) {
    const symptomBits = [
      hasFever ? "fever" : "",
      hasHeadache ? "headache" : "",
      hasBodyPain ? "body pain" : "",
    ].filter(Boolean);
    const reasoning = {
      readiness: hasDuration ? "ready" : "collecting",
      stage: hasDuration ? "reasoning_ready" : "collecting",
      concernSummary: `You reported ${symptomBits.join(", ") || "symptoms"}${hasDuration ? "." : ", but timing is not clear yet."}`,
      timeline: [
        {
          event: `${symptomBits.join(", ") || "Symptoms"} reported`,
          whenText: hasDuration ? "timing mentioned by patient" : "timing not yet known",
          estimatedDate: "",
          certainty: hasDuration ? "user_reported" : "unknown",
          source: "chat_message",
        },
      ],
      nextQuestion: hasDuration
        ? "Has the fever been constant, or does it come and go?"
        : "When did it start?",
      conditions: [
        {
          name: "Malaria",
          score: hasFever && (hasHeadache || hasBodyPain) ? 68 : 48,
          matchLabel: hasFever && (hasHeadache || hasBodyPain) ? "Possible match" : "Partial match",
          support: [
            "Fever with headache or body pain can fit malaria patterns.",
            "Regional context can matter.",
          ],
          weakens: ["Chills, sweating, test result, and exposure details are not known yet."],
        },
        {
          name: "Viral infection",
          score: hasFever ? 56 : 42,
          matchLabel: hasFever ? "Possible match" : "Partial match",
          support: ["Fever, headache, and body aches can overlap with viral illness."],
          weakens: ["Respiratory or stomach symptoms have not been described yet."],
        },
        {
          name: "Dehydration or heat stress",
          score: 34,
          matchLabel: "Partial match",
          support: ["Headache and weakness can be affected by heat or low fluid intake."],
          weakens: ["Fluid intake, heat exposure, and urine color are not known yet."],
        },
      ],
      stewardship: {
        nextAction: "ask_one_question",
        reason: hasDuration
          ? "Fever pattern helps separate malaria-like patterns from viral or heat-related explanations."
          : "Onset is the first missing detail needed for a useful timeline.",
        shouldOfferDoctorValidation: false,
        shouldWarnUrgentCare: false,
        shouldStopQuestioning: false,
      },
      usedContext: {
        profile: [`${patient.full_name}, ${patient.age}y, ${patient.sex}`],
        medications: patientMedications.map((m) => m.name).slice(0, 3),
        memory: [],
        conversation: ["Current fever/headache/body pain report"],
      },
    };

    return `${hasDuration ? "I'm building the symptom picture." : "I understand."} ${reasoning.nextQuestion}${reasoningTag(reasoning)}

[SIGNAL: Symptom report | 3 | Patient said: ${message}]
[ESCALATE: low | Patient reports fever/headache/body pain pattern | Continue guided questioning]`;
  }

  const reasoning = {
    readiness: "collecting",
    stage: "collecting",
    concernSummary: `You shared a health concern: ${message}`,
    timeline: [
      {
        event: "Health concern reported",
        whenText: "current report",
        estimatedDate: "",
        certainty: "user_reported",
        source: "chat_message",
      },
    ],
    nextQuestion: "When did this start?",
    conditions: [
      {
        name: "Needs more symptom detail",
        score: 20,
        matchLabel: "Needs more information",
        support: [
          "Curable needs timing, severity, and symptom details before comparing explanations.",
        ],
        weakens: ["There is not enough symptom detail yet to compare explanations."],
      },
    ],
    stewardship: {
      nextAction: "ask_one_question",
      reason: "The first useful step is to establish onset.",
      shouldOfferDoctorValidation: false,
      shouldWarnUrgentCare: false,
      shouldStopQuestioning: false,
    },
    usedContext: {
      profile: [`${patient.full_name}, ${patient.age}y, ${patient.sex}`],
      medications: patientMedications.map((m) => m.name).slice(0, 3),
      memory: [],
      conversation: ["Current health concern"],
    },
  };

  return `I hear you. When did this start?${reasoningTag(reasoning)}

[SIGNAL: Patient health update | 3 | Patient said: ${message}]
[ESCALATE: low | New patient health update | Continue monitoring and request doctor review if needed]`;
}

function getLatestReasoningSnapshot(recentMessages: any[] | null) {
  const source = recentMessages?.find((message) => {
    const reasoning = message?.metadata?.reasoning;
    return reasoning?.conditions?.length || reasoning?.possibleConditions?.length;
  });

  const reasoning = normalizeReasoning(source?.metadata?.reasoning);
  if (!reasoning) return null;

  return {
    ...reasoning,
    sourceMessageAt: source?.created_at || null,
  };
}

function formatReasoningSnapshotForReport(snapshot: any) {
  if (!snapshot) return [];

  const conditionLines = (snapshot.conditions || []).map((condition: any) => {
    const supports = toStringArray(condition.support).join("; ") || "No support listed.";
    const weakens = toStringArray(condition.weakens).join("; ") || "No weakening detail listed.";
    return `${condition.name} (${condition.matchLabel}, ${condition.score}/100 visual score). Supports: ${supports}. Weakens: ${weakens}`;
  });

  const timelineLines = (snapshot.timeline || []).map((item: any) => {
    const date = item.estimatedDate ? `, estimated ${item.estimatedDate}` : "";
    return `${item.event} (${item.whenText || "time unclear"}${date}; ${item.certainty || "unknown"})`;
  });

  return [
    `Reasoning snapshot concern: ${snapshot.concernSummary}`,
    timelineLines.length
      ? `Timeline: ${timelineLines.join(" | ")}`
      : "Timeline: no clear timeline captured yet.",
    conditionLines.length
      ? `Possible explanations: ${conditionLines.join(" | ")}`
      : "Possible explanations: not enough information yet.",
    snapshot.nextQuestion ? `Next question Curable chose: ${snapshot.nextQuestion}` : "",
    snapshot.stewardship?.nextAction
      ? `Stewardship action: ${snapshot.stewardship.nextAction}. ${snapshot.stewardship.reason || ""}`.trim()
      : "",
    snapshot.sourceMessageAt ? `Snapshot source message time: ${snapshot.sourceMessageAt}` : "",
  ].filter(Boolean);
}

function buildFallbackReport(
  reason: string,
  patient: any,
  patientMedications: any[],
  memory: any[] | null,
  recentMessages: any[] | null,
  reasoningSnapshot?: any,
) {
  const lower = `${reason} ${recentMessages?.map((m) => m.content).join(" ") || ""}`.toLowerCase();
  const risk =
    lower.includes("chest pain") || lower.includes("trouble breathing") ? "emergency" : "moderate";

  return {
    summary: reason || "Patient requested doctor review of recent symptoms and AI conversation.",
    risk,
    doctorQuestion: reason || "Please review the patient's recent concern and advise next steps.",
    patientContext: [
      `${patient.full_name}, ${patient.age}y, ${patient.sex}`,
      `Conditions: ${patient.conditions?.join(", ") || "None recorded"}`,
      `Allergies: ${patient.allergies?.join(", ") || "None recorded"}`,
      patient.pinned_by_doctor ? `Doctor note: ${patient.pinned_by_doctor}` : "",
    ].filter(Boolean),
    medicationContext: patientMedications.map(
      (m) =>
        `${m.name} ${m.dosage}, ${m.frequency}; purpose: ${m.purpose}; adherence ${Math.round(m.adherence * 100)}%`,
    ),
    memoryContext: memory?.map((m) => `${m.label}: ${m.details}`) || [],
    recentConversation: recentMessages?.map((m) => `${m.role}: ${m.content}`) || [],
    reasoningSnapshot: reasoningSnapshot || null,
    aiSafetyNote: structuredFallbackSafetyNote,
  };
}

function parseReportJson(raw: string) {
  const cleaned = raw
    .replace(/```json/g, "")
    .replace(/```/g, "")
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");

    if (start >= 0 && end > start) {
      return JSON.parse(cleaned.slice(start, end + 1));
    }

    throw new Error("AI report response was not valid JSON.");
  }
}

function toStringArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === "string" ? item : JSON.stringify(item)))
    .filter((item) => item && item !== "null" && item !== "undefined");
}

function normalizeDoctorReport(report: any, reason: string, fallbackReasoningSnapshot?: any) {
  const risk = String(report?.risk || "moderate").toLowerCase();
  const allowedRisk = ["low", "moderate", "high", "emergency"].includes(risk) ? risk : "moderate";
  const reportReasoning =
    normalizeReasoning(report?.reasoningSnapshot) || fallbackReasoningSnapshot || null;

  return {
    summary: String(report?.summary || reason || "Patient requested doctor review."),
    risk: allowedRisk,
    doctorQuestion: String(
      report?.doctorQuestion || reason || "Please review the patient's concern.",
    ),
    patientContext: toStringArray(report?.patientContext),
    medicationContext: toStringArray(report?.medicationContext),
    memoryContext: toStringArray(report?.memoryContext),
    recentConversation: toStringArray(report?.recentConversation),
    reasoningSnapshot: reportReasoning,
    aiSafetyNote: report?.aiSafetyNote ? String(report.aiSafetyNote) : "",
  };
}

export const getPatientChatState = createServerFn({
  method: "GET",
  validator: z.object({
    patientId: z.string().uuid(),
  }),
}).handler(async ({ data: { patientId } }) => {
  const { supabase, supabaseAdmin } = await import("@/lib/supabase");
  const client = supabaseAdmin || supabase;

  const [
    { data: patient, error: patientError },
    { data: messages, error: messageError },
    { data: memories, error: memoryError },
  ] = await Promise.all([
    client.from("patients").select("*").eq("id", patientId).single(),
    client
      .from("messages")
      .select("*")
      .eq("patient_id", patientId)
      .order("created_at", { ascending: true }),
    client
      .from("memory_snapshots")
      .select("*")
      .eq("patient_id", patientId)
      .order("created_at", { ascending: false }),
  ]);

  if (patientError) throw patientError;
  if (messageError) throw messageError;
  if (memoryError) throw memoryError;

  return {
    patient,
    messages: messages || [],
    memories: memories || [],
    doctorConnection: await readDoctorConnection(client, patientId),
  };
});

export const sendMessage = createServerFn({
  method: "POST",
  validator: z.object({
    patientId: z.string().uuid(),
    message: z.string(),
  }),
}).handler(async ({ data: { patientId, message } }) => {
  // Move server-only imports inside the handler
  const { OpenAI } = await import("openai");
  const { supabase, supabaseAdmin } = await import("@/lib/supabase");
  const client = supabaseAdmin || supabase;

  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY || "missing-openai-key",
  });
  const deepseek = process.env.DEEPSEEK_API_KEY
    ? new OpenAI({
        apiKey: process.env.DEEPSEEK_API_KEY,
        baseURL: process.env.DEEPSEEK_BASE_URL || DEEPSEEK_BASE_URL,
      })
    : null;

  // 1. Fetch Patient Context
  const [{ data: patient }, { data: memory }, { data: recentMessages }] = await Promise.all([
    client.from("patients").select("*").eq("id", patientId).single(),
    client
      .from("memory_snapshots")
      .select("*")
      .eq("patient_id", patientId)
      .order("created_at", { ascending: false })
      .limit(24),
    client
      .from("messages")
      .select("role, content, created_at")
      .eq("patient_id", patientId)
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  if (!patient) throw new Error("Patient not found");

  const { error: patientMessageError } = await client.from("messages").insert({
    patient_id: patientId,
    role: "patient",
    content: message,
  });
  if (patientMessageError) throw patientMessageError;

  // 2. Format Context for AI
  const patientMedications = await fetchMedicationsForPatient(patientId);
  const medicationContext = patientMedications
    .map((m) => {
      const sideEffects = m.sideEffects.length
        ? `; reported side effects: ${m.sideEffects.join(", ")}`
        : "";
      return `- ${m.name} ${m.dosage}, ${m.frequency} at ${m.time}; purpose: ${m.purpose}; source: ${m.source}; adherence: ${Math.round(m.adherence * 100)}%; prescriber: ${m.prescriber}${sideEffects}`;
    })
    .join("\n");

  const memoryContext = memory?.length
    ? memory
        .map(
          (m) =>
            `- [L${m.layer}: ${memoryLayerNames[m.layer] || "Memory"}] ${m.label}: ${m.details}`,
        )
        .join("\n")
    : "No saved health memory yet.";

  const recentConversationContext = recentMessages?.length
    ? recentMessages
        .slice()
        .reverse()
        .map((m) => `${m.role}: ${m.content}`)
        .join("\n")
    : "No prior messages in this chat.";

  const today = new Date().toISOString().slice(0, 10);
  const contextStr = `
Today's date: ${today}
Patient: ${patient.full_name} (${patient.age}y, ${patient.sex})
Known Conditions: ${patient.conditions?.join(", ") || "None"}
Allergies: ${patient.allergies?.join(", ") || "None"}
Doctor's Note: ${patient.pinned_by_doctor || "None"}

Current Medications:
${medicationContext}

Continuous Patient Memory:
${memoryContext}

Recent Conversation:
${recentConversationContext}
    `.trim();

  // 3. Call OpenAI, with a local safety fallback if quota is unavailable.
  let fullContent = "";
  const chatMessages = [
    {
      role: "system" as const,
      content: `You are Curable AI, a context-aware health reasoning assistant.
Your goal is to help the patient explain what they feel, narrow what it could be, and know what to do next through careful adaptive questioning.

### INTERNAL ORCHESTRATOR:
Before writing the visible reply, silently run these stages:
1. Intake Agent: extract symptoms, onset, progression, medication use, profile facts, allergies, memory, and what the patient already answered.
2. Timeline Agent: turn time clues into a short illness timeline. Use today's date from context when estimating dates. Mark uncertainty instead of inventing.
3. Early Differential Agent: create a low-confidence differential immediately, but do not reveal it too early unless enough useful context exists. These are possible explanations, not diagnoses.
4. Uncertainty Gap Agent: identify the missing detail that would most change the differential or the next action.
5. Challenger Agent: for each explanation, state what weakens it or what is still missing. Use this to avoid overconfidence.
6. Question Chooser: choose only ONE best next question, or one tight grouped question, from the uncertainty gaps. Prioritize the question that most separates the top explanations, captures minute clinical detail, or improves safety without creating fatigue.
7. Stewardship Agent: decide the next product action: ask one question, update reasoning, suggest doctor validation, urgent care warning, reassure and monitor, or wait for user.
8. Presentation Agent: write the short patient-facing reply in everyday language.

### ADAPTIVE QUESTIONING MODEL:
- Think early internally. Generate an early differential after the first symptom, but keep confidence low and usually ask before showing the full list.
- Do not use a rigid checklist. Use complaint-specific knowledge to select the highest-value next question.
- If headache + fever: ask infection/meningitis/malaria-separating questions early, phrased calmly.
- If headache + stress/screen strain: ask tension, migraine, sleep, hydration, and eye-strain separating questions.
- If headache + trauma: ask injury-focused questions before routine headache causes.
- If a user gives a specific detail like "front headache", immediately use it to narrow location-specific possibilities and ask the next differentiating question.
- Stop questioning when the next answer is unlikely to change the guidance, when enough context exists for a careful possible-causes summary, or when care-seeking advice is already the safest action.

### GUIDELINES:
1. Never diagnose. Say "possible explanations" or "pattern match", not "you have".
2. Keep the visible reply short and engaging: usually 1-3 sentences.
3. Ask at most ONE targeted question at a time, or one tight grouped question with short yes/no items when clinically useful.
4. Do not show a long questionnaire in the visible reply.
5. Do not include a "what Curable cannot confirm" section in the visible reply.
6. Do not ask for information the patient already gave in the current or recent messages.
7. Never tell a patient to stop, start, or change a prescribed medication without doctor review.
8. Use the patient's profile, allergies, conditions, medications, saved memory, and recent messages when relevant.
9. If symptoms could be urgent (chest pain, trouble breathing, stroke symptoms, fainting, severe allergic reaction, suicidal intent, severe worsening), clearly tell the patient to seek urgent/emergency care.
10. Do not mention hidden tags or JSON to the patient.

### OUTPUT FORMAT:
Your response must start with the short visible reply for the patient.
AT THE VERY END of your response, you MUST include hidden metadata tags.
These tags will be stripped by the backend and NOT shown to the patient.

Tags:
[SIGNAL: label | layer | details] -> layer 1: stable profile fact, allergy, condition, procedure, pregnancy, care preference; layer 2: medication reaction, adherence pattern, recurring symptom, lifestyle pattern; layer 3: current symptom event or recent concern
[ESCALATE: risk | summary | recommendation] -> risk: low, moderate, high, emergency
<curable_reasoning>{"stage":"collecting","readiness":"collecting","concernSummary":"short restatement of the concern","timeline":[{"event":"what happened","whenText":"patient wording like yesterday or this morning","estimatedDate":"YYYY-MM-DD or empty if uncertain","certainty":"user_reported","source":"chat_message"}],"nextQuestion":"the one targeted or tightly grouped question you are asking, if any","uncertaintyGaps":["missing detail that would change ranking or next action"],"possibleConditions":[{"name":"possible explanation","score":0-100,"matchLabel":"Strong pattern match","support":["brief reason this is being considered"],"weakens":["brief reason this may be wrong or is still unconfirmed"]}],"stewardship":{"nextAction":"ask_one_question","reason":"why this action is best now","shouldOfferDoctorValidation":false,"shouldWarnUrgentCare":false,"shouldStopQuestioning":false},"usedContext":{"profile":["facts used"],"medications":["meds used"],"memory":["memory used"],"conversation":["recent answers used"]}}</curable_reasoning>

Graph guidance:
- Include 1-4 possible explanations.
- Scores are for visual comparison only, not diagnostic probability.
- Prefer "collecting" until the key uncertainty gaps are reduced enough for useful guidance.
- The visible reply should ask the next best question; deeper reasoning and uncertainty gaps belong in <curable_reasoning>.
- Include timeline, challenger weakens, stewardship, and usedContext even when still collecting.
- Use "reasoning_ready" stage only when there is enough symptom and timeline context to create a useful doctor validation report.

Example:
"I understand. When did the fever start? [SIGNAL: Fever report | 3 | Patient reports fever] [ESCALATE: low | Fever reported | Continue guided questioning] <curable_reasoning>{"stage":"collecting","readiness":"collecting","concernSummary":"Patient reports fever, but timing is not clear yet.","timeline":[{"event":"Fever reported","whenText":"not yet known","estimatedDate":"","certainty":"unknown","source":"chat_message"}],"nextQuestion":"When did the fever start?","possibleConditions":[{"name":"Malaria","score":45,"matchLabel":"Partial match","support":["Fever can fit malaria patterns, especially depending on region."],"weakens":["Timing, chills, sweating, and test result are not known yet."]},{"name":"Viral infection","score":42,"matchLabel":"Partial match","support":["Fever can also fit many viral illnesses."],"weakens":["No respiratory, stomach, or exposure details are known yet."]}],"stewardship":{"nextAction":"ask_one_question","reason":"Onset is the first missing timeline detail.","shouldOfferDoctorValidation":false,"shouldWarnUrgentCare":false,"shouldStopQuestioning":false},"usedContext":{"profile":[],"medications":[],"memory":[],"conversation":["Current fever report"]}}</curable_reasoning>"
`,
    },
    { role: "user" as const, content: `CONTEXT:\n${contextStr}\n\nUSER MESSAGE: ${message}` },
  ];

  try {
    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4o",
      messages: chatMessages,
    });

    fullContent = response.choices[0].message.content || "";
  } catch (openAiErr) {
    if (deepseek) {
      try {
        const response = await deepseek.chat.completions.create({
          model: process.env.DEEPSEEK_MODEL || DEEPSEEK_MODEL,
          messages: chatMessages,
        });

        fullContent = response.choices[0].message.content || "";
      } catch (deepseekErr) {
        console.warn("OpenAI and DeepSeek chat unavailable; using local Curable fallback.", {
          openAiErr,
          deepseekErr,
        });
        fullContent = buildFallbackTaggedResponse(message, patient, patientMedications);
      }
    } else {
      console.warn(
        "OpenAI chat unavailable and no DeepSeek key is configured; using local Curable fallback.",
        openAiErr,
      );
      fullContent = buildFallbackTaggedResponse(message, patient, patientMedications);
    }
  }

  // 4. Parse Metadata Tags
  const signals: { label: string; layer: number; details: string }[] = [];
  let escalation: { risk: string; summary: string; recommendation: string } | null = null;
  const reasoning = parseReasoning(fullContent);

  // Regex to find [SIGNAL: ...]
  const signalRegex = /\[SIGNAL:\s*(.*?)\s*\|\s*(\d)\s*\|\s*(.*?)\s*\]/g;
  let match;
  while ((match = signalRegex.exec(fullContent)) !== null) {
    signals.push({
      label: match[1],
      layer: parseInt(match[2]),
      details: match[3],
    });
  }

  // Regex to find [ESCALATE: ...]
  const escalateRegex = /\[ESCALATE:\s*(.*?)\s*\|\s*(.*?)\s*\|\s*(.*?)\s*\]/;
  const escalateMatch = fullContent.match(escalateRegex);
  if (escalateMatch) {
    escalation = {
      risk: escalateMatch[1].toLowerCase(),
      summary: escalateMatch[2],
      recommendation: escalateMatch[3],
    };
  }

  // 5. Clean Content (Strip Tags)
  const cleanContent = stripClinicalTags(fullContent);

  // 6. Persistence
  // Save AI Message
  const { data: msgData, error: msgError } = await client
    .from("messages")
    .insert({
      patient_id: patientId,
      role: "ai",
      content: cleanContent,
      metadata: { signals, escalation, reasoning, original_content: fullContent },
    })
    .select()
    .single();

  if (msgError) console.error("Error saving message:", msgError);

  // Save Signals to Memory
  if (signals.length > 0) {
    for (const signal of signals) {
      const { data: existing } = await client
        .from("memory_snapshots")
        .select("id, details")
        .eq("patient_id", patientId)
        .eq("layer", signal.layer)
        .ilike("label", signal.label)
        .maybeSingle();

      if (existing) {
        await client
          .from("memory_snapshots")
          .update({
            details:
              existing.details && existing.details !== signal.details
                ? `${existing.details}\nUpdate: ${signal.details}`
                : signal.details,
            source_message_id: msgData?.id,
          })
          .eq("id", existing.id);
      } else {
        await client.from("memory_snapshots").insert({
          patient_id: patientId,
          label: signal.label,
          layer: signal.layer,
          details: signal.details,
          source_message_id: msgData?.id,
        });
      }
    }
  }

  // Doctor review is patient-initiated through the report flow, not automatic chat escalation.

  return {
    id: msgData?.id,
    role: "ai",
    content: cleanContent,
    time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    risk: escalation?.risk,
    reasoning,
    memoriesAdded: signals.map((s) => ({
      label: s.label,
      layer: s.layer,
      details: s.details,
    })),
  };
});

export const createDoctorReviewReport = createServerFn({
  method: "POST",
  validator: z.object({
    patientId: z.string().uuid(),
    reason: z.string().min(1),
  }),
}).handler(async ({ data: { patientId, reason } }) => {
  const { OpenAI } = await import("openai");
  const { supabase, supabaseAdmin } = await import("@/lib/supabase");
  const client = supabaseAdmin || supabase;

  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY || "missing-openai-key",
  });
  const deepseek = process.env.DEEPSEEK_API_KEY
    ? new OpenAI({
        apiKey: process.env.DEEPSEEK_API_KEY,
        baseURL: process.env.DEEPSEEK_BASE_URL || DEEPSEEK_BASE_URL,
      })
    : null;

  const [{ data: patient }, { data: memory }, { data: recentMessages }] = await Promise.all([
    client.from("patients").select("*").eq("id", patientId).single(),
    client
      .from("memory_snapshots")
      .select("*")
      .eq("patient_id", patientId)
      .order("created_at", { ascending: false })
      .limit(16),
    client
      .from("messages")
      .select("role, content, created_at, metadata")
      .eq("patient_id", patientId)
      .order("created_at", { ascending: false })
      .limit(12),
  ]);

  if (!patient) throw new Error("Patient not found");

  const patientMedications = await fetchMedicationsForPatient(patientId);
  const medicationContext = patientMedications
    .map(
      (m) =>
        `${m.name} ${m.dosage}, ${m.frequency}; ${m.purpose}; adherence ${Math.round(m.adherence * 100)}%`,
    )
    .join("\n");

  const memoryContext = memory?.length
    ? memory.map((m) => `[L${m.layer}] ${m.label}: ${m.details}`).join("\n")
    : "No saved memory facts yet.";

  const recentConversation = recentMessages?.length
    ? recentMessages
        .slice()
        .reverse()
        .map((m) => `${m.role}: ${m.content}`)
        .join("\n")
    : "No recent conversation.";
  const latestReasoningSnapshot = getLatestReasoningSnapshot(recentMessages || []);
  const reasoningContext = latestReasoningSnapshot
    ? formatReasoningSnapshotForReport(latestReasoningSnapshot).join("\n")
    : "No live reasoning snapshot has been captured yet.";

  const reportMessages = [
    {
      role: "system" as const,
      content: `Create a concise doctor handoff report from an AI care assistant.
Do not diagnose. Do not invent facts. Write for a busy doctor.
Use the supplied reasoning snapshot as a frozen copy of what Curable had reasoned at report time.
Return only valid JSON with these keys:
{
  "summary": "short clinical situation summary",
  "risk": "low | moderate | high | emergency",
  "doctorQuestion": "the main question the patient wants reviewed",
  "patientContext": ["brief profile or safety context"],
  "medicationContext": ["medication details relevant to this concern"],
  "memoryContext": ["saved patterns or prior events relevant to this concern"],
  "recentConversation": ["key recent patient statements"],
  "reasoningSnapshot": {
    "readiness": "collecting | ready",
    "concernSummary": "copy or tighten the supplied reasoning concern",
    "timeline": [{"event": "timeline event", "whenText": "patient wording", "estimatedDate": "YYYY-MM-DD or empty", "certainty": "user_reported | inferred | unknown", "source": "chat_message"}],
    "conditions": [{"name": "possible explanation", "score": 0, "matchLabel": "Possible match", "support": ["why considered"], "weakens": ["what weakens it"]}],
    "nextQuestion": "one next question if relevant",
    "stewardship": {"nextAction": "ask_one_question | update_reasoning | suggest_doctor_validation | urgent_care_warning | reassure_and_monitor | wait_for_user", "reason": "why", "shouldOfferDoctorValidation": true, "shouldWarnUrgentCare": false, "shouldStopQuestioning": false},
    "usedContext": {"profile": [], "medications": [], "memory": [], "conversation": []}
  },
  "aiSafetyNote": "what the AI advised or avoided advising"
}`,
    },
    {
      role: "user" as const,
      content: `Reason for doctor review: ${reason}

Patient:
${patient.full_name}, ${patient.age}y, ${patient.sex}
Conditions: ${patient.conditions?.join(", ") || "None"}
Allergies: ${patient.allergies?.join(", ") || "None"}
Doctor pinned note: ${patient.pinned_by_doctor || "None"}

Current medications:
${medicationContext}

Saved memory:
${memoryContext}

Recent conversation:
${recentConversation}

Frozen Curable reasoning snapshot:
${reasoningContext}`,
    },
  ];

  let report;
  try {
    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4o",
      messages: reportMessages,
    });

    const raw = response.choices[0].message.content || "{}";
    report = normalizeDoctorReport(parseReportJson(raw), reason, latestReasoningSnapshot);
  } catch (openAiErr) {
    if (deepseek) {
      try {
        const response = await deepseek.chat.completions.create({
          model: process.env.DEEPSEEK_MODEL || DEEPSEEK_MODEL,
          messages: reportMessages,
        });

        const raw = response.choices[0].message.content || "{}";
        report = normalizeDoctorReport(parseReportJson(raw), reason, latestReasoningSnapshot);
      } catch (deepseekErr) {
        console.warn(
          "OpenAI and DeepSeek report generation unavailable; using structured fallback report.",
          {
            openAiErr,
            deepseekErr,
          },
        );
        report = buildFallbackReport(
          reason,
          patient,
          patientMedications,
          memory || [],
          recentMessages || [],
          latestReasoningSnapshot,
        );
      }
    } else {
      console.warn(
        "OpenAI report generation unavailable and no DeepSeek key is configured; using structured fallback report.",
        openAiErr,
      );
      report = buildFallbackReport(
        reason,
        patient,
        patientMedications,
        memory || [],
        recentMessages || [],
        latestReasoningSnapshot,
      );
    }
  }

  return report;
});

export const sendDoctorReviewReport = createServerFn({
  method: "POST",
  validator: z.object({
    patientId: z.string().uuid(),
    doctor: z
      .object({
        doctorName: z.string().optional(),
        doctorEmail: z.string().optional(),
        clinicName: z.string().optional(),
      })
      .optional(),
    report: z.object({
      summary: z.string(),
      risk: z.string(),
      doctorQuestion: z.string(),
      patientContext: z.array(z.string()).optional(),
      medicationContext: z.array(z.string()).optional(),
      memoryContext: z.array(z.string()).optional(),
      recentConversation: z.array(z.string()).optional(),
      reasoningSnapshot: z.any().optional(),
      aiSafetyNote: z.string().optional(),
    }),
  }),
}).handler(async ({ data: { patientId, report, doctor } }) => {
  const { supabase, supabaseAdmin } = await import("@/lib/supabase");
  const client = supabaseAdmin || supabase;
  const savedDoctor = await readDoctorConnection(client, patientId);
  const assignedDoctor = {
    doctorName: doctor?.doctorName?.trim() || savedDoctor?.doctorName || "",
    doctorEmail: doctor?.doctorEmail?.trim() || savedDoctor?.doctorEmail || "",
    clinicName: doctor?.clinicName?.trim() || savedDoctor?.clinicName || "",
  };

  if (!assignedDoctor.doctorName) {
    throw new Error(
      "Add a validating doctor in Consultation before sending a doctor review report.",
    );
  }

  const detailLines = [
    `Assigned doctor: ${assignedDoctor.doctorName}${assignedDoctor.doctorEmail ? ` (${assignedDoctor.doctorEmail})` : ""}`,
    assignedDoctor.clinicName ? `Clinic: ${assignedDoctor.clinicName}` : "",
    `Doctor question: ${report.doctorQuestion}`,
    report.aiSafetyNote ? `AI safety note: ${report.aiSafetyNote}` : "",
    ...(report.patientContext?.map((item) => `Patient: ${item}`) || []),
    ...(report.medicationContext?.map((item) => `Medication: ${item}`) || []),
    ...(report.memoryContext?.map((item) => `Memory: ${item}`) || []),
    ...(report.recentConversation?.map((item) => `Recent chat: ${item}`) || []),
    ...formatReasoningSnapshotForReport(report.reasoningSnapshot),
  ].filter(Boolean);

  const { data, error } = await client
    .from("review_queue")
    .insert({
      patient_id: patientId,
      summary: report.summary,
      risk_level: report.risk,
      ai_recommendation: detailLines.join("\n"),
      status: "pending",
    })
    .select("id")
    .single();

  if (error) throw error;

  try {
    await client.from("doctor_reports").insert({
      review_id: data?.id,
      patient_id: patientId,
      summary: report.summary,
      risk_level: report.risk,
      doctor_question: report.doctorQuestion,
      patient_context: report.patientContext || [],
      medication_context: report.medicationContext || [],
      memory_context: report.memoryContext || [],
      recent_conversation: report.recentConversation || [],
      ai_safety_note: report.aiSafetyNote || null,
      status: "sent",
    });
  } catch (err) {
    console.warn(
      "doctor_reports insert failed. Run supabase-curable-schema.sql to enable report persistence.",
      err,
    );
  }

  return { id: data?.id };
});
