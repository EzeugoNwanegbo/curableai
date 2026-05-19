import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const medicationSchema = z.object({
  patientId: z.string().uuid().optional(),
  name: z.string().min(1),
  dosage: z.string().optional().default(""),
  frequency: z.string().optional().default(""),
  time: z.string().optional().default(""),
  purpose: z.string().optional().default(""),
  source: z.enum(["hospital", "patient"]).optional().default("patient"),
  sideEffects: z.array(z.string()).optional().default([]),
  adherence: z.number().min(0).max(1).optional().default(1),
  prescriber: z.string().optional().default("Self-added"),
});

function mapMedicationRow(m: any) {
  return {
    id: m.id,
    name: m.name,
    dosage: m.dosage,
    frequency: m.frequency,
    time: m.time,
    purpose: m.purpose,
    source: m.source,
    sideEffects: m.side_effects || [],
    adherence: Number(m.adherence ?? 1),
    prescriber: m.prescriber,
  };
}

export async function fetchMedicationsForPatient(patientId: string) {
  const { supabase, supabaseAdmin } = await import("@/lib/supabase");
  const client = supabaseAdmin || supabase;

  const { data, error } = await client
    .from("medications")
    .select("*")
    .eq("patient_id", patientId)
    .order("created_at", { ascending: true });

  if (error) {
    console.warn("Medication fetch failed; returning an empty medication list:", error.message);
    return [];
  }

  if (data?.length) {
    return data.map(mapMedicationRow);
  }

  return [];
}

export const getAuthenticatedPatientMedications = createServerFn({
  method: "GET",
  validator: z.object({
    patientId: z.string().uuid(),
  }),
}).handler(async ({ data: { patientId } }) => {
  return fetchMedicationsForPatient(patientId);
});

export const addPatientMedication = createServerFn({
  method: "POST",
  validator: medicationSchema,
}).handler(async ({ data }) => {
  const { supabase, supabaseAdmin } = await import("@/lib/supabase");
  const client = supabaseAdmin || supabase;

  if (!data.patientId) {
    throw new Error("Please sign in before adding medication.");
  }

  const { data: inserted, error } = await client
    .from("medications")
    .insert({
      patient_id: data.patientId,
      name: data.name,
      dosage: data.dosage,
      frequency: data.frequency,
      time: data.time,
      purpose: data.purpose,
      source: data.source,
      side_effects: data.sideEffects,
      adherence: data.adherence,
      prescriber: data.prescriber,
    })
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return mapMedicationRow(inserted);
});
