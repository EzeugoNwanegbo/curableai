import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Loader2,
  ArrowRight,
  BadgeCheck,
  Banknote,
  Building2,
  Clock3,
  FileText,
  Save,
  Send,
  ShieldAlert,
  Sparkles,
  Stethoscope,
  Trash2,
  UserPlus,
  UserRound,
} from "lucide-react";
import { CurableLoader } from "@/components/CurableLoader";
import { RiskBadge } from "@/components/RiskBadge";
import {
  getActiveConsultation,
  getConsultationMessages,
  sendConsultationMessage,
} from "@/api/consultation";
import {
  getPatientDoctorConnection,
  removePatientDoctorConnection,
  savePatientDoctorConnection,
} from "@/api/doctor-connection";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/consultation")({
  validateSearch: (search: Record<string, unknown>): { id?: string } => ({
    id: typeof search.id === "string" && /^[0-9a-f-]{36}$/i.test(search.id) ? search.id : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Doctor Consultation · Curable" },
      { name: "description", content: "A separate doctor-patient consultation room." },
    ],
  }),
  component: ConsultationPage,
});

interface Consultation {
  id: string;
  patientId: string;
  patientName: string;
  doctorName?: string;
  summary: string;
  risk: string;
  reportDetails: string;
  createdAt: string;
}

interface ConsultationMessage {
  id: string;
  role: "doctor" | "patient";
  text: string;
  time: string;
}

interface DoctorConnection {
  doctorName: string;
  doctorEmail?: string;
  clinicName?: string;
}

