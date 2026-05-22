import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Pin, ShieldAlert, Brain, Pencil, Trash2, Save, X } from "lucide-react";
import { CurableLoader } from "@/components/CurableLoader";
import { deletePatientMemoryFact, getPatientProfileState, updatePatientMemoryFact } from "@/api/auth";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "Health Profile · Curable" },
      { name: "description", content: "Persistent long-term medical identity feeding context into every AI response." },
    ],
  }),
  component: ProfilePage,
});

interface Memory {
  id: string;
  label: string;
  layer: number;
  details: string;
  since: string;
}

interface Patient {
  name: string;
  age: number;
  sex: string;
  bloodGroup: string;
  allergies: string[];
  conditions: string[];
  pinnedByDoctor: string;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-border bg-card p-6">
      <h2 className="font-serif text-lg text-foreground">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function ProfilePage() {
  const { patientId, displayName } = useAuth();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [editingMemory, setEditingMemory] = useState<string | null>(null);
  const [draftMemory, setDraftMemory] = useState({ label: "", details: "" });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      if (!patientId) {
        setIsLoading(false);
        return;
      }
      try {
        setIsLoading(true);

        const { patient: pDetails, memories: mems } = await getPatientProfileState({ data: { patientId } });

        let profileData: Patient;

        if (pDetails) {
          profileData = {
            name: pDetails.full_name,
            age: pDetails.age,
            sex: pDetails.sex,
            bloodGroup: pDetails.blood_group,
            allergies: pDetails.allergies || [],
            conditions: pDetails.conditions || [],
            pinnedByDoctor: pDetails.pinned_by_doctor || "None",
          };
        } else {
          profileData = {
            name: displayName,
            age: 0,
            sex: "",
            bloodGroup: "",
            allergies: [],
            conditions: [],
            pinnedByDoctor: "None",
          };
        }
        setPatient(profileData);

        if (mems) {
          setMemories(
            mems.map((m) => ({
              id: m.id,
              label: m.label,
              layer: m.layer,
              details: m.details,
              since: new Date(m.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }),
            }))
          );
        }
      } catch (err: any) {
        console.error("Profile fetch error:", err);
        setError(err.message || "Failed to load profile data");
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, [displayName, patientId]);

  const startEdit = (memory: Memory) => {
    setEditingMemory(memory.id);
    setDraftMemory({ label: memory.label, details: memory.details });
  };

  const cancelEdit = () => {
    setEditingMemory(null);
    setDraftMemory({ label: "", details: "" });
  };

  const saveMemory = async (id: string) => {
    try {
      await updatePatientMemoryFact({
        data: {
          id,
          label: draftMemory.label,
          details: draftMemory.details,
        },
      });
    } catch (err: any) {
      setError(err.message || "Could not update this memory fact.");
      return;
    }

    setMemories((prev) =>
      prev.map((m) => (m.id === id ? { ...m, label: draftMemory.label, details: draftMemory.details } : m))
    );
    cancelEdit();
  };

  const deleteMemory = async (id: string) => {
    try {
      await deletePatientMemoryFact({ data: { id } });
    } catch (err: any) {
      setError(err.message || "Could not delete this memory fact.");
      return;
    }

    setMemories((prev) => prev.filter((m) => m.id !== id));
  };

  if (isLoading) {
    return <CurableLoader message="Loading medical profile..." />;
  }

