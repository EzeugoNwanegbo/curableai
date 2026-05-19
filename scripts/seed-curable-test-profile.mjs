import fs from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";

function parseEnv(text) {
  const env = {};

  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const separator = trimmed.indexOf("=");
    if (separator === -1) continue;

    const key = trimmed.slice(0, separator);
    const value = trimmed.slice(separator + 1).replace(/^['"]|['"]$/g, "");
    env[key] = value;
  }

  return env;
}

const env = parseEnv(await fs.readFile(new URL("../.env", import.meta.url), "utf8"));
const supabaseUrl = env.VITE_SUPABASE_URL || env.SUPABASE_URL;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  throw new Error("Missing SUPABASE_URL/VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.");
}

const supabase = createClient(supabaseUrl, serviceKey);
const suffix = String(Date.now()).slice(-6);
const password = "curable123";
const patientEmail = `curable.patient.aisha.${suffix}@curable.test`;
const doctorEmail = `curable.doctor.musa.${suffix}@curable.test`;

const { data: patientUser, error: patientError } = await supabase.auth.admin.createUser({
  email: patientEmail,
  password,
  email_confirm: true,
  user_metadata: {
    role: "patient",
    full_name: "Aisha Bello",
    age: 34,
    sex: "Female",
    blood_group: "O+",
    allergies: ["Penicillin"],
    conditions: ["Hypertension", "Seasonal allergies"],
  },
});

if (patientError) throw patientError;

const { error: doctorError } = await supabase.auth.admin.createUser({
  email: doctorEmail,
  password,
  email_confirm: true,
  user_metadata: {
    role: "doctor",
    full_name: "Dr. Musa Bello",
  },
});

if (doctorError) throw doctorError;

const patientId = patientUser.user.id;

const { error: patientProfileError } = await supabase.from("patients").upsert({
  id: patientId,
  full_name: "Aisha Bello",
  age: 34,
  sex: "Female",
  blood_group: "O+",
  allergies: ["Penicillin"],
  conditions: ["Hypertension", "Seasonal allergies"],
  pinned_by_doctor:
    "Penicillin allergy recorded. Patient uses amlodipine for blood pressure; avoid casual medication changes without review.",
});

if (patientProfileError) throw patientProfileError;

const { error: medicationError } = await supabase.from("medications").insert([
  {
    patient_id: patientId,
    name: "Amlodipine",
    dosage: "5 mg",
    frequency: "Once daily",
    time: "Morning",
    purpose: "Blood pressure control",
    source: "hospital",
    side_effects: ["ankle swelling if dose missed or changed"],
    adherence: 0.92,
    prescriber: "Dr. Musa Bello",
  },
  {
    patient_id: patientId,
    name: "Loratadine",
    dosage: "10 mg",
    frequency: "As needed",
    time: "Evening",
    purpose: "Seasonal allergy symptoms",
    source: "patient",
    side_effects: ["mild drowsiness"],
    adherence: 0.7,
    prescriber: "Self-added",
  },
]);

if (medicationError) throw medicationError;

const { error: memoryError } = await supabase.from("memory_snapshots").insert([
  {
    patient_id: patientId,
    label: "Location context",
    layer: 1,
    details: "Lives in Lagos, Nigeria; malaria exposure context can be relevant when fever is reported.",
  },
  {
    patient_id: patientId,
    label: "Medication caution pattern",
    layer: 2,
    details: "Reports stomach upset when taking painkillers without food; ask timing before suggesting self-care.",
  },
  {
    patient_id: patientId,
    label: "Recent respiratory allergy pattern",
    layer: 3,
    details: "Two weeks ago reported sneezing and itchy eyes during dusty weather, improved with loratadine.",
  },
]);

if (memoryError) throw memoryError;

console.log(
  JSON.stringify(
    {
      patientEmail,
      doctorEmail,
      password,
      patientId,
    },
    null,
    2
  )
);