function ConsultationPage() {
  const { id: consultationId } = Route.useSearch();
  const { patientId, role } = useAuth();
  const [consultation, setConsultation] = useState<Consultation | null>(null);
  const [doctorConnection, setDoctorConnection] = useState<DoctorConnection | null>(null);
  const [messages, setMessages] = useState<ConsultationMessage[]>([]);
  const [doctorNotice, setDoctorNotice] = useState("");
  const [ratingNotice, setRatingNotice] = useState("");
  const [input, setInput] = useState("");
  const [doctorInput, setDoctorInput] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadConsultation() {
      try {
        const [active, connection] = await Promise.all([
          getActiveConsultation({
            data: {
              patientId: role === "patient" ? patientId || undefined : undefined,
              consultationId,
            },
          }),
          role === "patient" && patientId
            ? getPatientDoctorConnection({ data: { patientId } })
            : Promise.resolve(null),
        ]);

        setDoctorConnection(connection as DoctorConnection | null);
        setConsultation(active as Consultation | null);
        if (active?.id) {
          const savedMessages = await getConsultationMessages({
            data: { consultationId: active.id },
          });
          setMessages(savedMessages as ConsultationMessage[]);
        }
      } catch (err: any) {
        setError(err.message || "Could not load consultation.");
      } finally {
        setIsLoading(false);
      }
    }
    let active = true;
    const refresh = () => {
      if (active) void loadConsultation();
    };
    refresh();
    const timer = window.setInterval(refresh, 10000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [patientId, role, consultationId]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !consultation) return;
    const content = input;
    setInput("");
    try {
      const saved = await sendConsultationMessage({
        data: {
          consultationId: consultation.id,
          patientId: consultation.patientId,
          role: "patient",
          content,
        },
      });
      setMessages((prev) => [...prev, saved as ConsultationMessage]);
    } catch (err) {
      setInput(content);
      setDoctorNotice(
        err instanceof Error ? err.message : "Message was not sent. Please try again.",
      );
    }
  };

  const handleDoctorSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!doctorInput.trim() || !consultation) return;
    const content = doctorInput;
    setDoctorInput("");
    try {
      const saved = await sendConsultationMessage({
        data: {
          consultationId: consultation.id,
          patientId: consultation.patientId,
          role: "doctor",
          content,
        },
      });
      setMessages((prev) => [...prev, saved as ConsultationMessage]);
    } catch (err) {
      setDoctorInput(content);
      setDoctorNotice(
        err instanceof Error ? err.message : "Message was not sent. Please try again.",
      );
    }
  };

  if (isLoading) {
    return <CurableLoader message="Opening doctor consultation..." />;
  }

  if (error) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-background p-6 text-center">
        <ShieldAlert className="mb-4 h-12 w-12 text-destructive" />
        <h2 className="mb-2 font-serif text-2xl text-foreground">Consultation Error</h2>
        <p className="max-w-md text-muted-foreground">{error}</p>
      </div>
    );
  }

  if (!consultation) {
    return (
      <div className="container-page py-10">
        <h1 className="text-3xl">Doctors</h1>

        <p className="mt-3 mb-8 text-sm text-muted-foreground">
          {role === "doctor"
            ? "Accept a confirmed student request from your review queue to begin a conversation."
            : "Choose your doctor, discuss your concern with Curable, then review and confirm your summary. A separate conversation opens when the doctor accepts."}
        </p>
        {role === "patient" ? (
          <DoctorDirectory />
        ) : (
          <Link to="/doctor" className="rounded-lg bg-primary px-5 py-3 text-primary-foreground">
            Open review requests
          </Link>
        )}
      </div>
    );
  }

  return (
    <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[1fr_380px]">
      <div className="flex h-screen flex-col border-r border-border bg-background">
        <header className="border-b border-border bg-card px-8 py-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
                Doctor Consultation
              </div>
              <h1 className="mt-1 font-serif text-2xl text-foreground">
                {consultation.doctorName || doctorConnection?.doctorName || "Doctor"} with{" "}
                {consultation.patientName}
              </h1>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-success/30 bg-success/10 px-3 py-1 text-xs font-medium text-success">
              <span className="h-1.5 w-1.5 rounded-full bg-success" /> Doctor joined
            </span>
          </div>
        </header>

        {doctorNotice && <p role="alert">{doctorNotice}</p>}
        {role === "patient" && (
          <label className="px-5 py-2 text-sm">
            Rate this consultation
            <select
              defaultValue=""
              className="ml-2 rounded bg-card p-2"
              onChange={async (e) => {
                const field = e.currentTarget;
                field.disabled = true;
                try {
                  const { error } = await supabase.rpc("curable_rate_visit", {
                    visit: consultation.id,
                    score: Number(field.value),
                  });
                  setRatingNotice(error ? "Rating unavailable for this visit." : "Rating saved.");
                  if (error) field.value = "";
                } finally {
                  field.disabled = false;
                }
              }}
            >
              <option disabled value="">
                Choose stars
              </option>
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {n} / 5
                </option>
              ))}
            </select>
            <span role="status"> {ratingNotice}</span>
          </label>
        )}
        <div className="flex-1 space-y-5 overflow-y-auto px-8 py-8">
          {messages.map((message) => (
            <div key={message.id} className={message.role === "patient" ? "flex justify-end" : ""}>
              <div className={`max-w-[78%] ${message.role === "patient" ? "" : "w-full"}`}>
                <div className="mb-1.5 flex items-center gap-2 text-[11px] uppercase tracking-wider text-muted-foreground">
                  {message.role === "doctor" ? (
                    <Stethoscope className="h-3 w-3 text-primary" />
                  ) : (
                    <UserRound className="h-3 w-3 text-primary" />
                  )}
                  {message.role === "doctor"
                    ? consultation.doctorName || doctorConnection?.doctorName || "Doctor"
                    : "You"}{" "}
                  · {message.time}
                </div>
                <div
                  className={`rounded-lg px-4 py-3 text-sm leading-relaxed ${
                    message.role === "patient"
                      ? "bg-primary text-primary-foreground"
                      : "border border-border bg-card text-card-foreground"
                  }`}
                >
                  {message.text}
                </div>
              </div>
            </div>
          ))}
        </div>

        {role === "patient" ? (
          <form className="border-t border-border bg-card px-8 py-4" onSubmit={handleSend}>
            <div className="flex items-center gap-3 rounded-lg border border-input bg-background px-3 py-2 focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/20">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={`Reply to ${consultation.doctorName || doctorConnection?.doctorName || "doctor"}...`}
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
              <button
                type="submit"
                className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground hover:bg-accent"
                aria-label="Send"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </form>
        ) : null}
      </div>

      <aside className="hidden h-screen overflow-y-auto bg-surface px-6 py-7 lg:block">
        {role === "patient" ? (
          <div className="mb-5">
            <DoctorDirectory />
          </div>
        ) : null}

        <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
          <FileText className="h-3 w-3" /> Attached report
        </div>
        <h2 className="mt-2 font-serif text-lg text-foreground">Doctor review context</h2>

        <div className="mt-5 rounded-md border border-border bg-card p-4">
          <div className="mb-2 flex items-center gap-2">
            <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Situation
            </span>
            <RiskBadge level={consultation.risk as any} />
          </div>
          <p className="text-sm leading-relaxed text-foreground">{consultation.summary}</p>
        </div>

        <div className="mt-4 rounded-md border border-border bg-card p-4">
          <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Report details
          </div>
          <pre className="mt-2 whitespace-pre-wrap font-sans text-xs leading-relaxed text-foreground">
            {consultation.reportDetails}
          </pre>
        </div>

        {role === "doctor" ? (
          <form
            className="mt-4 rounded-md border border-accent/40 bg-accent/5 p-4"
            onSubmit={handleDoctorSend}
          >
            <div className="text-[11px] font-medium uppercase tracking-wider text-accent">
              Doctor reply
            </div>
            <textarea
              value={doctorInput}
              onChange={(e) => setDoctorInput(e.target.value)}
              placeholder={`Write as ${consultation.doctorName || "doctor"}...`}
              className="mt-2 min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring"
            />
            <button
              type="submit"
              className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:bg-accent"
            >
              <Send className="h-3.5 w-3.5" /> Send doctor message
            </button>
          </form>
        ) : null}
      </aside>
    </div>
  );
}

