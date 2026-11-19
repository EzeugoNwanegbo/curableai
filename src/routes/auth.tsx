import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, LogIn } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { addPatientMedication, getAuthenticatedPatientMedications } from "@/api/medications";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/auth")({
  validateSearch: (search: Record<string, unknown>): { redirect?: string; mode?: "signup" } => ({
    mode: search.mode === "signup" ? "signup" : undefined,
    redirect:
      typeof search.redirect === "string" &&
      /^\/(?![\\/])/.test(search.redirect) &&
      search.redirect.split(/[?#]/)[0] !== "/auth"
        ? search.redirect
        : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Sign in · Curable" },
      { name: "description", content: "Sign in to Curable as a patient or doctor." },
    ],
  }),
  component: AuthPage,
});

function readListField(value: string) {
  return value
    .split(/[,\n]/)
    .map((item) => item.trim())
    .filter((item) => item && !/^(none|no|n\/a|na)$/i.test(item));
}

const habitQuestions = [
  [
    "exerciseFrequency",
    "On a typical week, how many days do you move fast enough to breathe harder, like a brisk walk or dancing?",
    ["0 days", "1–2 days", "3–4 days", "5–7 days"],
  ],
  [
    "averageWaterDaily",
    "How much plain water do you usually drink in a day?",
    ["Less than 1 litre", "1 to under 2 litres", "2 to under 3 litres", "3 litres or more"],
  ],
  [
    "mealFrequency",
    "How many meals do you usually eat in a day?",
    ["0–1 meals", "2 meals", "3 meals", "4 or more meals", "It varies"],
  ],
  [
    "produceFrequency",
    "How often do you usually eat fruit or vegetables?",
    ["Less than weekly", "A few days a week", "Once a day", "More than once a day"],
  ],
  [
    "friedFoodFrequency",
    "How often do you usually eat fried foods?",
    ["Less than weekly", "1–2 days a week", "3–4 days a week", "5–7 days a week"],
  ],
] as const;

function DailyHabits() {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const question = habitQuestions[step];
  const answered = habitQuestions.filter(
    ([name]) => answers[name] && answers[name] !== "Not sure",
  ).length;
  function advance(value: string) {
    if (!question) return;
    const [name] = question;
    setAnswers((previous) => ({ ...previous, [name]: value }));
    setStep(step + 1);
  }
  return (
    <section className="space-y-3 rounded-lg border border-border p-4">
      {habitQuestions.map(([name]) => (
        <input key={name} type="hidden" name={name} value={answers[name] ?? ""} />
      ))}
      <h2 className="font-medium">Daily habits</h2>
      <p className="text-sm text-muted-foreground">
        {answered} answered · {habitQuestions.length - step} left
      </p>
      <progress
        className="w-full accent-primary"
        value={step}
        max={habitQuestions.length}
        aria-label="Daily habits progress"
      />
      {question && (
        <fieldset className="space-y-3">
          <legend className="mb-2 text-sm">{question[1]}</legend>
          <div className="flex flex-wrap gap-2">
            {[...question[2], "Not sure", "Skip"].map((option) => (
              <button
                key={option}
                type="button"
                className="min-h-11 rounded-lg border border-input px-3 text-sm"
                onClick={() => advance(option === "Skip" ? "" : option)}
              >
                {option}
              </button>
            ))}
          </div>
        </fieldset>
      )}
      {step > 0 && (
        <button
          type="button"
          className="min-h-11 text-sm underline"
          onClick={() => setStep(step - 1)}
        >
          Previous question
        </button>
      )}
    </section>
  );
}