  if (error || !patient) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-background p-6 text-center">
        <ShieldAlert className="h-12 w-12 text-destructive mb-4" />
        <h2 className="font-serif text-2xl text-foreground mb-2">Profile Error</h2>
        <p className="text-muted-foreground max-w-md mb-6">{error || "Patient not found."}</p>
        <button 
          onClick={() => window.location.reload()}
          className="rounded-md bg-primary px-6 py-2 text-sm font-medium text-primary-foreground hover:bg-accent"
        >
          Try Again
        </button>
      </div>
    );
  }

  const genotype = memories.find((memory) => memory.label.toLowerCase() === "genotype")?.details || "";
  const occupation = memories.find((memory) => memory.label.toLowerCase() === "occupation")?.details || "";

  return (
    <div className="container-page py-10">
      <div className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">Page 04</div>
      <h1 className="mt-1 font-serif text-3xl text-foreground">Patient Health Profile</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        The persistent medical identity. Every AI response retrieves from here before responding.
      </p>

      <div className="mt-10 grid gap-6 lg:grid-cols-3">
        <Section title="Basic profile">
          <dl className="space-y-3 text-sm">
            <Row k="Name" v={patient.name} />
            <Row k="Age" v={`${patient.age}`} />
            <Row k="Sex" v={patient.sex} />
            {occupation ? <Row k="Occupation" v={occupation} /> : null}
            <Row k="Blood group" v={patient.bloodGroup} />
            {genotype ? <Row k="Genotype" v={genotype} /> : null}
          </dl>
        </Section>

        <Section title="Allergies">
          <ul className="space-y-2">
            {patient.allergies.length > 0 ? (
              patient.allergies.map((a) => (
                <li
                  key={a}
                  className="flex items-center justify-between rounded border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
                >
                  {a}
                  <span className="font-mono text-[10px] uppercase tracking-wider">Avoid</span>
                </li>
              ))
            ) : (
              <li className="text-sm text-muted-foreground italic">No known allergies.</li>
            )}
          </ul>
        </Section>

        <Section title="Conditions">
          <ul className="space-y-2 text-sm">
            {patient.conditions.length > 0 ? (
              patient.conditions.map((c) => (
                <li key={c} className="rounded border border-border bg-surface px-3 py-2 text-foreground">
                  {c}
                </li>
              ))
            ) : (
              <li className="text-sm text-muted-foreground italic">No known conditions.</li>
            )}
          </ul>
        </Section>

        <div className="lg:col-span-3">
          <div className="rounded-lg border border-gold/40 bg-gold/10 p-6">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-gold-foreground/80">
              <Pin className="h-3 w-3" /> Doctor-pinned memory · permanent AI context
            </div>
            <p className="mt-2 font-serif text-lg leading-snug text-foreground">{patient.pinnedByDoctor}</p>
          </div>
        </div>

        <div className="lg:col-span-3">
          <Section title="Longitudinal timeline">
            <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {memories.length > 0 ? (
                memories
                  .filter((m) => m.layer === 3 || m.layer === 2) // Episodic or Behavioral
                  .map((t, i) => (
                    <li key={i} className="rounded border border-border bg-surface p-4">
                      <div className="font-mono text-[10px] uppercase tracking-wider text-gold-foreground/70">
                        {t.since}
                      </div>
                      <div className="mt-1 text-sm font-medium text-foreground">{t.label}</div>
                      <div className="mt-1 text-xs leading-relaxed text-muted-foreground">{t.details}</div>
                    </li>
                  ))
              ) : (
                <li className="lg:col-span-4 rounded border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                  No timeline events recorded yet. Memory accumulates during AI chat.
                </li>
              )}
            </ol>
          </Section>
        </div>

        <div className="lg:col-span-3">
          <Section title="AI memory facts">
            <div className="mb-4 flex items-start gap-3 rounded-md border border-border bg-surface p-4">
              <Brain className="mt-0.5 h-4 w-4 text-primary" />
              <p className="text-sm leading-relaxed text-muted-foreground">
                Curable saves important facts from AI conversations here automatically. You can edit
                anything that is incomplete or remove facts that should not stay in your profile.
              </p>
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              {[1, 2, 3].map((layer) => {
                const layerMemories = memories.filter((m) => m.layer === layer);
                return (
                  <div key={layer} className="rounded-md border border-border bg-background p-4">
                    <div className="mb-3">
                      <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                        Layer {layer}
                      </div>
                      <h3 className="mt-1 font-serif text-base text-foreground">
                        {layer === 1 ? "Profile facts" : layer === 2 ? "Patterns & medication signals" : "Recent events"}
                      </h3>
                    </div>

                    <div className="space-y-3">
                      {layerMemories.length ? (
                        layerMemories.map((memory) => {
                          const isEditing = editingMemory === memory.id;
                          return (
                            <article key={memory.id} className="rounded border border-border bg-card p-3">
                              {isEditing ? (
                                <div className="space-y-2">
                                  <input
                                    value={draftMemory.label}
                                    onChange={(e) => setDraftMemory((prev) => ({ ...prev, label: e.target.value }))}
                                    className="w-full rounded border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring"
                                  />
                                  <textarea
                                    value={draftMemory.details}
                                    onChange={(e) => setDraftMemory((prev) => ({ ...prev, details: e.target.value }))}
                                    className="min-h-24 w-full rounded border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring"
                                  />
                                  <div className="flex gap-2">
                                    <button
                                      type="button"
                                      onClick={() => saveMemory(memory.id)}
                                      className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground"
                                    >
                                      <Save className="h-3 w-3" /> Save
                                    </button>
                                    <button
                                      type="button"
                                      onClick={cancelEdit}
                                      className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground"
                                    >
                                      <X className="h-3 w-3" /> Cancel
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <>
                                  <div className="flex items-start justify-between gap-3">
                                    <div>
                                      <h4 className="text-sm font-medium text-foreground">{memory.label}</h4>
                                      <div className="mt-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                                        Saved {memory.since}
                                      </div>
                                    </div>
                                    <div className="flex shrink-0 gap-1">
                                      <button
                                        type="button"
                                        onClick={() => startEdit(memory)}
                                        className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-muted hover:text-foreground"
                                        aria-label={`Edit ${memory.label}`}
                                      >
                                        <Pencil className="h-3.5 w-3.5" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => deleteMemory(memory.id)}
                                        className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-destructive/30 text-destructive hover:bg-destructive/10"
                                        aria-label={`Delete ${memory.label}`}
                                      >
                                        <Trash2 className="h-3.5 w-3.5" />
                                      </button>
                                    </div>
                                  </div>
                                  <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{memory.details}</p>
                                </>
                              )}
                            </article>
                          );
                        })
                      ) : (
                        <div className="rounded border border-dashed border-border p-4 text-sm text-muted-foreground">
                          No facts saved in this layer yet.
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </Section>
        </div>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between border-b border-border pb-2 last:border-0">
      <dt className="text-muted-foreground">{k}</dt>
      <dd className="font-medium text-foreground">{v}</dd>
    </div>
  );
}
