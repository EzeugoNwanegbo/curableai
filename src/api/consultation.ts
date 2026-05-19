import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { readDoctorConnection } from "@/api/doctor-connection";

async function updateDoctorReportStatus(client: any, reviewId: string, status: string) {
  try {
    await client.from("doctor_reports").update({ status }).eq("review_id", reviewId);
  } catch (err) {
    console.warn("Doctor report status update failed:", err);
  }
}

async function insertDoctorReviewCard({
  client,
  patientId,
  reviewId,
  outcome,
  title,
  content,
  doctorNote,
  consultationId,
  doctorName,
}: {
  client: any;
  patientId: string;
  reviewId: string;
  outcome: "validated" | "consultation_started";
  title: string;
  content: string;
  doctorNote?: string;
  consultationId?: string;
  doctorName?: string;
}) {
  const metadata = {
    type: "doctor_review_card",
    outcome,
    reviewId,
    consultationId: consultationId || null,
    doctorName: doctorName || "Doctor",
    title,
    doctorNote: doctorNote || "",
    actionLabel: outcome === "consultation_started" ? "Enter consultation" : "",
    createdAt: new Date().toISOString(),
  };

  const message = {
    patient_id: patientId,
    role: "doctor",
    content,
    metadata,
  };

  const { error } = await client.from("messages").insert(message);

  if (!error) return;

  const fallback = await client.from("messages").insert({
    ...message,
    role: "ai",
  });

  if (fallback.error) {
    console.warn("Doctor review card insert failed:", fallback.error.message);
  }
}

export const validateReviewGuidance = createServerFn({
  method: "POST",
  validator: z.object({
    reviewId: z.string(),
    doctorNote: z.string().optional(),
  }),
}).handler(async ({ data: { reviewId, doctorNote } }) => {
  const { supabase, supabaseAdmin } = await import("@/lib/supabase");
  const client = supabaseAdmin || supabase;

  const { data: review, error: reviewError } = await client
    .from("review_queue")
    .select("id, patient_id, summary")
    .eq("id", reviewId)
    .single();

  if (reviewError) throw reviewError;
  const doctorConnection = await readDoctorConnection(client, review.patient_id);
  const doctorName = doctorConnection?.doctorName || "Doctor";

  const note =
    doctorNote?.trim() ||
    "I reviewed the report and agree that Curable handled this safely. Continue following the guidance already given, and seek urgent care if symptoms become severe or worrying.";

  await insertDoctorReviewCard({
    client,
    patientId: review.patient_id,
    reviewId: review.id,
    outcome: "validated",
    title: "Doctor validated Curable guidance",
    content: `${doctorName} reviewed your report and agreed with Curable's guidance. ${note}`,
    doctorNote: note,
    doctorName,
  });

  const { error: updateError } = await client
    .from("review_queue")
    .update({ status: "reviewed" })
    .eq("id", review.id);

  if (updateError) {
    console.warn("Review queue status did not accept reviewed; validation card was still created.");
  }

  await updateDoctorReportStatus(client, review.id, "validated");

  return {
    reviewId: review.id,
    patientId: review.patient_id,
    status: "validated",
  };
});

export const startConsultation = createServerFn({
  method: "POST",
  validator: z.object({
    reviewId: z.string(),
    doctorNote: z.string().optional(),
  }),
}).handler(async ({ data: { reviewId, doctorNote } }) => {
  const { supabase, supabaseAdmin } = await import("@/lib/supabase");
  const client = supabaseAdmin || supabase;

  const { data: review, error: reviewError } = await client
    .from("review_queue")
    .select("id, patient_id, summary")
    .eq("id", reviewId)
    .single();

  if (reviewError) throw reviewError;
  const doctorConnection = await readDoctorConnection(client, review.patient_id);
  const doctorName = doctorConnection?.doctorName || "Doctor";

  const note =
    doctorNote?.trim() ||
    "I reviewed the report and want to speak with you directly before giving final guidance.";

  let consultationId = review.id;
  try {
    const { data: report } = await client
      .from("doctor_reports")
      .select("id")
      .eq("review_id", review.id)
      .maybeSingle();

    const { data: consultation } = await client
      .from("consultations")
      .insert({
        review_id: review.id,
        report_id: report?.id || null,
        patient_id: review.patient_id,
        doctor_name: doctorName,
        status: "active",
      })
      .select("id")
      .single();

    if (consultation?.id) {
      consultationId = consultation.id;
      await client.from("consultation_messages").insert({
        consultation_id: consultation.id,
        patient_id: review.patient_id,
        role: "doctor",
        content: `Hello, I have received your report. ${note}`,
      });

      const { error: statusError } = await client
        .from("review_queue")
        .update({ status: "consultation_started" })
        .eq("id", review.id);

      if (statusError) {
        console.warn("Review queue status did not accept consultation_started; consultation record was still created.");
      }
    }
  } catch (err) {
    console.warn("Consultation table insert failed. Run supabase-curable-schema.sql to enable persisted consultations.", err);

    const { error: fallbackError } = await client
      .from("review_queue")
      .update({ status: "consultation_started" })
      .eq("id", review.id);

    if (fallbackError) {
      throw new Error(
        "Could not start a consultation because the Supabase consultation tables are not installed yet. Run supabase-curable-schema.sql in Supabase SQL Editor, then try again."
      );
    }
  }

  await insertDoctorReviewCard({
    client,
    patientId: review.patient_id,
    reviewId: review.id,
    outcome: "consultation_started",
    title: "Doctor wants to speak with you",
    content: `${doctorName} reviewed your report and wants to continue this in a doctor consultation. ${note}`,
    doctorNote: note,
    consultationId,
    doctorName,
  });

  await updateDoctorReportStatus(client, review.id, "consultation_started");

  return {
    id: consultationId,
    patientId: review.patient_id,
  };
});

