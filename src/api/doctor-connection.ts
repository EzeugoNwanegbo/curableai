import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const DOCTOR_MEMORY_LABEL = "Supervising doctor";

export interface DoctorConnection {
  id?: string;
  patientId: string;
  doctorName: string;
  doctorEmail?: string;
  clinicName?: string;
  status: "active";
  source: "patient_doctors" | "memory";
}

const doctorConnectionInput = z.object({
  patientId: z.string().uuid(),
  doctorName: z.string().min(2),
  doctorEmail: z.string().optional(),
  clinicName: z.string().optional(),
});

function cleanText(value?: string | null) {
  return String(value || "").trim();
}

function isMissingTableError(error: any) {
  const message = String(error?.message || "").toLowerCase();
  return error?.code === "42P01" || message.includes("does not exist") || message.includes("schema cache");
}

function formatDoctorMemoryDetails(input: {
  doctorName: string;
  doctorEmail?: string;
  clinicName?: string;
}) {
  return [
    `Doctor: ${input.doctorName}`,
    input.doctorEmail ? `Email: ${input.doctorEmail}` : "",
    input.clinicName ? `Clinic: ${input.clinicName}` : "",
    "Use: Can validate Curable reports and open consultation when the patient requests it.",
  ]
    .filter(Boolean)
    .join("\n");
}

function parseDoctorMemory(details?: string | null) {
  const lines = String(details || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const findValue = (prefix: string) =>
    cleanText(lines.find((line) => line.toLowerCase().startsWith(prefix.toLowerCase()))?.slice(prefix.length));

  const doctorName = findValue("Doctor:") || cleanText(lines[0]?.replace(/^Doctor:\s*/i, ""));
  const doctorEmail = findValue("Email:");
  const clinicName = findValue("Clinic:");

  return {
    doctorName,
    doctorEmail,
    clinicName,
  };
}

export async function readDoctorConnection(client: any, patientId: string): Promise<DoctorConnection | null> {
  try {
    const { data, error } = await client
      .from("patient_doctors")
      .select("patient_id, doctor_name, doctor_email, clinic_name, status")
      .eq("patient_id", patientId)
      .eq("status", "active")
      .maybeSingle();

    if (error) throw error;

    if (data?.doctor_name) {
      return {
        patientId: data.patient_id,
        doctorName: data.doctor_name,
        doctorEmail: data.doctor_email || "",
        clinicName: data.clinic_name || "",
        status: "active",
        source: "patient_doctors",
      };
    }
  } catch (error) {
    if (!isMissingTableError(error)) {
      console.warn("patient_doctors lookup failed; falling back to profile memory.", error);
    }
  }

  const { data: memory, error: memoryError } = await client
    .from("memory_snapshots")
    .select("id, patient_id, details")
    .eq("patient_id", patientId)
    .eq("label", DOCTOR_MEMORY_LABEL)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (memoryError) {
    console.warn("Doctor memory lookup failed:", memoryError.message);
    return null;
  }

  const parsed = parseDoctorMemory(memory?.details);
  if (!memory?.id || !parsed.doctorName) return null;

  return {
    id: memory.id,
    patientId,
    doctorName: parsed.doctorName,
    doctorEmail: parsed.doctorEmail,
    clinicName: parsed.clinicName,
    status: "active",
    source: "memory",
  };
}

async function saveDoctorMemory(client: any, input: z.infer<typeof doctorConnectionInput>) {
  const details = formatDoctorMemoryDetails(input);
  const { data: existing } = await client
    .from("memory_snapshots")
    .select("id")
    .eq("patient_id", input.patientId)
    .eq("label", DOCTOR_MEMORY_LABEL)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing?.id) {
    const { error } = await client
      .from("memory_snapshots")
      .update({
        layer: 1,
        details,
      })
      .eq("id", existing.id);

    if (error) throw error;
    return;
  }

  const { error } = await client.from("memory_snapshots").insert({
    patient_id: input.patientId,
    label: DOCTOR_MEMORY_LABEL,
    layer: 1,
    details,
  });

  if (error) throw error;
}

export async function saveDoctorConnectionRecord(client: any, input: z.infer<typeof doctorConnectionInput>) {
  const doctorName = cleanText(input.doctorName);
  const doctorEmail = cleanText(input.doctorEmail).toLowerCase();
  const clinicName = cleanText(input.clinicName);
  const cleaned = { patientId: input.patientId, doctorName, doctorEmail, clinicName };

  if (!doctorName) throw new Error("Add the doctor's name.");

  try {
    const { error } = await client.from("patient_doctors").upsert(
      {
        patient_id: cleaned.patientId,
        doctor_name: cleaned.doctorName,
        doctor_email: cleaned.doctorEmail,
        clinic_name: cleaned.clinicName,
        status: "active",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "patient_id" }
    );

    if (error) throw error;
  } catch (error) {
    if (!isMissingTableError(error)) {
      console.warn("patient_doctors save failed; using profile memory fallback.", error);
    }
  }

  await saveDoctorMemory(client, cleaned);
  return readDoctorConnection(client, cleaned.patientId);
}

export const getPatientDoctorConnection = createServerFn({
  method: "GET",
  validator: z.object({
    patientId: z.string().uuid(),
  }),
}).handler(async ({ data: { patientId } }) => {
  const { supabase, supabaseAdmin } = await import("@/lib/supabase");
  const client = supabaseAdmin || supabase;
  return readDoctorConnection(client, patientId);
});

export const savePatientDoctorConnection = createServerFn({
  method: "POST",
  validator: doctorConnectionInput,
}).handler(async ({ data }) => {
  const { supabase, supabaseAdmin } = await import("@/lib/supabase");
  const client = supabaseAdmin || supabase;
  return saveDoctorConnectionRecord(client, data);
});

export const removePatientDoctorConnection = createServerFn({
  method: "POST",
  validator: z.object({
    patientId: z.string().uuid(),
  }),
}).handler(async ({ data: { patientId } }) => {
  const { supabase, supabaseAdmin } = await import("@/lib/supabase");
  const client = supabaseAdmin || supabase;

  try {
    await client.from("patient_doctors").delete().eq("patient_id", patientId);
  } catch (error) {
    if (!isMissingTableError(error)) {
      console.warn("patient_doctors delete failed:", error);
    }
  }

  const { data: memories } = await client
    .from("memory_snapshots")
    .select("id")
    .eq("patient_id", patientId)
    .eq("label", DOCTOR_MEMORY_LABEL);

  const ids = (memories || []).map((memory: any) => memory.id).filter(Boolean);
  if (ids.length) {
    const { error } = await client.from("memory_snapshots").delete().in("id", ids);
    if (error) throw error;
  }

  return { ok: true };
});
