import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/admin")({ component: AdminPage });

interface Queues {
  applications: {
    user_id: string;
    full_name: string;
    email: string;
    registration_number: string;
    specialty: string | null;
    whatsapp_number: string | null;
    workplace: string;
    status: string;
  }[];
  requests: { id: string; patient_name: string; doctor_name: string | null; status: string; created_at: string }[];
}

function AdminPage() {
  const { user } = useAuth();
  const allowed = user?.app_metadata?.curable_admin === true;
  const [decision, setDecision] = useState<{ id: string; status: "approved" | "declined" } | null>(
    null,
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [openApplication, setOpenApplication] = useState<string | null>(null);
  const queues = useQuery({
    queryKey: ["admin-queues", user?.id],
    enabled: allowed,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("curable_admin_queues");
      if (error) throw error;
      return data as Queues;
    },
  });

  const advocates = useQuery({
    queryKey: ["admin-advocates", user?.id],
    enabled: allowed,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("curable_admin_advocates");
      if (error) throw error;
      return data as { institution: string; name: string; supported_at: string }[];
    },
  });

  if (!allowed) return <Navigate to="/" replace />;
  return (
    <main className="mx-auto max-w-3xl space-y-8 p-5 sm:p-8">
      <h1 className="text-2xl">Admin</h1>
      <section className="space-y-3">
        <h2 className="text-xl">University and hospital support</h2>
        {advocates.isPending && <p>Loading support…</p>}
        {advocates.isError && <button onClick={() => void advocates.refetch()}>Couldn’t load support. Retry</button>}
        {advocates.data && <>
          <p className="text-sm text-muted-foreground">{advocates.data.length} people have added their support.</p>
          {advocates.data.map((item, index) => <article key={`${item.name}-${item.institution}-${index}`} className="rounded-lg border border-border bg-card p-4"><p>{item.institution}</p><p className="text-sm text-muted-foreground">{item.name}</p></article>)}
        </>}
      </section>
      {queues.isPending && <p role="status">Loading requests…</p>}
      {queues.isError && (
        <button onClick={() => void queues.refetch()}>Couldn’t load requests. Retry</button>
      )}
      {queues.data && (
        <>
          <section className="space-y-3">
            <h2 className="text-xl">Doctor applications</h2>
            {queues.data.applications.length === 0 && <p>No applications yet.</p>}
            {queues.data.applications.map((item) => (
              <article key={item.user_id} className="rounded-lg border border-border bg-card">
                <button
                  type="button"
                  aria-expanded={openApplication === item.user_id}
                  aria-controls={`doctor-application-${item.user_id}`}
                  className="flex min-h-14 w-full items-center justify-between gap-3 p-4 text-left font-medium"
                  onClick={() => {
                    setError("");
                    setOpenApplication((current) => current === item.user_id ? null : item.user_id);
                  }}
                >
                  <span>{item.full_name}</span>
                  <span className="text-sm text-muted-foreground">{openApplication === item.user_id ? "Hide details" : "View application"} · {item.status}</span>
                </button>
                {openApplication === item.user_id && <div id={`doctor-application-${item.user_id}`} className="space-y-2 px-4 pb-4">
                <p className="break-words text-sm">{item.email}</p>
                <p className="text-sm">
                  {item.specialty || "Specialty pending"} · {item.workplace} · Registration {item.registration_number}
                </p>
                <p className="text-sm">WhatsApp: {item.whatsapp_number || "Not provided"}</p>
                <p className="text-sm capitalize">{item.status}</p>
                {item.status === "pending" &&
                  (decision?.id === item.user_id ? (
                    <div className="space-y-2">
                      <p>
                        {decision.status === "approved"
                          ? "Confirm you verified this doctor’s registration and want to grant access."
                          : "Confirm you want to decline this application."}
                      </p>
                      {error && <p role="alert">{error}</p>}
                      <div className="flex gap-4">
                        <button
                          type="button"
                          disabled={saving}
                          className="min-h-11 text-primary"
                          onClick={async () => {
                            setSaving(true);
                            setError("");
                            try {
                              const { error: saveError } = await supabase.rpc("curable_review_application", {
                                target: decision.id,
                                decision: decision.status,
                              });
                              if (saveError) throw saveError;
                              setDecision(null);
                              await queues.refetch();
                            } catch (saveError) {
                              const message = saveError instanceof Error ? saveError.message : "";
                              setError(message.includes("verify their email")
                                ? "This doctor must verify their email before approval."
                                : message.includes("no longer pending")
                                  ? "This application is no longer pending. Refreshing the list…"
                                  : message.includes("Administrator access required")
                                    ? "Your admin session has expired. Sign out and back in, then try again."
                                    : `Couldn’t save your decision${message ? `: ${message}` : ". Refresh the queue and try again."}`);
                              if (message.includes("no longer pending")) await queues.refetch();
                            } finally {
                              setSaving(false);
                            }
                          }}
                        >
                          {saving ? "Saving…" : "Confirm"}
                        </button>
                        <button
                          type="button"
                          disabled={saving}
                          className="min-h-11"
                          onClick={() => setDecision(null)}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-4">
                      <button
                        type="button"
                        disabled={saving}
                        className="min-h-11 text-primary"
                        onClick={() => {
                          setError("");
                          setDecision({ id: item.user_id, status: "approved" });
                        }}
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        disabled={saving}
                        className="min-h-11"
                        onClick={() => {
                          setError("");
                          setDecision({ id: item.user_id, status: "declined" });
                        }}
                      >
                        Decline
                      </button>
                    </div>
                  ))}
                </div>}
              </article>
            ))}
          </section>
          <section className="space-y-3">
            <h2 className="text-xl">Requests for a doctor</h2>
            {queues.data.requests.length === 0 && <p>No confirmed requests yet.</p>}
            {queues.data.requests.map((item) => (
              <details key={item.id} className="rounded-lg border border-border bg-card">
                <summary className="cursor-pointer p-4 font-medium">{item.patient_name} · Request details</summary>
                <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 px-4 pb-4 text-sm">
                  <dt>Patient</dt><dd>{item.patient_name}</dd>
                  <dt>Doctor</dt><dd>{item.doctor_name ?? "No doctor listed"}</dd>
                  <dt>Status</dt><dd>{item.status.replaceAll("_", " ")}</dd>
                  <dt>Requested</dt><dd>{new Date(item.created_at).toLocaleString()}</dd>
                </dl>
              </details>
            ))}
          </section>
        </>
      )}
    </main>
  );
}
