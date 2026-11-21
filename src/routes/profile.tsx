import { supabase } from "@/lib/supabase";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { Pin, ShieldAlert, Brain, Pencil, Trash2, Save, X } from "lucide-react";
import { CurableLoader } from "@/components/CurableLoader";
import {
  addPatientMemoryFact,
  deletePatientMemoryFact,
  getPatientProfileState,
  updatePatientMemoryFact,
} from "@/api/auth";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "Health Profile · Curable" },
      {
        name: "description",
        content: "Persistent long-term medical identity feeding context into every AI response.",
      },
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
  const { patientId, displayName, user } = useAuth();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [newFact, setNewFact] = useState({ label: "", details: "" });
  const [addingFact, setAddingFact] = useState(false);
  const [factNotice, setFactNotice] = useState("");
  const [editingMemory, setEditingMemory] = useState<string | null>(null);
  const [draftMemory, setDraftMemory] = useState({ label: "", details: "" });
  const [institution, setInstitution] = useState(String(user?.user_metadata?.advocacy_institution || ""));
  const [advocating, setAdvocating] = useState(false);
  const [advocacyNotice, setAdvocacyNotice] = useState("");
  const [supportAdded, setSupportAdded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const profileQuery = useQuery({
    queryKey: ["patient-profile", patientId],
    enabled: Boolean(patientId),
    queryFn: () => getPatientProfileState({ data: { patientId: patientId! } }),
  });

  useEffect(() => {
    if (!patientId) return;
    if (profileQuery.error) {
      console.error("Profile fetch error:", profileQuery.error);
      setError(profileQuery.error.message || "Failed to load profile data");
      return;
    }
    if (!profileQuery.data) return;

    const { patient: pDetails, memories: mems } = profileQuery.data;
    setPatient(
      pDetails
        ? {
            name: pDetails.full_name,
            age: pDetails.age,
            sex: pDetails.sex,
            bloodGroup: pDetails.blood_group,
            allergies: pDetails.allergies || [],
            conditions: pDetails.conditions || [],
            pinnedByDoctor: pDetails.pinned_by_doctor || "None",
          }
        : {
            name: displayName,
            age: 0,
            sex: "",
            bloodGroup: "",
            allergies: [],
            conditions: [],
            pinnedByDoctor: "None",
          },
    );
    setMemories(
      (mems || []).map((m) => ({
        id: m.id,
        label: m.label,
        layer: m.layer,
        details: m.details,
        since: new Date(m.created_at).toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
          year: "numeric",
        }),
      })),
    );
  }, [displayName, patientId, profileQuery.data, profileQuery.error]);

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
      prev.map((m) =>
        m.id === id ? { ...m, label: draftMemory.label, details: draftMemory.details } : m,
      ),
    );
    queryClient.invalidateQueries({ queryKey: ["patient-profile", patientId] });
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
    queryClient.invalidateQueries({ queryKey: ["patient-profile", patientId] });
  };

  if (!patientId || profileQuery.isLoading) {
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

  const genotype =
    memories.find((memory) => memory.label.toLowerCase() === "genotype")?.details || "";
  const occupation =
    memories.find((memory) => memory.label.toLowerCase() === "occupation")?.details || "";

  return (
    <div className="container-page py-10">
      <h1 className="mt-1 font-serif text-3xl text-foreground">Health record</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        The persistent medical identity. Every AI response retrieves from here before responding.
      </p>

      {supportAdded && <p role="status" className="mt-6 text-sm text-muted-foreground">Thank you for your support.</p>}
      {!supportAdded && !user?.user_metadata?.advocacy_supported_at && <section className="mt-8 rounded-xl border border-border bg-card p-6">
        <h2 className="text-lg">Bring Curable to your university or hospital</h2>
        <p className="mt-2 text-sm text-muted-foreground">Your support helps us show universities and hospitals where people want easier access to care and build partnerships with them.</p>
        <form className="mt-4 space-y-3" onSubmit={async (event) => {
          event.preventDefault();
          setAdvocating(true); setAdvocacyNotice("");
          const { error } = await supabase.auth.updateUser({ data: { advocacy_institution: institution.trim(), advocacy_supported_at: new Date().toISOString() } });
          if (error) setAdvocacyNotice("Could not save your support. Please try again.");
          else setSupportAdded(true);
          setAdvocating(false);
        }}>
          <label className="block text-sm">University or hospital
            <input required maxLength={150} value={institution} onChange={(event) => setInstitution(event.currentTarget.value)} placeholder="Enter its name" className="mt-2 block w-full rounded-lg border border-input bg-background p-3" />
          </label>
          <button disabled={advocating} className="min-h-11 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50">{advocating ? "Saving…" : "Add my support"}</button>
          {advocacyNotice && <p role="status" className="text-sm">{advocacyNotice}</p>}
        </form>
      </section>}
      <div className="mt-10 grid gap-6 lg:grid-cols-3">
        <Section title="Basic profile">
          <dl className="space-y-3 text-sm">
            <Row k="Name" v={patient.name} />
            <Row k="Age" v={patient.age ? `${patient.age}` : "Not recorded"} />
            <Row k="Sex" v={patient.sex || "Not recorded"} />
            {occupation ? <Row k="Occupation" v={occupation} /> : null}
            <Row k="Blood group" v={patient.bloodGroup || "Not recorded"} />
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
              <li className="text-sm text-muted-foreground italic">No allergies recorded.</li>
            )}
          </ul>
        </Section>

        <Section title="Conditions">
          <ul className="space-y-2 text-sm">
            {patient.conditions.length > 0 ? (
              patient.conditions.map((c) => (
                <li
                  key={c}
                  className="rounded border border-border bg-surface px-3 py-2 text-foreground"
                >
                  {c}
                </li>
              ))
            ) : (
              <li className="text-sm text-muted-foreground italic">No conditions recorded.</li>
            )}
          </ul>
        </Section>

        <div className="lg:col-span-3">
          <div className="rounded-lg border border-gold/40 bg-gold/10 p-6">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-gold-foreground/80">
              <Pin className="h-3 w-3" /> Doctor-pinned memory · permanent AI context
            </div>
            <p className="mt-2 font-serif text-lg leading-snug text-foreground">
              {patient.pinnedByDoctor}
            </p>
          </div>
        </div>

        <div className="lg:col-span-3">
          <details className="rounded-xl border border-border bg-card p-5">
            <summary className="cursor-pointer font-medium">
              Update or correct what Curable remembers
            </summary>
            <form
              className="mt-4 space-y-2"
              onSubmit={async (event) => {
                event.preventDefault();
                if (addingFact) return;
                setAddingFact(true);
                setFactNotice("");
                try {
                  await addPatientMemoryFact({ data: newFact });
                  setNewFact({ label: "", details: "" });
                  await Promise.all([
                    queryClient.invalidateQueries({ queryKey: ["patient-profile", patientId] }),
                    queryClient.invalidateQueries({ queryKey: ["patient-chat-state", patientId] }),
                  ]);
                  setFactNotice("Saved.");
                } catch {
                  setFactNotice("Could not save this detail. Try again.");
                } finally {
                  setAddingFact(false);
                }
              }}
            >
              <label className="block text-sm">
                What should Curable remember?
                <input
                  required
                  maxLength={100}
                  className="mt-1 block w-full rounded border border-input bg-background p-2"
                  placeholder="For example, exercise routine"
                  value={newFact.label}
                  onChange={(event) => setNewFact({ ...newFact, label: event.currentTarget.value })}
                />
              </label>
              <label className="block text-sm">
                Detail
                <input
                  required
                  maxLength={1000}
                  className="mt-1 block w-full rounded border border-input bg-background p-2"
                  value={newFact.details}
                  onChange={(event) =>
                    setNewFact({ ...newFact, details: event.currentTarget.value })
                  }
                />
              </label>
              <button type="submit" className="min-h-11 text-primary" disabled={addingFact}>
                Save detail
              </button>
              {factNotice && (
                <p role="status" className="text-sm">
                  {factNotice}
                </p>
              )}
            </form>
            <div className="mt-4">
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
                          {layer === 1
                            ? "Profile facts"
                            : layer === 2
                              ? "Patterns & medication signals"
                              : "Recent events"}
                        </h3>
                      </div>

                      <div className="space-y-3">
                        {layerMemories.length ? (
                          layerMemories.map((memory) => {
                            const isEditing = editingMemory === memory.id;
                            return (
                              <article
                                key={memory.id}
                                className="rounded border border-border bg-card p-3"
                              >
                                {isEditing ? (
                                  <div className="space-y-2">
                                    <input
                                      value={draftMemory.label}
                                      onChange={(e) =>
                                        setDraftMemory((prev) => ({
                                          ...prev,
                                          label: e.target.value,
                                        }))
                                      }
                                      className="w-full rounded border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring"
                                    />
                                    <textarea
                                      value={draftMemory.details}
                                      onChange={(e) =>
                                        setDraftMemory((prev) => ({
                                          ...prev,
                                          details: e.target.value,
                                        }))
                                      }
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
                                        <h4 className="text-sm font-medium text-foreground">
                                          {memory.label}
                                        </h4>
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
                                    <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                                      {memory.details}
                                    </p>
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
            </div>
          </details>
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
