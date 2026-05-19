export type ClinicalConcept =
  | "headache"
  | "fever"
  | "runny_nose"
  | "blocked_nose"
  | "facial_pressure"
  | "cough"
  | "sore_throat"
  | "body_aches"
  | "chills"
  | "vomiting"
  | "neck_stiffness"
  | "light_sensitivity"
  | "confusion"
  | "vision_change"
  | "weakness_or_numbness"
  | "head_trauma"
  | "stress"
  | "screen_strain"
  | "dehydration"
  | "chest_pain"
  | "shortness_of_breath"
  | "abdominal_pain"
  | "diarrhea"
  | "nausea";

export type PatientState = {
  rawText: string;
  concepts: ClinicalConcept[];
  demographics?: {
    age?: number;
    sex?: string;
  };
  context?: {
    country?: string;
    region?: string;
    currentMedications?: string[];
  };
  modifiers: {
    durationMentioned: boolean;
    suddenOnset: boolean;
    gradualOnset: boolean;
    severeLanguage: boolean;
    headacheLocation?: "front" | "one_side" | "back" | "around_eyes";
    headacheCharacter?: "pressure" | "throbbing" | "sharp" | "heavy";
  };
};

export type ConditionScore = {
  name: string;
  score: number;
  matchLabel:
    | "Strong pattern match"
    | "Possible match"
    | "Partial match"
    | "Needs more information";
  support: string[];
  weakens: string[];
};

export type NextQuestion = {
  id: string;
  text: string;
  asksAbout: ClinicalConcept[];
  value: number;
  rationale: string;
};

export type DifferentialResult = {
  concernSummary: string;
  possibleConditions: ConditionScore[];
  uncertaintyGaps: string[];
  nextQuestion: NextQuestion | null;
  careLevel: "continue_questions" | "self_care_guidance" | "clinician_today" | "urgent_now";
  safetySignals: string[];
};

type ConditionDefinition = {
  name: string;
  baseScore: number;
  features: Partial<Record<ClinicalConcept, number>>;
  contextBoosts?: Array<{
    when: (state: PatientState) => boolean;
    amount: number;
    reason: string;
  }>;
  contradictions?: Partial<Record<ClinicalConcept, string>>;
  mustAsk?: ClinicalConcept[];
};

type QuestionDefinition = {
  id: string;
  text: string;
  asksAbout: ClinicalConcept[];
  appliesWhen: (state: PatientState, topConditions: ConditionScore[]) => boolean;
  value: number;
  rationale: string;
};

const conceptLexicon: Array<{ concept: ClinicalConcept; terms: string[] }> = [
  { concept: "headache", terms: ["headache", "head pain", "my head", "pounding head"] },
  { concept: "fever", terms: ["fever", "temperature", "hot body", "feverish", "feeling hot"] },
  { concept: "runny_nose", terms: ["runny nose", "running nose", "catarrh"] },
  { concept: "blocked_nose", terms: ["blocked nose", "stuffy nose", "nasal blockage"] },
  {
    concept: "facial_pressure",
    terms: ["facial pressure", "face pain", "forehead pressure", "sinus"],
  },
  { concept: "cough", terms: ["cough", "coughing"] },
  { concept: "sore_throat", terms: ["sore throat", "throat pain"] },
  { concept: "body_aches", terms: ["body pain", "body ache", "body aches", "muscle pain"] },
  { concept: "chills", terms: ["chills", "shivering", "cold even when hot"] },
  { concept: "vomiting", terms: ["vomit", "vomiting", "throwing up"] },
  { concept: "neck_stiffness", terms: ["neck stiff", "stiff neck", "neck stiffness"] },
  { concept: "light_sensitivity", terms: ["light sensitivity", "light hurts", "photophobia"] },
  { concept: "confusion", terms: ["confused", "confusion", "drowsy", "not alert"] },
  { concept: "vision_change", terms: ["blurry vision", "blurred vision", "vision change"] },
  { concept: "weakness_or_numbness", terms: ["weakness", "numbness", "can't move"] },
  { concept: "head_trauma", terms: ["hit my head", "fell", "fall", "accident", "head injury"] },
  { concept: "stress", terms: ["stress", "stressed", "tension"] },
  { concept: "screen_strain", terms: ["screen", "laptop", "computer", "phone all day"] },
  { concept: "dehydration", terms: ["dehydrated", "no water", "thirsty", "dark urine"] },
  { concept: "chest_pain", terms: ["chest pain", "tight chest"] },
  {
    concept: "shortness_of_breath",
    terms: ["shortness of breath", "trouble breathing", "can't breathe"],
  },
  { concept: "abdominal_pain", terms: ["stomach pain", "abdominal pain", "belly pain"] },
  { concept: "diarrhea", terms: ["diarrhea", "watery stool", "loose stool"] },
  { concept: "nausea", terms: ["nausea", "nauseous", "feel like vomiting"] },
];

