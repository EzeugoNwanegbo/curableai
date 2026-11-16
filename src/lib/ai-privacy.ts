/** Local filtering only. Never send text to another service to redact it. */
export const AI_PRIVACY_VERSION = "local-filter-v1";

export interface IdentityHints {
  names?: (string | null | undefined)[];
  identifiers?: (string | null | undefined)[];
  locations?: (string | null | undefined)[];
}

export interface AiTextMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

const marker = "[identifying detail removed]";
const genericNames = new Set([
  "patient",
  "student",
  "doctor",
  "curable",
  "user",
  "unknown",
  "self-added",
]);
// These single words also have common clinical or grammatical meanings.
const ambiguousNames = new Set(["may", "will", "hope", "faith", "rose", "grace"]);

function normalize(text: string) {
  return text.normalize("NFKC").replace(/[\u200b-\u200f\u202a-\u202e\u2060-\u206f\ufeff]/g, "");
}

function escapeRegex(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function exactMatcher(value: string, caseSensitive = false) {
  const expression = value.trim().split(/\s+/).map(escapeRegex).join("[\\s\\p{P}]+");
  return new RegExp(
    `(?<![\\p{L}\\p{N}])${expression}(?![\\p{L}\\p{N}])`,
    caseSensitive ? "gu" : "giu",
  );
}

const identityMemoryLabel =
  /^(?:(?:patient|student|doctor|supervising|validating|preferred)\s+)?(?:full\s+name|first\s+name|last\s+name|surname|name|doctor|contact(?:\s+details)?|e-?mail|phone(?:\s+number)?|mobile|address|location|occupation|date\s+of\s+birth|dob|student\s+(?:id|number)|matric(?:ulation)?(?:\s+(?:id|number))?|hospital\s+(?:id|number)|record\s+id)$/i;

export function isIdentityMemory(label: string) {
  return identityMemoryLabel.test(label.trim());
}

/** Useful for catching names or contacts repeated elsewhere, without forwarding these rows. */
export function memoryIdentityHints(memories: { label: string; details: string }[]): IdentityHints {
  const names: string[] = [];
  const identifiers: string[] = [];
  const locations: string[] = [];
  for (const row of memories) {
    if (!isIdentityMemory(row.label)) continue;
    if (/^(?:full|first|last)?\s*name$|surname/i.test(row.label)) names.push(row.details);
    else if (/location|address/i.test(row.label)) locations.push(row.details);
    else if (/email|phone|mobile|(?:student|hospital|record)\s+(?:id|number)/i.test(row.label))
      identifiers.push(row.details);
    // A supervising-doctor memory includes labeled fields, not just a person's name.
    for (const match of row.details.matchAll(/^(?:Doctor|Name):\s*(.+)$/gim)) names.push(match[1]);
  }
  return { names, identifiers, locations };
}

export function createPrivacyFilter(hints: IdentityHints = {}) {
  const known: { value: string; sensitiveCase: boolean }[] = [];
  for (const raw of [...(hints.identifiers || []), ...(hints.locations || [])]) {
    if (raw?.trim()) known.push({ value: normalize(raw.trim()), sensitiveCase: false });
  }
  for (const raw of hints.names || []) {
    if (!raw?.trim()) continue;
    const name = normalize(raw.trim()).replace(/^(?:Dr\.?|Doctor|Mr\.?|Mrs\.?|Ms\.?)\s+/i, "");
    const variants = new Set([name, name.normalize("NFD").replace(/\p{M}/gu, "")]);
    for (const variant of variants) {
      if (!genericNames.has(variant.toLowerCase()))
        known.push({ value: variant, sensitiveCase: ambiguousNames.has(variant.toLowerCase()) });
      for (const part of variant.split(/[\s,]+/)) {
        if (part.length < 3 || genericNames.has(part.toLowerCase())) continue;
        known.push({ value: part, sensitiveCase: ambiguousNames.has(part.toLowerCase()) });
      }
    }
  }
  // Longer matches first prevents a first-name replacement leaving the surname behind.
  const matchers = known
    .sort((a, b) => b.value.length - a.value.length)
    .map(({ value, sensitiveCase }) => exactMatcher(value, sensitiveCase));

  function text(input: string): string {
    if (typeof input !== "string") throw new Error("Could not prepare private AI context.");
    let result = normalize(input);
    // Remove entire identity fields rather than guessing which part is safe to retain.
    result = result.replace(
      /^(?:[\t ]*(?:[-*]\s*)?)(?:source|record|external\s+record\s+id|(?:(?:full|first|last)\s+)?name|surname|e-?mail|phone|mobile|address|location|occupation|(?:supervising|validating)\s+doctor)\s*:[^\n]*/gim,
      marker,
    );
    result = result.replace(
      /\b(?:my\s+name\s+is|i\s+am\s+called|i['’]?m\s+called|call\s+me)\s+([\p{L}\p{M}'’ -]+?)(?=\s+(?:and|but|with|i|my|have|has|feel|am|was)\b|[.,;!?\n]|$)/giu,
      marker,
    );
    result = result.replace(
      /\b[Ii](?:['’]m| am)\s+\p{Lu}[\p{L}\p{M}'’-]*(?:[ \t]+\p{Lu}[\p{L}\p{M}'’-]*){0,3}(?=\s+(?:and|but|with|I|my|have|feel)\b|[.,;!?\n]|$)/gu,
      marker,
    );
    result = result.replace(
      /\b(?:[Dd]r\.?|[Dd]octor|[Pp]rofessor|[Mm]r\.?|[Mm]rs\.?|[Mm]s\.?)\s+\p{Lu}[\p{L}\p{M}'’-]*(?:[ \t]+\p{Lu}[\p{L}\p{M}'’-]*){0,3}/gu,
      "the clinician",
    );
    result = result.replace(
      /\b(?:full\s+name|patient\s+name|student\s+name|next\s+of\s+kin)\s*[:=]\s*[^\n,;.!?]+/gi,
      marker,
    );
    result = result.replace(/[\p{L}\p{N}._%+-]+@[\p{L}\p{N}.-]+\.[\p{L}]{2,}/gu, marker);
    result = result.replace(
      /(?:https?:\/\/|www\.)[^\s<>"']+|data:(?:image|application)\/[^\s]+/gi,
      marker,
    );
    result = result.replace(
      /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi,
      marker,
    );
    result = result.replace(
      /\b(?:student\s*(?:id|number|no\.?)|matric(?:ulation)?\s*(?:id|number|no\.?)?|hospital\s*(?:id|number|no\.?)|medical\s*record\s*(?:id|number|no\.?)|patient\s*id|curable\s*id|record\s*id|mrn|nin|bvn|passport\s*(?:number|no\.?)?)\s*[:=#-]?\s*[a-z0-9][a-z0-9/_-]{2,}/gi,
      marker,
    );
    result = result.replace(
      /\b(?:date\s+of\s+birth|birth\s*date|dob)\s*[:=]?\s*(?:\d{1,4}[-/.]\d{1,2}[-/.]\d{1,4}|\d{1,2}\s+[a-z]+\s+\d{4}|[a-z]+\s+\d{1,2},?\s+\d{4})/gi,
      marker,
    );
    result = result.replace(/(?<![\p{L}\p{N}])\+?\d[\d ().-]{7,}\d(?![\p{L}\p{N}])/gu, (value) => {
      const digits = value.replace(/\D/g, "");
      return digits.length >= 10 && digits.length <= 15 && !/^\d{4}-\d{2}-\d{2}$/.test(value)
        ? marker
        : value;
    });
    result = result.replace(
      /\b(?:home\s+address|residential\s+address|i\s+live\s+at|my\s+address\s+is)\s*[:=]?\s*[^\n;!?]+/gi,
      marker,
    );
    result = result.replace(
      /\b\d{1,6}[ \t]+(?:[\p{L}\p{N}'’-]+[ \t]+){0,5}(?:road|street|avenue|lane|close|crescent|drive)\b/giu,
      marker,
    );
    result = result.replace(/\b(?:VU|PT|MRN)[-/]?\d{3,}(?:[-/][a-z0-9]+)*\b/gi, marker);
    result = result.replace(
      /\b(?:Bearer\s+\S+|sk-(?:proj-)?[a-z0-9_-]{12,}|eyJ[a-z0-9_-]+\.[a-z0-9_-]+\.[a-z0-9_-]+)\b/gi,
      marker,
    );
    for (const matcher of matchers) result = result.replace(matcher, marker);
    return result;
  }

  function messages(input: readonly AiTextMessage[]): AiTextMessage[] {
    return input.map((message) => {
      if (
        !["system", "user", "assistant"].includes(message.role) ||
        typeof message.content !== "string"
      )
        throw new Error("Unsupported content was blocked before the AI request.");
      // Copy only these fields: no names, user IDs, metadata, images or attachments.
      return { role: message.role, content: text(message.content) };
    });
  }

  return { text, messages };
}

export type PrivacyFilter = ReturnType<typeof createPrivacyFilter>;

export const AI_PRIVACY_INSTRUCTION = `\nPrivacy: Identity details have been removed locally. Refer to the person as "you" or "the patient". Do not ask for names, contact details, student numbers or addresses. Do not infer or reconstruct removed details. Removed identity is not missing clinical history.`;
