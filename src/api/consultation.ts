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

export const validateReviewGuidance = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      reviewId: z.string(),
      doctorNote: z.string().optional(),
    }),
  )
  .handler(async ({ data: { reviewId, doctorNote } }) => {
    const { getAuthenticatedClient } = await import("@/lib/supabase-server");
    const client = await getAuthenticatedClient();
    const {
      data: { user },
    } = await client.auth.getUser();
    if (user?.app_metadata?.role !== "doctor") {
      throw new Error("Only an approved doctor can review patient guidance.");
    }

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
      console.warn(
        "Review queue status did not accept reviewed; validation card was still created.",
      );
    }

    await updateDoctorReportStatus(client, review.id, "validated");

    return {
      reviewId: review.id,
      patientId: review.patient_id,
      status: "validated",
    };
  });

export const startConsultation = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      reviewId: z.string(),
      doctorNote: z.string().optional(),
    }),
  )
  .handler(async ({ data: { reviewId, doctorNote } }) => {
    const { getAuthenticatedClient } = await import("@/lib/supabase-server");
    const client = await getAuthenticatedClient();
    const { data: id, error } = await client.rpc("accept_student_review", {
      review_id_input: reviewId,
      doctor_note: doctorNote || "",
    });
    if (error) throw new Error(error.message);
    return { id: String(id) };
  });

export const getActiveConsultation = createServerFn({ method: "GET" })
  .inputValidator(
    z.object({
      patientId: z.string().uuid().optional(),
      consultationId: z.string().uuid().optional(),
    }),
  )
  .handler(async ({ data: { patientId, consultationId } }) => {
    const { getAuthenticatedClient } = await import("@/lib/supabase-server");
    const client = await getAuthenticatedClient();

    let consultationQuery = client
      .from("consultations")
      .select("*, patients(full_name), doctor_reports(*)")
      .eq("status", "active")
      .order("started_at", { ascending: false })
      .limit(1);

    if (consultationId) consultationQuery = consultationQuery.eq("id", consultationId);
    if (patientId) {
      consultationQuery = consultationQuery.eq("patient_id", patientId);
    }

    const { data: consultation, error: consultationError } = await consultationQuery.maybeSingle();

    if (!consultationError && consultation) {
      const report = Array.isArray(consultation.doctor_reports)
        ? consultation.doctor_reports[0]
        : consultation.doctor_reports;

      const [
        { data: historyPatient, error: historyError },
        { data: historyMemory, error: memoryError },
        { data: historyMedicines, error: medicineError },
      ] = await Promise.all([
        client
          .from("patients")
          .select("full_name,age,sex,blood_group,allergies,conditions")
          .eq("id", consultation.patient_id)
          .single(),
        client
          .from("memory_snapshots")
          .select("label,details")
          .eq("patient_id", consultation.patient_id)
          .order("created_at"),
        client
          .from("medications")
          .select("name,dosage,frequency")
          .eq("patient_id", consultation.patient_id),
      ]);
      if (historyError || memoryError || medicineError)
        throw new Error("Could not load the available patient history.");
      const historyDetails = [
        "AVAILABLE PATIENT HISTORY",
        JSON.stringify(historyPatient),
        ...(historyMemory || []).map((m) => `${m.label}: ${m.details}`),
        ...(historyMedicines || []).map((m) => `Medicine: ${m.name} ${m.dosage} ${m.frequency}`),
      ].join("\n");
      return {
        id: consultation.id,
        patientId: consultation.patient_id,
        patientName: consultation.patients?.full_name || "Patient",
        doctorName:
          consultation.doctor_name ||
          (await readDoctorConnection(client, consultation.patient_id))?.doctorName ||
          "Doctor",
        summary: report?.summary || "Doctor consultation started.",
        risk: report?.risk_level || "moderate",
        reportDetails: [
          historyDetails,
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

    if (consultationError) throw consultationError;
    return null;
  });

export const getConsultationMessages = createServerFn({ method: "GET" })
  .inputValidator(
    z.object({
      consultationId: z.string(),
    }),
  )
  .handler(async ({ data: { consultationId } }) => {
    const { getAuthenticatedClient } = await import("@/lib/supabase-server");
    const client = await getAuthenticatedClient();

    const { data, error } = await client
      .from("consultation_messages")
      .select("*")
      .eq("consultation_id", consultationId)
      .order("created_at", { ascending: true });

    if (error) {
      throw error;
    }

    return (data || []).map((m) => ({
      id: m.id,
      role: m.role,
      text: m.content,
      time: new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    }));
  });

export const sendConsultationMessage = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      consultationId: z.string(),
      patientId: z.string().uuid(),
      role: z.enum(["doctor", "patient"]),
      content: z.string().min(1),
    }),
  )
  .handler(async ({ data: { consultationId, patientId, role, content } }) => {
    const { getAuthenticatedClient } = await import("@/lib/supabase-server");
    const client = await getAuthenticatedClient();

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
      time: new Date(data.created_at).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
    };
  });
