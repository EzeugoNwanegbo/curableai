import { Link, createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
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
import { getActiveConsultation, getConsultationMessages, sendConsultationMessage } from "@/api/consultation";
import { getPatientDoctorConnection, removePatientDoctorConnection, savePatientDoctorConnection } from "@/api/doctor-connection";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/consultation")({
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
  const { patientId, role } = useAuth();
  const [consultation, setConsultation] = useState<Consultation | null>(null);
  const [doctorConnection, setDoctorConnection] = useState<DoctorConnection | null>(null);
  const [doctorForm, setDoctorForm] = useState({ doctorName: "", doctorEmail: "", clinicName: "" });
  const [messages, setMessages] = useState<ConsultationMessage[]>([]);
  const [input, setInput] = useState("");
  const [doctorInput, setDoctorInput] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingDoctor, setIsSavingDoctor] = useState(false);
  const [doctorNotice, setDoctorNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadConsultation() {
      try {
        const [active, connection] = await Promise.all([
          getActiveConsultation({ data: { patientId: role === "patient" ? patientId || undefined : undefined } }),
          role === "patient" && patientId
            ? getPatientDoctorConnection({ data: { patientId } })
            : Promise.resolve(null),
        ]);

        setDoctorConnection(connection as DoctorConnection | null);
        if (connection) {
          setDoctorForm({
            doctorName: (connection as DoctorConnection).doctorName || "",
            doctorEmail: (connection as DoctorConnection).doctorEmail || "",
            clinicName: (connection as DoctorConnection).clinicName || "",
          });
        }

        setConsultation(active as Consultation | null);
        if (active?.id) {
          const savedMessages = await getConsultationMessages({ data: { consultationId: active.id } });
          setMessages(
            (savedMessages as ConsultationMessage[]).length
              ? (savedMessages as ConsultationMessage[])
              : [
                  {
                    id: "welcome",
                    role: "doctor",
                    text: "Hello, I have received your report. I will ask a few focused questions so we can understand what is happening.",
                    time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
                  },
                ]
          );
        }
      } catch (err: any) {
        setError(err.message || "Could not load consultation.");
      } finally {
        setIsLoading(false);
      }
    }
    loadConsultation();
  }, [patientId, role]);

  const saveDoctor = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!patientId || role !== "patient") return;
    setIsSavingDoctor(true);
    setDoctorNotice(null);
    setError(null);

    try {
      const saved = await savePatientDoctorConnection({
        data: {
          patientId,
          doctorName: doctorForm.doctorName,
          doctorEmail: doctorForm.doctorEmail,
          clinicName: doctorForm.clinicName,
        },
      });

      setDoctorConnection(saved as DoctorConnection);
      setDoctorForm({
        doctorName: (saved as DoctorConnection)?.doctorName || "",
        doctorEmail: (saved as DoctorConnection)?.doctorEmail || "",
        clinicName: (saved as DoctorConnection)?.clinicName || "",
      });
      setDoctorNotice("Validating doctor saved.");
    } catch (err: any) {
      setError(err.message || "Could not save this doctor.");
    } finally {
      setIsSavingDoctor(false);
    }
  };

  const removeDoctor = async () => {
    if (!patientId || role !== "patient") return;
    setIsSavingDoctor(true);
    setDoctorNotice(null);

    try {
      await removePatientDoctorConnection({ data: { patientId } });
      setDoctorConnection(null);
      setDoctorForm({ doctorName: "", doctorEmail: "", clinicName: "" });
      setDoctorNotice("Validating doctor removed.");
    } catch (err: any) {
      setError(err.message || "Could not remove this doctor.");
    } finally {
      setIsSavingDoctor(false);
    }
  };

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
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: Math.random().toString(),
          role: "patient",
          text: content,
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
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
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: Math.random().toString(),
          role: "doctor",
          text: content,
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
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
      <DoctorValidationComingSoon role={role} />
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
                {consultation.doctorName || doctorConnection?.doctorName || "Doctor"} with {consultation.patientName}
              </h1>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-success/30 bg-success/10 px-3 py-1 text-xs font-medium text-success">
              <span className="h-1.5 w-1.5 rounded-full bg-success" /> Doctor joined
            </span>
          </div>
        </header>

        <div className="flex-1 space-y-5 overflow-y-auto px-8 py-8">
          {messages.map((message) => (
            <div key={message.id} className={message.role === "patient" ? "flex justify-end" : ""}>
              <div className={`max-w-[78%] ${message.role === "patient" ? "" : "w-full"}`}>
                <div className="mb-1.5 flex items-center gap-2 text-[11px] uppercase tracking-wider text-muted-foreground">
                  {message.role === "doctor" ? <Stethoscope className="h-3 w-3 text-primary" /> : <UserRound className="h-3 w-3 text-primary" />}
                  {message.role === "doctor" ? consultation.doctorName || doctorConnection?.doctorName || "Doctor" : "You"} · {message.time}
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
            <DoctorConnectionCard
              connection={doctorConnection}
              form={doctorForm}
              setForm={setDoctorForm}
              isSaving={isSavingDoctor}
              notice={doctorNotice}
              onSave={saveDoctor}
              onRemove={removeDoctor}
              compact
            />
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
          <form className="mt-4 rounded-md border border-accent/40 bg-accent/5 p-4" onSubmit={handleDoctorSend}>
            <div className="text-[11px] font-medium uppercase tracking-wider text-accent">Doctor reply</div>
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

const targetHospitals = [
  "National Hospital Abuja",
  "Garki Hospital Abuja",
  "Nisa Premier Hospital",
  "Cedarcrest Hospitals Abuja",
  "Abuja Clinics",
];

function DoctorValidationComingSoon({ role }: { role: "patient" | "doctor" | null }) {
  const patientBenefits = [
    "Doctor validation of Curable's AI reasoning before you act on it.",
    "Doctor suggestions on safer next steps, tests to consider, or when to visit a clinic.",
    "A structured report, not a raw chat dump, so the doctor can review faster.",
  ];

  const doctorBenefits = [
    "Review clear AI-generated summaries instead of long unstructured messages.",
    "Give focused validation or correction from your phone during free time.",
    "Get paid for useful medical advice without running a full telemedicine session.",
  ];

  return (
    <div className="min-h-screen bg-background">
      <section className="container-page py-8 sm:py-12">
        <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-start">
          <div className="rounded-lg border border-border bg-card p-6 shadow-elegant sm:p-8">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              <Sparkles className="h-3.5 w-3.5" /> Doctor validation is coming soon
            </div>

            <h1 className="mt-5 font-serif text-3xl leading-tight text-foreground sm:text-4xl">
              Get Curable's AI suggestions reviewed by doctors practicing around top Abuja
              hospitals.
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
              Curable is building a paid doctor-validation layer for users who want a professional
              second look after the AI explains possible causes and safer next steps.
            </p>

            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <div className="rounded-md border border-border bg-surface p-4">
                <Banknote className="h-4 w-4 text-primary" />
                <div className="mt-2 text-sm font-semibold text-foreground">NGN 1,000</div>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  Planned launch price per doctor review.
                </p>
              </div>
              <div className="rounded-md border border-border bg-surface p-4">
                <FileText className="h-4 w-4 text-primary" />
                <div className="mt-2 text-sm font-semibold text-foreground">Structured report</div>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  Doctors review summaries, reasoning, and context.
                </p>
              </div>
              <div className="rounded-md border border-border bg-surface p-4">
                <Clock3 className="h-4 w-4 text-primary" />
                <div className="mt-2 text-sm font-semibold text-foreground">Coming soon</div>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  Payments open when the doctor network is ready.
                </p>
              </div>
            </div>

            <div className="mt-6 rounded-md border border-gold/40 bg-gold/10 p-4">
              <div className="text-sm font-semibold text-foreground">
                Abuja doctor network in progress
              </div>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                We are not showing individual doctors yet. The first version is being positioned
                around doctors who practice in Abuja, with target coverage across hospitals such as:
              </p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {targetHospitals.map((hospital) => (
                  <div
                    key={hospital}
                    className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground"
                  >
                    <Building2 className="h-3.5 w-3.5 text-primary" />
                    {hospital}
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              {role === "doctor" ? (
                <Link
                  to="/doctor"
                  className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-accent"
                >
                  Open doctor dashboard <ArrowRight className="h-4 w-4" />
                </Link>
              ) : (
                <Link
                  to="/chat"
                  className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-accent"
                >
                  Continue with AI chat <ArrowRight className="h-4 w-4" />
                </Link>
              )}
              <Link
                to="/auth"
                className="inline-flex items-center justify-center gap-2 rounded-md border border-border bg-background px-4 py-2.5 text-sm font-semibold text-foreground hover:bg-muted"
              >
                Doctor sign-up
              </Link>
            </div>
          </div>

          <div className="grid gap-4">
            <section className="rounded-lg border border-border bg-card p-5 shadow-elegant">
              <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
                <UserRound className="h-3.5 w-3.5 text-primary" /> For patients
              </div>
              <h2 className="mt-2 font-serif text-xl text-foreground">Pay for a second look</h2>
              <div className="mt-4 grid gap-3">
                {patientBenefits.map((benefit) => (
                  <div key={benefit} className="flex gap-3 text-sm leading-relaxed text-foreground">
                    <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                    {benefit}
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-lg border border-border bg-card p-5 shadow-elegant">
              <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
                <Stethoscope className="h-3.5 w-3.5 text-primary" /> For doctors
              </div>
              <h2 className="mt-2 font-serif text-xl text-foreground">
                Get paid for focused validation
              </h2>
              <div className="mt-4 grid gap-3">
                {doctorBenefits.map((benefit) => (
                  <div key={benefit} className="flex gap-3 text-sm leading-relaxed text-foreground">
                    <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                    {benefit}
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-lg border border-accent/30 bg-accent/5 p-5">
              <div className="text-sm font-semibold text-foreground">What happens now?</div>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Keep using Curable AI for symptom reasoning. When doctor validation launches, this
                page will become the payment and doctor-review entry point.
              </p>
            </section>
          </div>
        </div>
      </section>
    </div>
  );
}

function DoctorConnectionCard({
  connection,
  form,
  setForm,
  isSaving,
  notice,
  onSave,
  onRemove,
  compact = false,
}: {
  connection: DoctorConnection | null;
  form: { doctorName: string; doctorEmail: string; clinicName: string };
  setForm: React.Dispatch<React.SetStateAction<{ doctorName: string; doctorEmail: string; clinicName: string }>>;
  isSaving: boolean;
  notice: string | null;
  onSave: (event: React.FormEvent) => void;
  onRemove: () => void;
  compact?: boolean;
}) {
  return (
    <section className="rounded-lg border border-border bg-card p-5 shadow-elegant">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
            <UserPlus className="h-3.5 w-3.5 text-primary" /> Validating doctor
          </div>
          <h2 className="mt-1 font-serif text-lg text-foreground">
            {connection?.doctorName ? connection.doctorName : "Add your doctor"}
          </h2>
        </div>
        {connection?.doctorName ? (
          <span className="rounded-full border border-success/30 bg-success/10 px-2.5 py-1 text-[11px] font-medium text-success">
            Active
          </span>
        ) : null}
      </div>

      {connection?.doctorName ? (
        <div className="mt-4 rounded-md border border-success/30 bg-success/10 p-3 text-sm">
          <div className="font-medium text-foreground">{connection.doctorName}</div>
          {connection.doctorEmail ? <div className="mt-1 text-xs text-muted-foreground">{connection.doctorEmail}</div> : null}
          {connection.clinicName ? <div className="mt-1 text-xs text-muted-foreground">{connection.clinicName}</div> : null}
        </div>
      ) : null}

      <form className="mt-4 grid gap-3" onSubmit={onSave}>
        <label className="text-sm">
          <span className="text-xs font-medium text-muted-foreground">Doctor name</span>
          <input
            value={form.doctorName}
            onChange={(event) => setForm((prev) => ({ ...prev, doctorName: event.target.value }))}
            placeholder="Doctor name"
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring"
            required
          />
        </label>

        <label className="text-sm">
          <span className="text-xs font-medium text-muted-foreground">Doctor email</span>
          <input
            value={form.doctorEmail}
            onChange={(event) => setForm((prev) => ({ ...prev, doctorEmail: event.target.value }))}
            placeholder="Doctor email"
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring"
          />
        </label>

        {!compact ? (
          <label className="text-sm">
            <span className="text-xs font-medium text-muted-foreground">Clinic or hospital</span>
            <input
              value={form.clinicName}
              onChange={(event) => setForm((prev) => ({ ...prev, clinicName: event.target.value }))}
              placeholder="Clinic or hospital name"
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring"
            />
          </label>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            disabled={isSaving}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:bg-accent disabled:opacity-60"
          >
            {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Save doctor
          </button>
          {connection?.doctorName ? (
            <button
              type="button"
              onClick={onRemove}
              disabled={isSaving}
              className="inline-flex items-center gap-1.5 rounded-md border border-destructive/30 px-3 py-2 text-xs font-medium text-destructive hover:bg-destructive/10 disabled:opacity-60"
            >
              <Trash2 className="h-3.5 w-3.5" /> Remove
            </button>
          ) : null}
        </div>
      </form>

      {notice ? <p className="mt-3 text-xs text-success">{notice}</p> : null}
    </section>
  );
}
