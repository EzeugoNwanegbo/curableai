import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  Brain,
  Stethoscope,
  Eye,
  Layers,
  Workflow,
  ShieldCheck,
  MessageSquare,
  Pill,
  ClipboardList,
  User,
  Bell,
} from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Curable - Context-Aware Health Reasoning" },
      {
        name: "description",
        content:
          "Curable helps people understand symptoms earlier through persistent medical memory, transparent reasoning, and optional doctor validation.",
      },
    ],
  }),
  component: Overview,
});

const principles = [
  { icon: Layers, title: "Continuity of Care", body: "Medical context persists across chats, devices, hospital visits, and doctors." },
  { icon: Stethoscope, title: "Optional Doctor Validation", body: "Patients can send structured reports to a doctor they add when they want human review." },
  { icon: Eye, title: "Transparent Communication", body: "Patients see AI suggestions, review reports, and know when a doctor approved advice." },
  { icon: Brain, title: "Structured Intelligence", body: "The AI extracts memory, tracks symptoms, and monitors adherence - not just chat." },
  { icon: Workflow, title: "Reduced Doctor Workload", body: "Conversations become summaries, timelines, and alerts - not endless transcripts." },
  { icon: ShieldCheck, title: "Safety First", body: "Cautious responses, deterministic escalation, audit trails, human oversight." },
];

const systems = [
  { to: "/chat", icon: MessageSquare, n: "01", title: "AI Follow-up Chat", body: "First-line patient assistant with persistent medical memory and risk classification." },
  { to: "/medications", icon: Pill, n: "02", title: "Medication Management", body: "Hospital and patient-added medications, adherence tracking, side-effect intelligence." },
  { to: "/doctor", icon: ClipboardList, n: "03", title: "Doctor Dashboard", body: "Review queue, smart timelines, AI-assisted retrieval, conversation takeover." },
  { to: "/profile", icon: User, n: "04", title: "Patient Health Profile", body: "Longitudinal medical identity feeding context into every AI response." },
  { to: "/notifications", icon: Bell, n: "05", title: "Notifications & Follow-up", body: "Medication reminders, follow-up prompts, escalation alerts, appointments." },
];

function Overview() {
  return (
    <div>
      {/* Hero */}
      <section
        className="relative overflow-hidden border-b border-border"
        style={{ backgroundImage: "var(--gradient-hero)" }}
      >
        <div className="container-page py-20 lg:py-28">
          <div className="flex items-center gap-2">
            <span className="h-px w-10 bg-gold" />
            <span className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
              Curable
            </span>
          </div>

          <h1 className="mt-6 max-w-4xl font-serif text-4xl leading-[1.08] text-balance text-foreground sm:text-5xl lg:text-6xl">
            Context-aware health reasoning with optional doctor validation.
          </h1>

          <p className="mt-6 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            Curable is not a diagnosis replacement. It is a healthcare communication and follow-up
            platform - persistent medical memory, structured reports, and longitudinal
            patient intelligence in one coordinated workflow.
          </p>

          <div className="mt-10 flex flex-wrap gap-3">
            <Link
              to="/chat"
              className="group inline-flex items-center gap-2 rounded-md bg-primary px-5 py-3 text-sm font-medium text-primary-foreground shadow-elegant transition-all hover:bg-accent"
            >
              Enter the patient experience
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <Link
              to="/doctor"
              className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-5 py-3 text-sm font-medium text-foreground hover:bg-muted"
            >
              View doctor dashboard
            </Link>
          </div>

          <dl className="mt-16 grid max-w-3xl grid-cols-2 gap-8 sm:grid-cols-4">
            {[
              ["3", "Memory layers"],
              ["5", "Connected systems"],
              ["100%", "Doctor-validated escalations"],
              ["0", "Autonomous diagnoses"],
            ].map(([k, v]) => (
              <div key={v}>
                <dt className="font-serif text-3xl text-primary">{k}</dt>
                <dd className="mt-1 text-xs uppercase tracking-wider text-muted-foreground">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* Principles */}
      <section className="container-page py-20">
        <div className="flex items-end justify-between gap-6">
          <div>
            <span className="text-[11px] uppercase tracking-[0.22em] text-gold-foreground/70">
              Six principles
            </span>
            <h2 className="mt-3 max-w-2xl font-serif text-3xl text-foreground sm:text-4xl">
              The product is built around what doctors and patients actually need.
            </h2>
          </div>
        </div>

        <div className="mt-12 grid gap-px overflow-hidden rounded-lg border border-border bg-border md:grid-cols-2 lg:grid-cols-3">
          {principles.map(({ icon: Icon, title, body }) => (
            <div key={title} className="bg-card p-7 transition-colors hover:bg-surface">
              <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/5 text-primary">
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="mt-5 font-serif text-lg text-foreground">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Systems */}
      <section className="border-t border-border bg-surface">
        <div className="container-page py-20">
          <span className="text-[11px] uppercase tracking-[0.22em] text-gold-foreground/70">
            Five systems · one platform
          </span>
          <h2 className="mt-3 max-w-2xl font-serif text-3xl text-foreground sm:text-4xl">
            Explore each surface of Curable.
          </h2>

          <div className="mt-12 space-y-px overflow-hidden rounded-lg border border-border bg-border">
            {systems.map(({ to, icon: Icon, n, title, body }) => (
              <Link
                key={to}
                to={to}
                className="group flex items-center gap-6 bg-card p-6 transition-colors hover:bg-background sm:p-8"
              >
                <div className="font-mono text-sm text-gold-foreground/60">{n}</div>
                <div className="flex h-11 w-11 items-center justify-center rounded-md bg-primary text-primary-foreground">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <div className="font-serif text-lg text-foreground">{title}</div>
                  <div className="mt-1 text-sm text-muted-foreground">{body}</div>
                </div>
                <ArrowRight className="h-5 w-5 text-muted-foreground transition-all group-hover:translate-x-1 group-hover:text-primary" />
              </Link>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t border-border">
        <div className="container-page flex flex-wrap items-center justify-between gap-4 py-8 text-xs text-muted-foreground">
          <div>© Curable · Context-aware health reasoning</div>
          <div className="font-mono">v0.1 · investor preview</div>
        </div>
      </footer>
    </div>
  );
}
