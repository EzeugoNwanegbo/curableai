import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Bell, Loader2, Stethoscope } from "lucide-react";
import { getActiveConsultation } from "@/api/consultation";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/notifications")({
  head: () => ({
    meta: [
      { title: "Notifications · Curable" },
      { name: "description", content: "Medication reminders, follow-up prompts, escalation alerts, and appointments." },
    ],
  }),
  component: NotificationsPage,
});

function NotificationsPage() {
  const { patientId } = useAuth();
  const [activeConsultation, setActiveConsultation] = useState<any>(null);
  const [isLoadingConsultation, setIsLoadingConsultation] = useState(true);

  useEffect(() => {
    async function loadActiveConsultation() {
      if (!patientId) {
        setIsLoadingConsultation(false);
        return;
      }
      try {
        const active = await getActiveConsultation({ data: { patientId } });
        setActiveConsultation(active);
      } finally {
        setIsLoadingConsultation(false);
      }
    }
    loadActiveConsultation();
  }, [patientId]);

  return (
    <div className="container-page py-10">
      <div className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">Page 05</div>
      <h1 className="mt-1 font-serif text-3xl text-foreground">Notifications & Follow-up</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        Continuity between consultations. Reminders, prompts, and alerts that keep the patient
        engaged and the doctor informed.
      </p>

      <div className="mt-10">
        {isLoadingConsultation ? (
          <div className="flex items-center gap-2 rounded-lg border border-border bg-card p-5 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Checking doctor consultation status...
          </div>
        ) : activeConsultation ? (
          <div className="rounded-lg border border-success/30 bg-success/10 p-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-success text-primary-foreground">
                  <Stethoscope className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-[11px] uppercase tracking-wider text-success">Doctor consultation started</div>
                  <div className="mt-0.5 font-serif text-lg text-foreground">
                    {activeConsultation.doctorName || "Your doctor"} is ready to speak with you.
                  </div>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{activeConsultation.summary}</p>
                </div>
              </div>
              <Link
                to="/consultation"
                className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-accent"
              >
                Enter consultation
              </Link>
            </div>
          </div>
        ) : null}
      </div>

      {!isLoadingConsultation && !activeConsultation ? (
        <div className="mt-10 rounded-lg border border-dashed border-border bg-card p-10 text-center">
          <Bell className="mx-auto h-8 w-8 text-muted-foreground" />
          <h2 className="mt-3 font-serif text-xl text-foreground">No notifications yet</h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
            Real updates will appear here when a doctor starts a consultation or when Curable creates
            a saved follow-up event.
          </p>
        </div>
      ) : null}
    </div>
  );
}
