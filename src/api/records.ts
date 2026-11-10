import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
export const loadSampleClinicRecord = createServerFn({ method: "POST" })
  .inputValidator(z.object({ confirmed: z.literal(true) }))
  .handler(async () => {
    const { getAuthenticatedClient } = await import("@/lib/supabase-server");
    const { sampleClinicRecord, formatClinicRecord } = await import("@/lib/clinic-records");
    const client = await getAuthenticatedClient();
    const {
      data: { user },
    } = await client.auth.getUser();
    if (!user || user.app_metadata?.role === "doctor")
      throw new Error("Sign in as a student to load sample records.");
    const label = "Fictional clinic record · investor demo";
    const { data: existing, error: lookupError } = await client
      .from("memory_snapshots")
      .select("id")
      .eq("patient_id", user.id)
      .eq("label", label)
      .limit(1)
      .maybeSingle();
    if (lookupError) throw lookupError;
    const row = {
      patient_id: user.id,
      label,
      layer: 1,
      details: formatClinicRecord(sampleClinicRecord),
    };
    const result = existing
      ? await client.from("memory_snapshots").update(row).eq("id", existing.id)
      : await client.from("memory_snapshots").insert(row);
    if (result.error) throw result.error;
    return {
      source: "sample",
      notice: "Fictional clinic record added. No university EMR is connected.",
    };
  });