const conditions: ConditionDefinition[] = [
  {
    name: "Viral upper respiratory infection",
    baseScore: 12,
    features: {
      fever: 20,
      headache: 10,
      runny_nose: 28,
      blocked_nose: 22,
      cough: 18,
      sore_throat: 16,
      body_aches: 12,
    },
    contradictions: {
      neck_stiffness: "Neck stiffness would make a routine respiratory infection less reassuring.",
      confusion: "Confusion is not expected in an uncomplicated cold or flu-like illness.",
    },
    mustAsk: ["fever", "cough", "sore_throat", "runny_nose"],
  },
  {
    name: "Sinus irritation or sinusitis",
    baseScore: 10,
    features: {
      headache: 14,
      runny_nose: 18,
      blocked_nose: 24,
      facial_pressure: 30,
      fever: 8,
    },
    contextBoosts: [
      {
        when: (state) =>
          state.modifiers.headacheLocation === "front" ||
          state.modifiers.headacheLocation === "around_eyes",
        amount: 16,
        reason: "Front or around-eye headache can fit sinus pressure.",
      },
    ],
    mustAsk: ["blocked_nose", "facial_pressure", "fever"],
  },
  {
    name: "Malaria or systemic infection",
    baseScore: 12,
    features: {
      fever: 28,
      headache: 16,
      chills: 24,
      body_aches: 18,
      vomiting: 8,
    },
    contextBoosts: [
      {
        when: (state) => state.context?.country?.toLowerCase().includes("nigeria") ?? true,
        amount: 12,
        reason: "Regional context keeps malaria relevant when fever is present.",
      },
    ],
    contradictions: {
      runny_nose:
        "Runny nose points more toward a respiratory infection, though it does not rule malaria out.",
    },
    mustAsk: ["chills", "body_aches", "fever"],
  },
  {
    name: "Tension or stress-related headache",
    baseScore: 14,
    features: {
      headache: 24,
      stress: 26,
      screen_strain: 16,
      dehydration: 8,
    },
    contextBoosts: [
      {
        when: (state) =>
          state.modifiers.headacheCharacter === "pressure" ||
          state.modifiers.headacheCharacter === "heavy",
        amount: 14,
        reason: "Pressure or heaviness can fit tension-type headache.",
      },
      {
        when: (state) => state.modifiers.gradualOnset,
        amount: 6,
        reason:
          "Gradual onset is more compatible with tension patterns than sudden severe headache.",
      },
    ],
    contradictions: {
      fever: "Fever shifts attention toward infection rather than simple tension alone.",
      head_trauma: "Head injury needs an injury-focused pathway first.",
    },
    mustAsk: ["stress", "screen_strain", "dehydration"],
  },
  {
    name: "Migraine pattern",
    baseScore: 10,
    features: {
      headache: 22,
      vomiting: 12,
      light_sensitivity: 24,
      vision_change: 16,
    },
    contextBoosts: [
      {
        when: (state) =>
          state.modifiers.headacheCharacter === "throbbing" ||
          state.modifiers.headacheLocation === "one_side",
        amount: 18,
        reason: "Throbbing or one-sided headache can fit migraine patterns.",
      },
    ],
    contradictions: {
      fever: "Fever is not typical for migraine and needs infection checks.",
    },
    mustAsk: ["light_sensitivity", "vomiting", "vision_change"],
  },
  {
    name: "Meningitis or serious nervous-system infection",
    baseScore: 4,
    features: {
      headache: 12,
      fever: 20,
      neck_stiffness: 34,
      vomiting: 14,
      light_sensitivity: 20,
      confusion: 34,
    },
    mustAsk: ["neck_stiffness", "vomiting", "light_sensitivity", "confusion"],
  },
  {
    name: "Head injury complication",
    baseScore: 4,
    features: {
      headache: 16,
      head_trauma: 38,
      vomiting: 18,
      confusion: 24,
      vision_change: 12,
      weakness_or_numbness: 18,
    },
    mustAsk: ["vomiting", "confusion", "vision_change", "weakness_or_numbness"],
  },
  {
    name: "Gastrointestinal infection or stomach irritation",
    baseScore: 10,
    features: {
      nausea: 22,
      vomiting: 24,
      diarrhea: 26,
      fever: 12,
      abdominal_pain: 20,
    },
    mustAsk: ["diarrhea", "abdominal_pain", "fever"],
  },
];

