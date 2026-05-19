import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Pill, Plus, Hospital, User2, AlertCircle, Loader2, X } from "lucide-react";
import { addPatientMedication, getAuthenticatedPatientMedications } from "@/api/medications";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/medications")({
  head: () => ({
    meta: [
      { title: "Medications · Curable" },
      { name: "description", content: "Track medications, adherence, and side effects with AI medication intelligence." },
    ],
  }),
  component: MedsPage,
});

interface Medication {
  id: string;
  name: string;
  dosage: string;
  frequency: string;
  time: string;
  purpose: string;
  source: "hospital" | "patient";
  sideEffects: string[];
  adherence: number;
  prescriber: string;
}

function MedsPage() {
  const { patientId } = useAuth();
  const [medications, setMedications] = useState<Medication[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadMedications() {
      if (!patientId) {
        setIsLoading(false);
        return;
      }
      try {
        const meds = await getAuthenticatedPatientMedications({ data: { patientId } });
        setMedications(meds as Medication[]);
      } catch (err: any) {
        setError(err.message || "Could not load medications.");
      } finally {
        setIsLoading(false);
      }
    }
    loadMedications();
  }, [patientId]);

  const handleAddMedication = async (event: React.FormEvent) => {
    event.preventDefault();
    const formElement = event.currentTarget as HTMLFormElement;
    const fields = formElement.elements;
    const readField = (fieldName: string) => {
      const field = fields.namedItem(fieldName) as HTMLInputElement | HTMLSelectElement | null;
      return field?.value?.trim() || "";
    };

    const name = readField("name");
    const dosage = readField("dosage");
    const frequency = readField("frequency");
    const time = readField("time");
    const purpose = readField("purpose");
    const source = (readField("source") || "patient") as Medication["source"];
    const prescriber = readField("prescriber");
    const sideEffects = readField("sideEffects")
      .split(",")
      .map((sideEffect) => sideEffect.trim())
      .filter(Boolean);

    if (!name) {
      setError("Medication name is required.");
      return;
    }

    const adherencePercent = Number(readField("adherencePercent"));
    const adherence = Number.isFinite(adherencePercent)
      ? Math.min(1, Math.max(0, adherencePercent / 100))
      : 1;

    setIsAdding(true);
    setError(null);
    try {
      const med = await addPatientMedication({
        data: {
          patientId: patientId || undefined,
          name,
          dosage,
          frequency,
          time,
          purpose,
          source,
          sideEffects,
          adherence,
          prescriber: prescriber || (source === "hospital" ? "Hospital record" : "Self-added"),
        },
      });
      setMedications((prev) => [...prev, med as Medication]);
      setIsFormOpen(false);
      formElement.reset();
    } catch (err: any) {
      setError(err.message || "Could not add medication.");
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <div className="container-page py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">Page 02</div>
          <h1 className="mt-1 font-serif text-3xl text-foreground">Medication Management</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Hospital prescriptions and patient-added substances live together. The AI references
            this list during every conversation.
          </p>
        </div>
        <button
          onClick={() => {
            setIsFormOpen(true);
            setError(null);
          }}
          disabled={isAdding}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-elegant hover:bg-accent disabled:opacity-60"
        >
          <Plus className="h-4 w-4" /> Add medication
        </button>
      </div>

      {error ? (
        <div className="mt-6 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      {isFormOpen ? (
        <form onSubmit={handleAddMedication} className="mt-8 rounded-lg border border-border bg-card p-5 shadow-elegant">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                New medication
              </div>
              <h2 className="mt-1 font-serif text-lg text-foreground">Add to active medication context</h2>
            </div>
            <button
              type="button"
              onClick={() => {
                setIsFormOpen(false);
                setError(null);
              }}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="Close medication form"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <label className="text-sm">
              <span className="text-xs font-medium text-muted-foreground">Name</span>
              <input
                name="name"
                placeholder="Medication name"
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring"
              />
            </label>
            <label className="text-sm">
              <span className="text-xs font-medium text-muted-foreground">Dosage</span>
              <input
                name="dosage"
                placeholder="Dose"
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring"
              />
            </label>
            <label className="text-sm">
              <span className="text-xs font-medium text-muted-foreground">Frequency</span>
              <input
                name="frequency"
                placeholder="How often"
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring"
              />
            </label>
            <label className="text-sm">
              <span className="text-xs font-medium text-muted-foreground">Time</span>
              <input
                name="time"
                placeholder="Morning and evening"
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring"
              />
            </label>
            <label className="text-sm">
              <span className="text-xs font-medium text-muted-foreground">Purpose</span>
              <input
                name="purpose"
                placeholder="Reason for taking it"
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring"
              />
            </label>
            <label className="text-sm">
              <span className="text-xs font-medium text-muted-foreground">Source</span>
              <select
                name="source"
                defaultValue="patient"
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring"
              >
                <option value="patient">Patient-added</option>
                <option value="hospital">Hospital</option>
              </select>
            </label>
            <label className="text-sm">
              <span className="text-xs font-medium text-muted-foreground">Prescriber</span>
              <input
                name="prescriber"
                placeholder="Doctor or source"
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring"
              />
            </label>
            <label className="text-sm">
              <span className="text-xs font-medium text-muted-foreground">Adherence</span>
              <input
                name="adherencePercent"
                type="number"
                min="0"
                max="100"
                defaultValue="100"
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring"
              />
            </label>
            <label className="text-sm md:col-span-2">
              <span className="text-xs font-medium text-muted-foreground">Reported side effects</span>
              <input
                name="sideEffects"
                placeholder="Separate with commas"
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring"
              />
            </label>
          </div>

          <div className="mt-5 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setIsFormOpen(false);
                setError(null);
              }}
              className="rounded-md border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isAdding}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-accent disabled:opacity-60"
            >
              {isAdding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Save medication
            </button>
          </div>
        </form>
      ) : null}

      <div className="mt-10 grid gap-5 md:grid-cols-2">
        {isLoading ? (
          <div className="rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground md:col-span-2">
            <Loader2 className="mx-auto mb-3 h-6 w-6 animate-spin text-primary" />
            Loading medications...
          </div>
        ) : medications.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground md:col-span-2">
            No medications added yet.
          </div>
        ) : medications.map((m) => (
          <article
            key={m.id}
            className="group rounded-lg border border-border bg-card p-6 transition-shadow hover:shadow-elegant"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/5 text-primary">
                  <Pill className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="font-serif text-lg leading-tight text-foreground">{m.name}</h2>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {m.dosage} · {m.frequency}
                  </p>
                </div>
              </div>
              <span
                className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${
                  m.source === "hospital"
                    ? "border-primary/30 bg-primary/5 text-primary"
                    : "border-gold/40 bg-gold/10 text-gold-foreground"
                }`}
              >
                {m.source === "hospital" ? <Hospital className="h-2.5 w-2.5" /> : <User2 className="h-2.5 w-2.5" />}
                {m.source === "hospital" ? "Hospital" : "Patient-added"}
              </span>
            </div>

            <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 text-xs">
              <div>
                <dt className="text-muted-foreground">Schedule</dt>
                <dd className="mt-0.5 font-mono text-foreground">{m.time}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Purpose</dt>
                <dd className="mt-0.5 text-foreground">{m.purpose}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Prescriber</dt>
                <dd className="mt-0.5 text-foreground">{m.prescriber}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Adherence (30d)</dt>
                <dd className="mt-1.5">
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className={`h-full rounded-full ${
                        m.adherence > 0.8 ? "bg-success" : m.adherence > 0.6 ? "bg-warning" : "bg-destructive"
                      }`}
                      style={{ width: `${m.adherence * 100}%` }}
                    />
                  </div>
                  <span className="mt-1 block font-mono text-[10px] text-muted-foreground">
                    {Math.round(m.adherence * 100)}%
                  </span>
                </dd>
              </div>
            </dl>

            {m.sideEffects.length > 0 && (
              <div className="mt-5 border-t border-border pt-4">
                <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted-foreground">
                  <AlertCircle className="h-3 w-3" /> Reported side effects
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {m.sideEffects.map((s) => (
                    <span key={s} className="rounded border border-border bg-muted px-2 py-0.5 text-[11px] text-foreground">
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </article>
        ))}
      </div>
    </div>
  );
}