export const getActiveConsultation = createServerFn({
  method: "GET",
  validator: z.object({
    patientId: z.string().uuid().optional(),
  }),
}).handler(async ({ data: { patientId } }) => {
  const { supabase, supabaseAdmin } = await import("@/lib/supabase");
  const client = supabaseAdmin || supabase;

  let consultationQuery = client
    .from("consultations")
    .select("*, patients(full_name), doctor_reports(*)")
    .eq("status", "active")
    .order("started_at", { ascending: false })
    .limit(1);

  if (patientId) {
    consultationQuery = consultationQuery.eq("patient_id", patientId);
  }

  const { data: consultation, error: consultationError } = await consultationQuery.maybeSingle();

  if (!consultationError && consultation) {
    const report = Array.isArray(consultation.doctor_reports)
      ? consultation.doctor_reports[0]
      : consultation.doctor_reports;

    return {
      id: consultation.id,
      patientId: consultation.patient_id,
      patientName: consultation.patients?.full_name || "Patient",
      doctorName: consultation.doctor_name || (await readDoctorConnection(client, consultation.patient_id))?.doctorName || "Doctor",
      summary: report?.summary || "Doctor consultation started.",
      risk: report?.risk_level || "moderate",
      reportDetails: [
        report?.doctor_question ? `Doctor question: ${report.doctor_question}` : "",
        report?.ai_safety_note ? `AI safety note: ${report.ai_safety_note}` : "",
        ...(report?.patient_context || []).map((item: string) => `Patient: ${item}`),
        ...(report?.medication_context || []).map((item: string) => `Medication: ${item}`),
        ...(report?.memory_context || []).map((item: string) => `Memory: ${item}`),
        ...(report?.recent_conversation || []).map((item: string) => `Recent chat: ${item}`),
      ]
        .filter(Boolean)
        .join("\n"),
      createdAt: consultation.started_at,
    };
  }

  let reviewQuery = client
    .from("review_queue")
    .select("*, patients(full_name)")
    .eq("status", "consultation_started")
    .order("created_at", { ascending: false })
    .limit(1);

  if (patientId) {
    reviewQuery = reviewQuery.eq("patient_id", patientId);
  }

  const { data, error } = await reviewQuery.maybeSingle();

  if (error) throw error;

  return data
    ? {
        id: data.id,
        patientId: data.patient_id,
        patientName: data.patients?.full_name || "Patient",
        doctorName: (await readDoctorConnection(client, data.patient_id))?.doctorName || "Doctor",
        summary: data.summary,
        risk: data.risk_level,
        reportDetails: data.ai_recommendation,
        createdAt: data.created_at,
      }
    : null;
});

export const getConsultationMessages = createServerFn({
  method: "GET",
  validator: z.object({
    consultationId: z.string(),
  }),
}).handler(async ({ data: { consultationId } }) => {
  const { supabase, supabaseAdmin } = await import("@/lib/supabase");
  const client = supabaseAdmin || supabase;

  const { data, error } = await client
    .from("consultation_messages")
    .select("*")
    .eq("consultation_id", consultationId)
    .order("created_at", { ascending: true });

  if (error) {
    console.warn("Consultation messages fetch failed:", error.message);
    return [];
  }

  return (data || []).map((m) => ({
    id: m.id,
    role: m.role,
    text: m.content,
    time: new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
  }));
});

export const sendConsultationMessage = createServerFn({
  method: "POST",
  validator: z.object({
    consultationId: z.string(),
    patientId: z.string().uuid(),
    role: z.enum(["doctor", "patient"]),
    content: z.string().min(1),
  }),
}).handler(async ({ data: { consultationId, patientId, role, content } }) => {
  const { supabase, supabaseAdmin } = await import("@/lib/supabase");
  const client = supabaseAdmin || supabase;

  const { data, error } = await client
    .from("consultation_messages")
    .insert({
      consultation_id: consultationId,
      patient_id: patientId,
      role,
      content,
    })
    .select("*")
    .single();

  if (error) throw error;

  return {
    id: data.id,
    role: data.role,
    text: data.content,
    time: new Date(data.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
  };
});
