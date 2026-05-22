import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Check, MessageSquare, Search, Clock, ShieldAlert } from "lucide-react";
import { CurableLoader } from "@/components/CurableLoader";
import { RiskBadge } from "@/components/RiskBadge";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/doctor")({
  head: () => ({
    meta: [
      { title: "Doctor Dashboard · Curable" },
      { name: "description", content: "Centralized supervision workspace for AI-assisted patient care." },
    ],
  }),
  component: DoctorPage,
});

interface ReviewItem {
  id: string;
  patient_id: string;
  summary: string;
  risk_level: string;
  ai_recommendation: string;
  status: string;
  created_at: string;
  patient_name?: string;
}

function buildDoctorNote(note: string | undefined, fallback: string) {
  return note?.trim() || fallback;
}

function DoctorPage() {
  const { displayName } = useAuth();
  const doctorName = displayName || "Doctor";
  const [queue, setQueue] = useState<ReviewItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    async function fetchQueue() {
      try {
        setIsLoading(true);
        // Fetch queue and join with patients for names
        const { data, error: fetchError } = await supabase
          .from("review_queue")
          .select("*, patients(full_name)")
          .order("created_at", { ascending: false });

        if (fetchError) throw fetchError;

        if (data) {
          const { data: reviewCards } = await supabase
            .from("messages")
            .select("metadata")
            .not("metadata", "is", null);

          const handledReviewIds = new Set(
            (reviewCards || [])
              .filter((message: any) => message.metadata?.type === "doctor_review_card")
              .map((message: any) => message.metadata.reviewId)
              .filter(Boolean)
          );

          setQueue(
            data
              .filter((item: any) => !handledReviewIds.has(item.id))
              .map((item: any) => ({
                ...item,
                patient_name: item.patients?.full_name || "Unknown Patient",
              }))
          );
        }
      } catch (err: any) {
        console.error("Queue fetch error:", err);
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    }

    fetchQueue();

    // Set up real-time listener
    const channel = supabase
      .channel("review_queue_changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "review_queue" },
        () => {
          fetchQueue(); // Refresh the whole list for simplicity in this MVP
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const insertDoctorReviewCard = async ({
    review,
    outcome,
    title,
    note,
    consultationId,
  }: {
    review: ReviewItem;
    outcome: "validated" | "consultation_started";
    title: string;
    note: string;
    consultationId?: string;
  }) => {
    const content =
      outcome === "validated"
        ? `${doctorName} reviewed your report and agreed with Curable's guidance. ${note}`
        : `${doctorName} reviewed your report and wants to continue this in a doctor consultation. ${note}`;

    const metadata = {
      type: "doctor_review_card",
      outcome,
      reviewId: review.id,
      consultationId: consultationId || null,
      doctorName,
      title,
      doctorNote: note,
      actionLabel: outcome === "consultation_started" ? "Enter consultation" : "",
      createdAt: new Date().toISOString(),
    };

    const { error: doctorRoleError } = await supabase.from("messages").insert({
      patient_id: review.patient_id,
      role: "doctor",
      content,
      metadata,
    });

    if (!doctorRoleError) return;

    const { error: fallbackError } = await supabase.from("messages").insert({
      patient_id: review.patient_id,
      role: "ai",
      content,
      metadata,
    });

    if (fallbackError) throw fallbackError;
  };

  const handleValidateGuidance = async (review: ReviewItem) => {
    try {
      setUpdatingId(review.id);
      const note = buildDoctorNote(
        undefined,
        "I reviewed the report and agree that Curable handled this safely. Continue following the guidance already given, and seek urgent care if symptoms become severe or worrying."
      );

      await insertDoctorReviewCard({
        review,
        outcome: "validated",
        title: "Doctor accepted Curable reasoning",
        note,
      });

      await supabase.from("doctor_reports").update({ status: "validated" }).eq("review_id", review.id);
      setQueue((prev) => prev.filter((item) => item.id !== review.id));
    } catch (err: any) {
      console.error("Validation update error:", err);
      setError(err.message || "Could not validate this review.");
    } finally {
      setUpdatingId(null);
    }
  };

  const handleStartConsultation = async (review: ReviewItem) => {
    try {
      setUpdatingId(review.id);
      const note = buildDoctorNote(
        undefined,
        "I reviewed the report and want to speak with you directly before giving final guidance."
      );
      let consultationId = review.id;

      try {
        const { data: report } = await supabase
          .from("doctor_reports")
          .select("id")
          .eq("review_id", review.id)
          .maybeSingle();

        const { data: consultation, error: consultationError } = await supabase
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

        if (consultationError) throw consultationError;

        if (consultation?.id) {
          consultationId = consultation.id;
          await supabase.from("consultation_messages").insert({
            consultation_id: consultation.id,
            patient_id: review.patient_id,
            role: "doctor",
            content: `Hello, I have received your report. ${note}`,
          });
        }
      } catch (err) {
        console.warn("Persisted consultation insert failed; falling back to review queue status.", err);
      }

      const { error: updateError } = await supabase
        .from("review_queue")
        .update({ status: "consultation_started" })
        .eq("id", review.id);

      if (updateError) {
        console.warn("Review queue status did not accept consultation_started; consultation record was still created.");
      }

      await supabase.from("doctor_reports").update({ status: "consultation_started" }).eq("review_id", review.id);

      await insertDoctorReviewCard({
        review,
        outcome: "consultation_started",
        title: "Doctor wants to speak with you",
        note,
        consultationId,
      });

      setQueue((prev) => prev.map((item) => (item.id === review.id ? { ...item, status: "consultation_started" } : item)));
    } catch (err: any) {
      console.error("Consultation start error:", err);
      setError(err.message || "Could not start the consultation.");
    } finally {
      setUpdatingId(null);
    }
  };

  if (isLoading) {
    return <CurableLoader message="Loading review queue..." />;
  }

  if (error) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-background p-6 text-center">
        <ShieldAlert className="h-12 w-12 text-destructive mb-4" />
        <h2 className="font-serif text-2xl text-foreground mb-2">Dashboard Error</h2>
        <p className="text-muted-foreground max-w-md mb-6">{error}</p>
        <button 
          onClick={() => window.location.reload()}
          className="rounded-md bg-primary px-6 py-2 text-sm font-medium text-primary-foreground hover:bg-accent"
        >
          Try Again
        </button>
      </div>
    );
  }

  const pendingItems = queue.filter(item => item.status === 'pending' || item.status === 'consultation_started');

  return (
    <div className="container-page py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">Page 03</div>
          <h1 className="mt-1 font-serif text-3xl text-foreground">Doctor Dashboard</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Structured AI summaries first. Accept Curable reasoning or open a separate patient chat.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-md border border-input bg-card px-3 py-2 text-sm">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            placeholder="Search patients..."
            className="w-80 bg-transparent outline-none placeholder:text-muted-foreground"
          />
        </div>
      </div>

      <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_380px]">
        <div>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-serif text-lg text-foreground">AI review queue</h2>
            <span className="font-mono text-xs text-muted-foreground">{pendingItems.length} pending</span>
          </div>

          <div className="space-y-4">
            {pendingItems.length > 0 ? (
              pendingItems.map((r) => (
                <article key={r.id} className="rounded-lg border border-border bg-card p-6 shadow-elegant">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="font-serif text-lg text-foreground">{r.patient_name}</div>
                      <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
                        <Clock className="h-3 w-3" /> {new Date(r.created_at).toLocaleTimeString()}
                      </div>
                    </div>
                    <RiskBadge level={r.risk_level as any} />
                  </div>

                  <p className="mt-4 text-sm leading-relaxed text-foreground">{r.summary}</p>

                  <div className="mt-4 rounded-md border border-border bg-surface p-3 text-sm">
                    <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                      AI recommendation
                    </div>
                    <p className="mt-1 whitespace-pre-line leading-relaxed text-foreground">{r.ai_recommendation}</p>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <button 
                      onClick={() => handleValidateGuidance(r)}
                      disabled={updatingId === r.id}
                      className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-accent disabled:opacity-60"
                    >
                      {updatingId === r.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                      Reasoning accepted
                    </button>
                    {r.status === "consultation_started" ? (
                      <Link
                        to="/consultation"
                        className="inline-flex items-center gap-1.5 rounded-md border border-accent/40 bg-accent/5 px-3 py-1.5 text-xs font-medium text-accent hover:bg-accent/10"
                      >
                        <MessageSquare className="h-3 w-3" /> Open chat
                      </Link>
                    ) : (
                      <button
                        onClick={() => handleStartConsultation(r)}
                        disabled={updatingId === r.id}
                        className="inline-flex items-center gap-1.5 rounded-md border border-accent/40 bg-accent/5 px-3 py-1.5 text-xs font-medium text-accent hover:bg-accent/10 disabled:opacity-60"
                      >
                        {updatingId === r.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <MessageSquare className="h-3 w-3" />}
                        Open chat
                      </button>
                    )}
                  </div>

                </article>
              ))
            ) : (
              <div className="rounded-lg border border-dashed border-border p-12 text-center">
                <p className="text-sm text-muted-foreground italic">No pending items in the review queue.</p>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar Context */}
        <aside>
          <h2 className="mb-4 font-serif text-lg text-foreground">System Overview</h2>
          <div className="rounded-lg border border-border bg-card p-5 space-y-6">
            <div>
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-3">Live Status</div>
              <div className="flex items-center gap-2 text-sm text-foreground">
                <span className="h-2 w-2 rounded-full bg-success" /> Review queue connected
              </div>
            </div>
            
            <div className="pt-4 border-t border-border">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-3">Queue Status</div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Only validation reports sent by patients appear here.
              </p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