type DoctorListing = {
  id: string;
  name: string;
  specialty: string | null;
  workplace: string;
  rating: number | null;
  ratings: number;
};

function DoctorDirectory() {
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const directory = useQuery({
    queryKey: ["approved-doctor-directory"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("curable_directory");
      if (error) throw error;
      return data as DoctorListing[];
    },
  });
  return (
    <section aria-label="Verified doctors" className="space-y-3">
      {directory.isPending && <p>Loading doctors…</p>}
      {directory.isError && (
        <button onClick={() => void directory.refetch()}>Couldn’t load doctors. Retry</button>
      )}
      {directory.data?.length === 0 && <p>No verified doctors listed yet.</p>}
      {directory.data?.map((d) => (
        <article key={d.id} className="rounded-lg border border-border p-4">
          <h2 className="font-semibold">{d.name}</h2>
          <p>{[d.specialty, d.workplace].filter(Boolean).join(" · ")}</p>
          <p className="text-sm text-muted-foreground">
            {d.ratings ? d.rating + " / 5 (" + d.ratings + " ratings)" : "No ratings yet"}
          </p>
          <button
            className="min-h-11 text-primary"
            disabled={saving}
            onClick={async () => {
              setSaving(true);
              try {
                const { error } = await supabase.rpc("curable_choose_doctor", { target: d.id });
                setNotice(
                  error
                    ? error.message.includes("Doctor change requires a new sharing authorization")
                      ? "You have already shared a request with a doctor. To choose another doctor, a new sharing authorization is needed."
                      : error.message.includes("Patient account required")
                        ? "A patient profile is needed to choose a doctor."
                        : "Couldn’t select this doctor. Please try again."
                    : d.name + " selected.",
                );
              } finally {
                setSaving(false);
              }
            }}
          >
            Choose doctor
          </button>
        </article>
      ))}
      <p role="status">{notice}</p>
    </section>
  );
}
