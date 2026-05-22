import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  BadgeCheck,
  Brain,
  FileText,
  MessageSquareText,
  ShieldCheck,
} from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Curable - Health Reasoning Companion" },
      {
        name: "description",
        content:
          "Curable helps people explain symptoms, answer focused follow-up questions, preserve health context, and prepare safer doctor-ready reports.",
      },
    ],
  }),
  component: Overview,
});

const exampleFlow = [
  {
    icon: MessageSquareText,
    label: "Start with the symptom",
    instruction: "Describe what changed, when it started, and what worries you most.",
    example: "I have chest tightness after climbing stairs. It started yesterday evening.",
  },
  {
    icon: Brain,
    label: "Personalize the next question",
    instruction: "Curable uses your profile, medications, and memory before choosing what to ask.",
    example:
      "Because you use an inhaler and reported exertion, Curable asks about wheeze, chest spread, and breathlessness.",
  },
  {
    icon: ShieldCheck,
    label: "Know the safer next step",
    instruction: "You get a clear direction: monitor, seek care soon, or treat as urgent.",
    example: "Because exertion makes it worse, urgent medical evaluation is safer.",
  },
  {
    icon: FileText,
    label: "Prepare a doctor summary",
    instruction: "Curable turns the conversation, profile, and medications into a review-ready report.",
    example: "Summary, timeline, red flags, medications, and what Curable compared.",
  },
];

function Overview() {
  return (
    <div className="min-h-screen bg-background">
      <section className="border-b border-[#8fa99a]/15 bg-[#070b0d]">
        <div className="container-page grid min-h-[calc(100vh-3.5rem)] gap-10 py-10 lg:min-h-screen lg:grid-cols-[minmax(0,0.95fr)_minmax(420px,1.05fr)] lg:items-center lg:py-14">
          <div>
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-lg border border-[#8fa99a]/35 bg-[#d8cfb6] text-xl font-extrabold text-[#070b0d] shadow-[0_20px_60px_-35px_rgba(143,169,154,0.75)]">
              C
            </div>

            <h1 className="mt-7 max-w-3xl text-balance text-4xl font-extrabold leading-[1.05] text-[#efe7d2] sm:text-5xl lg:text-6xl">
              Understand what may be happening before the visit.
            </h1>

            <p className="mt-5 max-w-2xl text-base leading-7 text-[#d8cfb6]/70 sm:text-lg">
              Curable guides people from a vague symptom to a safer next step by using what it
              already knows about them: profile, medications, memory, and prior answers.
            </p>

            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <Link
                to="/chat"
                className="inline-flex items-center justify-center gap-2 rounded-md bg-[#8fa99a] px-5 py-3 text-sm font-semibold text-[#07100d] shadow-[0_18px_55px_-34px_rgba(143,169,154,0.85)] transition-all hover:-translate-y-0.5 hover:bg-[#a9bdaf]"
              >
                Try the guided check
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                to="/profile"
                className="inline-flex items-center justify-center gap-2 rounded-md border border-[#d8cfb6]/16 bg-[#d8cfb6]/[0.04] px-5 py-3 text-sm font-semibold text-[#efe7d2] transition-colors hover:bg-[#d8cfb6]/[0.08]"
              >
                See what Curable remembers
              </Link>
            </div>
          </div>

          <div className="rounded-lg border border-[#8fa99a]/18 bg-[#101819]/80 shadow-[0_30px_90px_-55px_rgba(143,169,154,0.42)] backdrop-blur">
            <div className="border-b border-[#8fa99a]/12 px-5 py-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#8fa99a]/72">
                    Example session
                  </div>
                  <h2 className="mt-1 text-lg font-semibold text-[#efe7d2]">
                    Personalized symptom reasoning
                  </h2>
                </div>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-[#8fa99a]/20 bg-[#8fa99a]/[0.08] px-2.5 py-1 text-[11px] font-medium text-[#c9d7cd]/80">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#8fa99a]" />
                  Context active
                </span>
              </div>
            </div>

            <div className="grid gap-0 lg:grid-cols-[1fr_220px]">
              <div className="p-5">
                <div className="space-y-4">
                  {exampleFlow.map(({ icon: Icon, label, instruction, example }, index) => (
                    <article key={label} className="rounded-lg border border-[#8fa99a]/12 bg-[#081011]/70 p-4">
                      <div className="flex items-start gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-[#8fa99a]/18 bg-[#8fa99a]/[0.08] text-[#b4c7bb]">
                          <Icon className="h-4 w-4" />
                        </div>
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#8fa99a]/72">
                              Step {index + 1}
                            </span>
                            <h3 className="text-sm font-semibold text-[#efe7d2]">{label}</h3>
                          </div>
                          <p className="mt-1 text-sm leading-6 text-[#d8cfb6]/62">
                            {instruction}
                          </p>
                          <p className="mt-3 rounded-md border border-[#b9975b]/20 bg-[#b9975b]/[0.055] px-3 py-2 text-sm leading-6 text-[#efe7d2]/88">
                            {example}
                          </p>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </div>

              <aside className="border-t border-[#8fa99a]/12 bg-[#0c1415] p-5 lg:border-l lg:border-t-0">
                <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#8fa99a]/72">
                  Output
                </div>
                <div className="mt-4 space-y-3">
                  <div className="rounded-lg border border-[#8fa99a]/12 bg-[#081011]/70 p-4">
                    <Brain className="h-5 w-5 text-[#b4c7bb]" />
                    <h3 className="mt-3 text-sm font-semibold text-[#efe7d2]">
                      Uses what it knows
                    </h3>
                    <p className="mt-2 text-xs leading-5 text-[#d8cfb6]/62">
                      Curable does not ask generic questions first. It checks saved context so the
                      next question is more relevant to the user.
                    </p>
                  </div>
                  <div className="rounded-lg border border-[#8fa99a]/12 bg-[#081011]/70 p-4">
                    <BadgeCheck className="h-5 w-5 text-[#b4c7bb]" />
                    <h3 className="mt-3 text-sm font-semibold text-[#efe7d2]">Clear risk direction</h3>
                    <p className="mt-2 text-xs leading-5 text-[#d8cfb6]/62">
                      Curable names when symptoms need urgent care instead of continuing a casual chat.
                    </p>
                  </div>
                  <div className="rounded-lg border border-[#8fa99a]/12 bg-[#081011]/70 p-4">
                    <FileText className="h-5 w-5 text-[#b4c7bb]" />
                    <h3 className="mt-3 text-sm font-semibold text-[#efe7d2]">Doctor-ready report</h3>
                    <p className="mt-2 text-xs leading-5 text-[#d8cfb6]/62">
                      Timeline, key answers, medications, memory, and the reasoning snapshot.
                    </p>
                  </div>
                </div>
              </aside>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
