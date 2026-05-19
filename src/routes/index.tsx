import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  ClipboardCheck,
  HeartPulse,
  MessageCircle,
  SearchCheck,
  ShieldCheck,
  Stethoscope,
} from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Curable - Health Assistant in Your Pocket" },
      {
        name: "description",
        content:
          "Curable helps people understand symptoms earlier, answer guided health questions, and prepare clearer summaries for professional care.",
      },
    ],
  }),
  component: Overview,
});

const capabilities = [
  {
    icon: MessageCircle,
    title: "Symptom guidance",
    body: "Describe what you feel in everyday language and Curable helps organize it clearly.",
  },
  {
    icon: SearchCheck,
    title: "Guided questions",
    body: "Curable asks focused follow-up questions to narrow what may be going on.",
  },
  {
    icon: ShieldCheck,
    title: "Safer next steps",
    body: "Get calm guidance on when to monitor, prepare for care, or seek medical help.",
  },
  {
    icon: ClipboardCheck,
    title: "Doctor-ready context",
    body: "Turn the conversation into a concise summary a clinician can review faster.",
  },
];

const flow = [
  [
    "01",
    "Describe symptoms",
    "Start with what you feel, even if you are unsure how to explain it.",
  ],
  ["02", "Answer focused questions", "Curable asks for the details that matter most."],
  ["03", "Review clear guidance", "See possible causes, missing details, and a care summary."],
];

function Overview() {
  return (
    <div className="bg-background">
      <section className="relative overflow-hidden border-b border-border bg-background">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_18%_8%,oklch(0.76_0.17_145_/_0.18),transparent_34%),radial-gradient(ellipse_at_88%_34%,oklch(0.78_0.19_145_/_0.14),transparent_36%)]" />
        <div className="container-page py-14 sm:py-20 lg:py-24">
          <div className="relative grid gap-10 lg:grid-cols-[1fr_440px] lg:items-center">
            <div>
              <div className="inline-flex items-center gap-2 rounded-md border border-primary/20 bg-card/80 px-3 py-1.5 text-xs font-medium text-muted-foreground shadow-elegant">
                <HeartPulse className="h-3.5 w-3.5 text-accent" />
                Health assistant in your pocket
              </div>

              <h1 className="mt-6 max-w-3xl text-balance text-4xl font-extrabold leading-[1.08] text-foreground sm:text-5xl lg:text-6xl">
                Understand symptoms earlier. Make clearer health decisions.
              </h1>

              <p className="mt-5 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg sm:leading-8">
                Curable helps people explain symptoms, answer the right follow-up questions, and
                prepare better summaries for professional care.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link
                  to="/chat"
                  className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-elegant transition-all hover:-translate-y-0.5 hover:bg-accent"
                >
                  Start Symptom Check
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <a
                  href="#what-curable-does"
                  className="inline-flex items-center justify-center rounded-md border border-primary/20 bg-card/80 px-5 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
                >
                  Learn More
                </a>
              </div>
            </div>

            <CarePreview />
          </div>
        </div>
      </section>

      <section id="what-curable-does" className="container-page py-14 sm:py-20">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <span className="text-sm font-semibold text-accent">What Curable does</span>
            <h2 className="mt-3 max-w-2xl text-3xl font-bold leading-tight text-foreground sm:text-4xl">
              Practical support before, during, and after a care decision.
            </h2>
          </div>
          <p className="max-w-md text-sm leading-6 text-muted-foreground">
            The interface stays simple while the system keeps track of symptoms, questions, possible
            causes, and context for doctors.
          </p>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {capabilities.map(({ icon: Icon, title, body }) => (
            <article
              key={title}
              className="rounded-lg border border-primary/10 bg-card p-6 shadow-elegant transition-all hover:-translate-y-0.5 hover:border-primary/30"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="mt-5 text-base font-semibold text-foreground">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="border-y border-border bg-surface">
        <div className="container-page py-14 sm:py-20">
          <div className="grid gap-10 lg:grid-cols-[360px_1fr]">
            <div>
              <span className="text-sm font-semibold text-accent">How it works</span>
              <h2 className="mt-3 text-2xl font-bold leading-tight text-foreground sm:text-3xl">
                A focused flow that avoids overwhelming the patient.
              </h2>
            </div>

            <div className="grid gap-3">
              {flow.map(([n, title, body]) => (
                <article key={title} className="rounded-lg border border-primary/10 bg-card p-5">
                  <div className="flex gap-4">
                    <div className="font-mono text-sm font-semibold text-accent">{n}</div>
                    <div>
                      <h3 className="text-base font-semibold text-foreground">{title}</h3>
                      <p className="mt-1 text-sm leading-6 text-muted-foreground">{body}</p>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="container-page py-14 sm:py-20">
        <div className="rounded-lg border border-primary/10 bg-card p-6 shadow-elegant md:p-10">
          <div className="grid gap-6 md:grid-cols-[64px_1fr] md:items-start">
            <div className="flex h-14 w-14 items-center justify-center rounded-md bg-accent/10 text-accent">
              <Stethoscope className="h-6 w-6" />
            </div>
            <div>
              <span className="text-sm font-semibold text-accent">Responsible by design</span>
              <h2 className="mt-2 max-w-3xl text-2xl font-bold leading-tight text-foreground sm:text-3xl">
                Curable supports better health decisions but does not replace professional medical
                care.
              </h2>
              <p className="mt-4 max-w-3xl text-sm leading-6 text-muted-foreground">
                Curable helps people organize symptoms and know what details matter. Doctors remain
                central to diagnosis, treatment, and clinical judgment.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="container-page pb-14 sm:pb-20">
        <div className="rounded-lg border border-primary/20 bg-surface p-6 text-center shadow-elegant md:p-12">
          <h2 className="mx-auto max-w-2xl text-2xl font-bold leading-tight text-foreground sm:text-3xl">
            Start understanding your symptoms earlier.
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
            Begin with what you feel. Curable will help you narrow the picture clearly and calmly.
          </p>
          <Link
            to="/chat"
            className="mt-7 inline-flex items-center justify-center gap-2 rounded-md bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-elegant transition-all hover:-translate-y-0.5 hover:bg-accent"
          >
            Begin Symptom Check
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </div>
  );
}

function CarePreview() {
  return (
    <div className="rounded-lg border border-primary/20 bg-card/95 p-4 shadow-deep sm:p-5">
      <div className="flex items-center justify-between border-b border-border pb-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Current check
          </p>
          <h3 className="mt-1 text-lg font-semibold text-foreground">Headache and fever</h3>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <HeartPulse className="h-5 w-5" />
        </div>
      </div>

      <div className="mt-5 space-y-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Next focused question
          </p>
          <p className="mt-2 rounded-md border border-primary/10 bg-surface p-4 text-sm leading-6 text-foreground">
            Any neck stiffness, vomiting, light sensitivity, chills, or body aches?
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-md border border-primary/10 p-4">
            <p className="text-xs text-muted-foreground">Possible cause</p>
            <p className="mt-1 text-sm font-semibold text-foreground">Viral illness</p>
          </div>
          <div className="rounded-md border border-primary/10 p-4">
            <p className="text-xs text-muted-foreground">Still checking</p>
            <p className="mt-1 text-sm font-semibold text-foreground">Malaria signs</p>
          </div>
        </div>

        <div className="rounded-md border border-accent/25 bg-accent/10 p-4">
          <p className="text-sm font-semibold text-foreground">Doctor summary</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Symptoms, timeline, possible causes, and missing details organized for review.
          </p>
        </div>
      </div>
    </div>
  );
}