const questions: QuestionDefinition[] = [
  {
    id: "headache_location",
    text: "Where is the headache strongest: front, one side, back, or around your eyes?",
    asksAbout: ["headache"],
    appliesWhen: (state) =>
      state.concepts.includes("headache") && !state.modifiers.headacheLocation,
    value: 88,
    rationale: "Location quickly separates sinus, migraine, tension, and injury patterns.",
  },
  {
    id: "headache_character",
    text: "What does it feel like: tight pressure, throbbing, sharp pain, heaviness, or something else?",
    asksAbout: ["headache"],
    appliesWhen: (state) =>
      state.concepts.includes("headache") && !state.modifiers.headacheCharacter,
    value: 82,
    rationale:
      "Pain character changes the ranking between tension, migraine, sinus, and other causes.",
  },
  {
    id: "headache_onset",
    text: "Did it start suddenly or build up gradually, and when did it begin?",
    asksAbout: ["headache"],
    appliesWhen: (state) =>
      state.concepts.includes("headache") && !state.modifiers.durationMentioned,
    value: 86,
    rationale:
      "Onset and timing determine whether Curable can safely narrow or should continue collecting.",
  },
  {
    id: "fever_headache_separator",
    text: "Because fever is involved, any neck stiffness, vomiting, light sensitivity, confusion, chills, or body aches?",
    asksAbout: [
      "neck_stiffness",
      "vomiting",
      "light_sensitivity",
      "confusion",
      "chills",
      "body_aches",
    ],
    appliesWhen: (state) => state.concepts.includes("headache") && state.concepts.includes("fever"),
    value: 96,
    rationale:
      "This separates common infection, malaria patterns, and serious nervous-system infection.",
  },
  {
    id: "trauma_headache_separator",
    text: "After the head injury, did you pass out, vomit, feel confused, notice vision changes, or feel weakness/numbness?",
    asksAbout: ["vomiting", "confusion", "vision_change", "weakness_or_numbness"],
    appliesWhen: (state) =>
      state.concepts.includes("headache") && state.concepts.includes("head_trauma"),
    value: 98,
    rationale:
      "Head injury changes the pathway and must be clarified before routine headache causes.",
  },
  {
    id: "stress_headache_separator",
    text: "Does rest, water, sleep, or stepping away from screens make it better?",
    asksAbout: ["stress", "screen_strain", "dehydration"],
    appliesWhen: (state) =>
      state.concepts.includes("headache") &&
      (state.concepts.includes("stress") || state.concepts.includes("screen_strain")),
    value: 72,
    rationale:
      "This tests tension, screen-strain, dehydration, and migraine-like patterns without a long checklist.",
  },
  {
    id: "respiratory_separator",
    text: "Any cough, sore throat, blocked nose, facial pressure, chills, or body aches?",
    asksAbout: ["cough", "sore_throat", "blocked_nose", "facial_pressure", "chills", "body_aches"],
    appliesWhen: (state) =>
      state.concepts.includes("fever") ||
      state.concepts.includes("runny_nose") ||
      state.concepts.includes("blocked_nose"),
    value: 78,
    rationale:
      "This separates respiratory infection, sinus pressure, flu-like illness, and malaria-like patterns.",
  },
  {
    id: "stomach_separator",
    text: "Any diarrhea, stomach pain, fever, or did it start after food or medication?",
    asksAbout: ["diarrhea", "abdominal_pain", "fever", "nausea"],
    appliesWhen: (state) =>
      state.concepts.includes("nausea") || state.concepts.includes("vomiting"),
    value: 76,
    rationale: "This separates stomach irritation, infection, food timing, and medication timing.",
  },
];

