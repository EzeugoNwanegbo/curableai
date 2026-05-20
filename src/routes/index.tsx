import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, HeartPulse, SearchCheck, ShieldCheck, Stethoscope } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Curable - AI Symptom Guidance" },
      {
        name: "description",
        content:
          "Curable helps people understand possible causes of symptoms, answer guided questions, and prepare for better care decisions.",
      },
    ],
  }),
  component: Overview,
});

const points = [
  {
    icon: SearchCheck,
    title: "Possible causes",
    body: "Curable helps narrow what may be going on by asking focused health questions.",
  },
  {
    icon: ShieldCheck,
    title: "Safer decisions",
    body: "Curable helps you know when to monitor symptoms and when proper medical care matters.",
  },
  {
    icon: Stethoscope,
    title: "No prescriptions",
    body: "Curable does not prescribe drugs or replace doctors. It helps you prepare better for care.",
  },
];

function Overview() {
  return (
    <div className="min-h-screen bg-background">
      <section className="relative overflow-hidden border-b border-border bg-background">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_18%_8%,oklch(0.76_0.17_145_/_0.18),transparent_34%),radial-gradient(ellipse_at_88%_34%,oklch(0.78_0.19_145_/_0.14),transparent_36%)]" />
        <div className="container-page relative flex min-h-screen items-center py-16">
          <div className="max-w-4xl">
            <div className="inline-flex items-center gap-2 rounded-md border border-primary/20 bg-card/80 px-3 py-1.5 text-xs font-medium text-muted-foreground shadow-elegant">
              <HeartPulse className="h-3.5 w-3.5 text-accent" />
              AI symptom guidance
            </div>

            <h1 className="mt-6 text-balance text-4xl font-extrabold leading-[1.08] text-foreground sm:text-6xl lg:text-7xl">
              The world’s most focused AI for understanding symptoms.
            </h1>

            <p className="mt-6 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg sm:leading-8">
              Curable helps users explore possible causes, answer the right follow-up questions, and
              decide what to do next with more clarity.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                to="/chat"
                className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-elegant transition-all hover:-translate-y-0.5 hover:bg-accent"
              >
                Start Symptom Check
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                to="/auth"
                className="inline-flex items-center justify-center rounded-md border border-primary/20 bg-card/80 px-5 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
              >
                Sign in
              </Link>
            </div>

            <div className="mt-10 grid gap-3 md:grid-cols-3">
              {points.map(({ icon: Icon, title, body }) => (
                <article
                  key={title}
                  className="rounded-lg border border-primary/10 bg-card p-5 shadow-elegant"
                >
                  <Icon className="h-5 w-5 text-primary" />
                  <h2 className="mt-4 text-base font-semibold text-foreground">{title}</h2>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{body}</p>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
