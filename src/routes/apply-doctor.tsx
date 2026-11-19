import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/apply-doctor")({ component: DoctorApplication });

function DoctorApplication() {
  const { user, role } = useAuth();
  const queryClient = useQueryClient();
  const queryKey = ["doctor-application", user?.id];
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const application = useQuery({
    queryKey,
    enabled: Boolean(user) && role !== "doctor",
    queryFn: async () => {
      const { data, error } = await supabase
        .from("doctor_applications")
        .select("status")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  return (
    <main className="mx-auto max-w-xl space-y-5 p-5 sm:p-8">
      <Link to="/consultation" className="text-sm text-primary">
        Back to Doctors
      </Link>
      <h1 className="text-2xl">Apply as a doctor</h1>
      {role === "doctor" ? (
        <p>You already have doctor access.</p>
      ) : application.isPending ? (
        <p role="status">Checking your application…</p>
      ) : application.isError ? (
        <button type="button" onClick={() => void application.refetch()}>
          Couldn’t load your application. Retry
        </button>
      ) : application.data ? (
        <p role="status">Application status: {application.data.status}.</p>
      ) : (
        <form
          className="space-y-4"
          onSubmit={async (event) => {
            event.preventDefault();
            if (!user || saving) return;
            const fields = new FormData(event.currentTarget);
            setSaving(true);
            setError("");
            try {
              const { error } = await supabase.from("doctor_applications").insert({
                user_id: user.id,
                full_name: String(fields.get("name") ?? "").trim(),
                registration_number: String(fields.get("registration") ?? "").trim(),
                workplace: String(fields.get("workplace") ?? "").trim(),
              });
              if (error && error.code !== "23505") throw error;
              await queryClient.invalidateQueries({ queryKey });
            } catch {
              setError("Couldn’t submit your application. Try again.");
            } finally {
              setSaving(false);
            }
          }}
        >
          <p className="text-sm text-muted-foreground">
            Curable reviews your registration before granting doctor access.
          </p>
          {(
            [
              ["name", "Full name", 120],
              ["registration", "Medical registration number", 80],
              ["workplace", "Hospital or clinic", 160],
            ] as const
          ).map(([name, label, limit]) => (
            <label key={name} className="block text-sm">
              {label}
              <input
                required
                name={name}
                maxLength={limit}
                className="mt-1 block w-full rounded-lg border border-input bg-card p-3"
              />
            </label>
          ))}
          {error && <p role="alert">{error}</p>}
          <button
            type="submit"
            disabled={saving}
            className="min-h-11 rounded-lg bg-primary px-4 text-primary-foreground"
          >
            {saving ? "Submitting…" : "Submit application"}
          </button>
        </form>
      )}
    </main>
  );
}