export function buildPatientState(input: {
  message: string;
  patient?: { age?: number; sex?: string };
  medications?: string[];
  country?: string;
}): PatientState {
  const rawText = input.message;
  const lower = rawText.toLowerCase();
  const concepts = new Set<ClinicalConcept>();

  for (const entry of conceptLexicon) {
    if (entry.terms.some((term) => lower.includes(term))) {
      concepts.add(entry.concept);
    }
  }

  const headacheLocation =
    lower.includes("front") || lower.includes("forehead")
      ? "front"
      : lower.includes("one side") || lower.includes("left") || lower.includes("right")
        ? "one_side"
        : lower.includes("back")
          ? "back"
          : lower.includes("around my eyes") || lower.includes("eyes")
            ? "around_eyes"
            : undefined;

  const headacheCharacter =
    lower.includes("pressure") || lower.includes("tight")
      ? "pressure"
      : lower.includes("throbbing") || lower.includes("pounding")
        ? "throbbing"
        : lower.includes("sharp")
          ? "sharp"
          : lower.includes("heavy") || lower.includes("heaviness")
            ? "heavy"
            : undefined;

  return {
    rawText,
    concepts: Array.from(concepts),
    demographics: input.patient,
    context: {
      country: input.country || "Nigeria",
      currentMedications: input.medications || [],
    },
    modifiers: {
      durationMentioned: /yesterday|today|hour|day|week|started|since|morning|night/i.test(rawText),
      suddenOnset: /sudden|suddenly|immediate|immediately/i.test(rawText),
      gradualOnset: /gradual|gradually|slowly|built up|building/i.test(rawText),
      severeLanguage: /severe|worst|unbearable|very bad|can't stand/i.test(lower),
      headacheLocation,
      headacheCharacter,
    },
  };
}

export function runDifferentialEngine(state: PatientState): DifferentialResult {
  const possibleConditions = conditions
    .map((condition) => scoreCondition(condition, state))
    .filter((condition) => condition.score > 8)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4);

  const safetySignals = getSafetySignals(state);
  const careLevel = safetySignals.length ? "urgent_now" : getCareLevel(state, possibleConditions);
  const uncertaintyGaps = getUncertaintyGaps(state, possibleConditions);
  const nextQuestion = chooseNextQuestion(state, possibleConditions, uncertaintyGaps, careLevel);

  return {
    concernSummary: summarizeConcern(state, possibleConditions),
    possibleConditions,
    uncertaintyGaps,
    nextQuestion,
    careLevel,
    safetySignals,
  };
}

function scoreCondition(condition: ConditionDefinition, state: PatientState): ConditionScore {
  let score = condition.baseScore;
  const support: string[] = [];
  const weakens: string[] = [];

  for (const concept of state.concepts) {
    const weight = condition.features[concept] || 0;
    if (weight > 0) {
      score += weight;
      support.push(`${labelConcept(concept)} supports this pattern.`);
    }

    const contradiction = condition.contradictions?.[concept];
    if (contradiction) {
      score -= 10;
      weakens.push(contradiction);
    }
  }

  for (const boost of condition.contextBoosts || []) {
    if (boost.when(state)) {
      score += boost.amount;
      support.push(boost.reason);
    }
  }

  if (state.modifiers.severeLanguage && condition.name.includes("serious")) {
    score += 8;
    support.push("Severe wording increases the need to keep serious causes visible.");
  }

  const missingMustAsk = (condition.mustAsk || []).filter(
    (concept) => !state.concepts.includes(concept),
  );
  if (missingMustAsk.length) {
    weakens.push(`Still need: ${missingMustAsk.slice(0, 3).map(labelConcept).join(", ")}.`);
  }

  return {
    name: condition.name,
    score: Math.min(95, Math.max(5, Math.round(score))),
    matchLabel: labelForEngineScore(score),
    support: support.slice(0, 3),
    weakens: weakens.slice(0, 3),
  };
}

