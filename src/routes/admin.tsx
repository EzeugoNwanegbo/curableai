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
    workplace: string;
    status: string;
  }[];
  requests: { id: string; patient_name: string; doctor_name: string | null; status: string }[];
}

function AdminPage() {
  const { user } = useAuth();
  const allowed = user?.app_metadata?.curable_admin === true;
  const [decision, setDecision] = useState<{ id: string; status: "approved" | "declined" } | null>(
    null,
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const queues = useQuery({
    queryKey: ["admin-queues", user?.id],
    enabled: allowed,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("curable_admin_queues");
      if (error) throw error;
      return data as Queues;
    },
  });

  if (!allowed) return <Navigate to="/" replace />;
  return (
    <main className="mx-auto max-w-3xl space-y-8 p-5 sm:p-8">
      <h1 className="text-2xl">Admin</h1>
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
              <article
                key={item.user_id}
                className="space-y-2 rounded-lg border border-border bg-card p-4"
              >
                <h3 className="font-medium">{item.full_name}</h3>
                <p className="break-words text-sm">{item.email}</p>
                <p className="text-sm">
                  {item.workplace} · Registration {item.registration_number}
                </p>
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
                              const { error } = await supabase.rpc("curable_review_application", {
                                target: decision.id,
                                decision: decision.status,
                              });
                              if (error) throw error;
                              setDecision(null);
                              await queues.refetch();
                            } catch {
                              setError(
                                "Couldn’t save your decision. Refresh the queue and try again.",
                              );
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
              </article>
            ))}
          </section>
          <section className="space-y-3">
            <h2 className="text-xl">Requests for a doctor</h2>
            {queues.data.requests.length === 0 && <p>No confirmed requests yet.</p>}
            {queues.data.requests.map((item) => (
              <article key={item.id} className="rounded-lg border border-border bg-card p-4">
                <h3 className="font-medium">{item.patient_name}</h3>
                <p className="text-sm">
                  {item.doctor_name ?? "No doctor listed"} · {item.status.replaceAll("_", " ")}
                </p>
              </article>
            ))}
          </section>
        </>
      )}
    </main>
  );
}