function HealthSetup({ onComplete }: { onComplete: () => void }) {
  const auth = useAuth();
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const pages = ["About you", "Health history", "Medicines and herbs", "Daily habits"];
  const fieldClass = "mt-1 w-full rounded-lg border border-input bg-background p-3";
  async function finish(form: HTMLFormElement) {
    if (!auth.patientId || busy) return;
    setBusy(true);
    setError("");
    const values = new FormData(form);
    const read = (key: string) => String(values.get(key) ?? "").trim();
    try {
      await auth.refreshPatient({
        age: read("age") ? Number(read("age")) : undefined,
        sex: read("sex"),
        conditions: readListField(read("conditions")),
        allergies: readListField(read("allergies")),
        exerciseFrequency: read("exerciseFrequency"),
        averageWaterDaily: read("averageWaterDaily"),
        mealFrequency: read("mealFrequency"),
        produceFrequency: read("produceFrequency"),
        friedFoodFrequency: read("friedFoodFrequency"),
      });
      const patientId = auth.patientId;
      const names = new Map(
        readListField(read("medications")).map((name) => [name.toLowerCase(), name]),
      );
      if (names.size) {
        const existing = await getAuthenticatedPatientMedications({ data: { patientId } });
        for (const item of existing) names.delete(item.name.toLowerCase());
        for (const name of names.values())
          await addPatientMedication({ data: { patientId, name } });
      }
      const { error: updateError } = await supabase.auth.updateUser({
        data: { health_setup_pending: false },
      });
      if (updateError) throw updateError;
      onComplete();
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : "Could not save your setup. Try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="mx-auto max-w-lg px-5 py-10">
      <h1 className="text-2xl font-medium">Help Curable get to know you</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Share what you know. You can leave any answer blank.
      </p>
      <p className="mt-5 text-sm">
        Step {step + 1} of {pages.length} · {pages[step]}
      </p>
      <progress
        className="w-full accent-primary"
        aria-label="Health setup progress"
        value={step + 1}
        max={pages.length}
      />
      <form
        className="mt-5 space-y-5"
        onSubmit={(event) => {
          event.preventDefault();
          if (step < pages.length - 1) setStep(step + 1);
          else void finish(event.currentTarget);
        }}
      >
        <div hidden={step !== 0} className="space-y-4">
          <label className="block">
            Age
            <input className={fieldClass} name="age" type="number" min="1" max="120" />
          </label>
          <label className="block">
            Sex
            <select className={fieldClass} name="sex" defaultValue="">
              <option value="">Skip</option>
              <option>Female</option>
              <option>Male</option>
              <option>Other</option>
            </select>
          </label>
        </div>
        <div hidden={step !== 1} className="space-y-4">
          <label className="block">
            Known conditions
            <input
              className={fieldClass}
              name="conditions"
              maxLength={400}
              placeholder="For example, asthma"
            />
          </label>
          <label className="block">
            Allergies
            <input
              className={fieldClass}
              name="allergies"
              maxLength={400}
              placeholder="For example, penicillin"
            />
          </label>
        </div>
        <div hidden={step !== 2}>
          <label className="block">
            What medicines or herbal remedies do you take regularly?
            <input
              className={fieldClass}
              name="medications"
              maxLength={400}
              placeholder="Names separated by commas"
            />
          </label>
        </div>
        <div hidden={step !== 3}>
          <DailyHabits />
        </div>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <div className="flex gap-3">
          {step > 0 && (
            <button
              type="button"
              disabled={busy}
              className="min-h-11 px-3"
              onClick={() => setStep(step - 1)}
            >
              Back
            </button>
          )}
          <button
            type="submit"
            disabled={busy || !auth.patientId}
            className="min-h-11 rounded-lg bg-primary px-4 text-primary-foreground disabled:opacity-50"
          >
            {busy ? "Saving…" : step === pages.length - 1 ? "Finish setup" : "Continue"}
          </button>
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={() => void auth.signOut()}
          className="text-sm underline"
        >
          Sign out
        </button>
      </form>
    </main>
  );
}

function AuthPage() {
  const navigate = useNavigate();
  const [clientReady, setClientReady] = useState(false);
  useEffect(() => setClientReady(true), []);
  const auth = useAuth();
  const { redirect, mode: initialMode } = Route.useSearch();
  const needsSetup =
    auth.role === "patient" && auth.user?.user_metadata?.health_setup_pending === true;
  const [setupDone, setSetupDone] = useState(false);
  const [mode, setMode] = useState<"signin" | "signup">(initialMode || "signin");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!auth.session || auth.isLoading || auth.authError || (needsSetup && !setupDone)) return;
    void navigate({
      to: redirect || (auth.role === "doctor" ? "/doctor" : "/chat"),
      replace: true,
    });
  }, [
    auth.isLoading,
    auth.role,
    auth.session,
    auth.authError,
    navigate,
    redirect,
    needsSetup,
    setupDone,
  ]);

  const handleGoogleAuth = async () => {
    setIsSubmitting(true);
    setError(null);
    setNotice(null);

    try {
      const redirectTo =
        typeof window !== "undefined"
          ? `${window.location.origin}/auth${redirect ? `?redirect=${encodeURIComponent(redirect)}` : ""}`
          : undefined;
      const { error: googleError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo,
          queryParams: {
            access_type: "offline",
            prompt: "consent",
          },
        },
      });

      if (googleError) throw googleError;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not continue with Google.");
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const fields = form.elements;
    const readField = (name: string) => {
      const field = fields.namedItem(name) as HTMLInputElement | HTMLSelectElement | null;
      return field?.value?.trim() || "";
    };

    const email = readField("email");
    const password = (fields.namedItem("password") as HTMLInputElement)?.value || "";
    const fullName = readField("fullName");
    setIsSubmitting(true);
    setError(null);
    setNotice(null);

    try {
      if (!email.includes("@") || !email.includes(".")) {
        throw new Error("Enter a valid email address.");
      }

      if (password.length < 6) {
        throw new Error("Password must be at least 6 characters.");
      }

      if (mode === "signup" && !fullName) {
        throw new Error("Full name is required.");
      }

      if (mode === "signup") {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth${redirect ? `?redirect=${encodeURIComponent(redirect)}` : ""}`,
            data: {
              role: "patient",
              full_name: fullName,
              health_setup_pending: true,
            },
          },
        });

        if (signUpError) throw signUpError;

        setNotice(
          data.session
            ? "Account created. Opening your workspace..."
            : "Account created. Check your email to confirm your login.",
        );
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (signInError) throw signInError;

        setNotice("Signed in. Opening your workspace...");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not complete sign in.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (auth.session && needsSetup && !setupDone) {
    return <HealthSetup onComplete={() => setSetupDone(true)} />;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto grid min-h-screen max-w-lg items-center">
        <main className="flex items-center justify-center px-6 py-10">
          <form
            noValidate
            onSubmit={handleSubmit}
            className="w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-elegant"
          >
            <div className="flex rounded-md border border-border bg-muted p-1">
              <button
                type="button"
                onClick={() => setMode("signin")}
                className={`flex-1 rounded px-3 py-2 text-sm font-medium ${
                  mode === "signin" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
                }`}
              >
                Sign in
              </button>
              <button
                type="button"
                onClick={() => setMode("signup")}
                className={`flex-1 rounded px-3 py-2 text-sm font-medium ${
                  mode === "signup" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
                }`}
              >
                Create account
              </button>
            </div>

            <button
              type="button"
              onClick={() => void handleGoogleAuth()}
              disabled={isSubmitting || !clientReady}
              className="mt-5 inline-flex w-full items-center justify-center gap-3 rounded-md border border-border bg-background px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-60"
            >
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-card text-xs font-bold text-foreground">
                G
              </span>
              Continue with Google
            </button>

            <div className="mt-5 flex items-center gap-3">
              <span className="h-px flex-1 bg-border" />
              <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Or use email
              </span>
              <span className="h-px flex-1 bg-border" />
            </div>

            <div className="mt-5 grid gap-4">
              {mode === "signup" ? (
                <label className="text-sm">
                  <span className="text-xs font-medium text-muted-foreground">Full name</span>
                  <input
                    name="fullName"
                    required
                    placeholder="Your full name"
                    className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring"
                  />
                </label>
              ) : null}

              <label className="text-sm">
                <span className="text-xs font-medium text-muted-foreground">Email</span>
                <input
                  name="email"
                  type="email"
                  required
                  placeholder="you@example.com"
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring"
                />
              </label>

              <label className="text-sm">
                <span className="text-xs font-medium text-muted-foreground">Password</span>
                <input
                  name="password"
                  type="password"
                  required
                  minLength={6}
                  placeholder="At least 6 characters"
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring"
                />
              </label>
            </div>

            {error || auth.authError ? (
              <div className="mt-5 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                {error || auth.authError}
              </div>
            ) : null}

            {auth.session && auth.authError ? (
              <button
                type="button"
                onClick={() => void auth.signOut()}
                className="mt-3 text-sm underline"
              >
                Sign out
              </button>
            ) : null}

            {notice ? (
              <div className="mt-5 rounded-md border border-success/30 bg-success/10 p-3 text-sm text-success">
                {notice}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={isSubmitting || !clientReady}
              className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-accent disabled:opacity-60"
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <LogIn className="h-4 w-4" />
              )}
              {mode === "signin" ? "Sign in" : "Create account"}
            </button>
          </form>
        </main>
      </div>
    </div>
  );
}
