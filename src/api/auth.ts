import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const patientProfileSchema = z.object({
  accessToken: z.string().min(1),
  fullName: z.string().optional(),
  age: z.number().optional(),
  sex: z.string().optional(),
  bloodGroup: z.string().optional(),
  genotype: z.string().optional(),
  occupation: z.string().optional(),
  allergies: z.array(z.string()).optional(),
  conditions: z.array(z.string()).optional(),
});

function fallbackName(email?: string | null) {
  return email?.split("@")[0]?.replace(/[._-]+/g, " ") || "Curable Patient";
}

async function upsertProfileMemoryFact(
  client: any,
  patientId: string,
  label: string,
  details?: string,
) {
  const cleaned = details?.trim();
  if (!cleaned) return;

  const { data: existing } = await client
    .from("memory_snapshots")
    .select("id")
    .eq("patient_id", patientId)
    .eq("label", label)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing?.id) {
    const { error } = await client
      .from("memory_snapshots")
      .update({
        layer: 1,
        details: cleaned,
      })
      .eq("id", existing.id);

    if (error) throw error;
    return;
  }

  const { error } = await client.from("memory_snapshots").insert({
    patient_id: patientId,
    label,
    layer: 1,
    details: cleaned,
  });

  if (error) throw error;
}

async function saveStructuredProfileMemory(
  client: any,
  patientId: string,
  input: { genotype?: string; occupation?: string },
) {
  await Promise.all([
    upsertProfileMemoryFact(client, patientId, "Genotype", input.genotype),
    upsertProfileMemoryFact(client, patientId, "Occupation", input.occupation),
  ]);
}

export const ensurePatientAccount = createServerFn({
  method: "POST",
  validator: patientProfileSchema,
}).handler(async ({ data }) => {
  const { supabase, supabaseAdmin } = await import("@/lib/supabase");
  const client = supabaseAdmin || supabase;

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser(data.accessToken);

  if (userError || !user) {
    throw new Error("Your session could not be verified. Please sign in again.");
  }

  const metadata = user.user_metadata || {};
  const fullName = data.fullName?.trim() || metadata.full_name || fallbackName(user.email);
  const age = Number.isFinite(data.age) ? Number(data.age) : Number(metadata.age || 0);
  const sex = data.sex?.trim() || metadata.sex || "";
  const bloodGroup = data.bloodGroup?.trim() || metadata.blood_group || "";
  const genotype = data.genotype?.trim() || metadata.genotype || "";
  const occupation = data.occupation?.trim() || metadata.occupation || "";
  const allergies = data.allergies?.length
    ? data.allergies
    : Array.isArray(metadata.allergies)
      ? metadata.allergies
      : [];
  const conditions = data.conditions?.length
    ? data.conditions
    : Array.isArray(metadata.conditions)
      ? metadata.conditions
      : [];

  const { data: existing, error: findError } = await client
    .from("patients")
    .select("id, full_name, age, sex, blood_group, allergies, conditions, pinned_by_doctor")
    .eq("id", user.id)
    .maybeSingle();

  if (findError) throw findError;

  if (existing) {
    const updates: Record<string, unknown> = {};

    if (fullName && existing.full_name !== fullName) updates.full_name = fullName;
    if (age && existing.age !== age) updates.age = age;
    if (sex && existing.sex !== sex) updates.sex = sex;
    if (bloodGroup && existing.blood_group !== bloodGroup) updates.blood_group = bloodGroup;
    if (
      allergies.length &&
      JSON.stringify(existing.allergies || []) !== JSON.stringify(allergies)
    ) {
      updates.allergies = allergies;
    }
    if (
      conditions.length &&
      JSON.stringify(existing.conditions || []) !== JSON.stringify(conditions)
    ) {
      updates.conditions = conditions;
    }

    if (Object.keys(updates).length) {
      const { data: updated, error: updateError } = await client
        .from("patients")
        .update(updates)
        .eq("id", user.id)
        .select("id, full_name, age, sex, blood_group, allergies, conditions, pinned_by_doctor")
        .single();

      if (updateError) throw updateError;
      await saveStructuredProfileMemory(client, user.id, { genotype, occupation });
      return updated;
    }

    await saveStructuredProfileMemory(client, user.id, { genotype, occupation });
    return existing;
  }

  const { data: inserted, error: insertError } = await client
    .from("patients")
    .upsert(
      {
        id: user.id,
        full_name: fullName,
        age: age || 0,
        sex,
        blood_group: bloodGroup,
        allergies,
        conditions,
        pinned_by_doctor: "",
      },
      { onConflict: "id" },
    )
    .select("id, full_name, age, sex, blood_group, allergies, conditions, pinned_by_doctor")
    .single();

  if (insertError) throw insertError;
  await saveStructuredProfileMemory(client, user.id, { genotype, occupation });

  return inserted;
});

export const getPatientProfileState = createServerFn({
  method: "GET",
  validator: z.object({
    patientId: z.string().uuid(),
  }),
}).handler(async ({ data: { patientId } }) => {
  const { supabase, supabaseAdmin } = await import("@/lib/supabase");
  const client = supabaseAdmin || supabase;

  const [{ data: patient, error: patientError }, { data: memories, error: memoryError }] =
    await Promise.all([
      client
        .from("patients")
        .select("id, full_name, age, sex, blood_group, allergies, conditions, pinned_by_doctor")
        .eq("id", patientId)
        .single(),
      client
        .from("memory_snapshots")
        .select("*")
        .eq("patient_id", patientId)
        .order("created_at", { ascending: false }),
    ]);

  if (patientError) throw patientError;
  if (memoryError) throw memoryError;

  return {
    patient,
    memories: memories || [],
  };
});

export const updatePatientMemoryFact = createServerFn({
  method: "POST",
  validator: z.object({
    id: z.string().uuid(),
    label: z.string().min(1),
    details: z.string().min(1),
  }),
}).handler(async ({ data }) => {
  const { supabase, supabaseAdmin } = await import("@/lib/supabase");
  const client = supabaseAdmin || supabase;

  const { data: updated, error } = await client
    .from("memory_snapshots")
    .update({
      label: data.label,
      details: data.details,
    })
    .eq("id", data.id)
    .select("*")
    .single();

  if (error) throw error;
  return updated;
});

export const deletePatientMemoryFact = createServerFn({
  method: "POST",
  validator: z.object({
    id: z.string().uuid(),
  }),
}).handler(async ({ data: { id } }) => {
  const { supabase, supabaseAdmin } = await import("@/lib/supabase");
  const client = supabaseAdmin || supabase;

  const { error } = await client.from("memory_snapshots").delete().eq("id", id);
  if (error) throw error;

  return { ok: true };
});