function chooseNextQuestion(
  state: PatientState,
  topConditions: ConditionScore[],
  uncertaintyGaps: string[],
  careLevel: DifferentialResult["careLevel"],
) {
  if (careLevel === "urgent_now" || !uncertaintyGaps.length) return null;

  const askedConcepts = new Set(state.concepts);
  const candidates = questions
    .filter((question) => question.appliesWhen(state, topConditions))
    .filter((question) => question.asksAbout.some((concept) => !askedConcepts.has(concept)))
    .sort((a, b) => b.value - a.value);

  return candidates[0] || null;
}

function getUncertaintyGaps(state: PatientState, topConditions: ConditionScore[]) {
  const gaps = new Set<string>();
  const names = topConditions.map((condition) => condition.name.toLowerCase()).join(" ");

  if (state.concepts.includes("headache")) {
    if (!state.modifiers.headacheLocation) gaps.add("headache location");
    if (!state.modifiers.headacheCharacter) gaps.add("pain character");
    if (!state.modifiers.durationMentioned) gaps.add("onset and duration");
  }

  if (state.concepts.includes("headache") && state.concepts.includes("fever")) {
    for (const concept of [
      "neck_stiffness",
      "vomiting",
      "light_sensitivity",
      "confusion",
      "chills",
      "body_aches",
    ] as ClinicalConcept[]) {
      if (!state.concepts.includes(concept)) gaps.add(labelConcept(concept));
    }
  }

  if (names.includes("malaria")) {
    for (const concept of ["chills", "body_aches"] as ClinicalConcept[]) {
      if (!state.concepts.includes(concept)) gaps.add(labelConcept(concept));
    }
  }

  if (names.includes("sinus")) {
    for (const concept of ["blocked_nose", "facial_pressure"] as ClinicalConcept[]) {
      if (!state.concepts.includes(concept)) gaps.add(labelConcept(concept));
    }
  }

  if (state.concepts.includes("vomiting") || state.concepts.includes("nausea")) {
    for (const concept of ["diarrhea", "abdominal_pain", "fever"] as ClinicalConcept[]) {
      if (!state.concepts.includes(concept)) gaps.add(labelConcept(concept));
    }
  }

  return Array.from(gaps).slice(0, 6);
}

function getSafetySignals(state: PatientState) {
  const signals: string[] = [];
  const has = (concept: ClinicalConcept) => state.concepts.includes(concept);

  if (has("chest_pain") && has("shortness_of_breath")) {
    signals.push("chest pain with breathing difficulty");
  }

  if (has("headache") && has("fever") && (has("neck_stiffness") || has("confusion"))) {
    signals.push("headache and fever with nervous-system warning symptoms");
  }

  if (
    has("headache") &&
    has("head_trauma") &&
    (has("vomiting") || has("confusion") || has("vision_change"))
  ) {
    signals.push("headache after injury with concerning associated symptoms");
  }

  if (state.modifiers.suddenOnset && state.modifiers.severeLanguage && has("headache")) {
    signals.push("sudden severe headache");
  }

  return signals;
}

function getCareLevel(
  state: PatientState,
  topConditions: ConditionScore[],
): DifferentialResult["careLevel"] {
  if (topConditions[0]?.score >= 70 && state.modifiers.durationMentioned)
    return "self_care_guidance";
  return "continue_questions";
}

function summarizeConcern(state: PatientState, topConditions: ConditionScore[]) {
  const concepts = state.concepts.map(labelConcept).join(", ") || "health concern";
  const top = topConditions[0]?.name;
  return top
    ? `Patient reported ${concepts}; strongest current pattern is ${top}, while Curable is still narrowing key details.`
    : `Patient reported ${concepts}; Curable needs more detail before comparing possible explanations.`;
}

function labelForEngineScore(score: number): ConditionScore["matchLabel"] {
  if (score >= 76) return "Strong pattern match";
  if (score >= 52) return "Possible match";
  if (score >= 30) return "Partial match";
  return "Needs more information";
}

function labelConcept(concept: ClinicalConcept) {
  return concept.replace(/_/g, " ");
}
