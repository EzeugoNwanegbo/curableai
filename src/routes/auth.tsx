import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, LogIn, Stethoscope, UserRound } from "lucide-react";
import { ensurePatientAccount } from "@/api/auth";
import { getUserRole, useAuth, type UserRole } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/auth")({
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

function AuthPage() {
  const navigate = useNavigate();
  const auth = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [role, setRole] = useState<UserRole>("patient");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!auth.session || auth.isLoading) return;
    void navigate({ to: auth.role === "doctor" ? "/doctor" : "/chat" });
  }, [auth.isLoading, auth.role, auth.session, navigate]);

  const handleGoogleAuth = async () => {
    setIsSubmitting(true);
    setError(null);
    setNotice(null);

    try {
      const redirectTo =
        typeof window !== "undefined" ? `${window.location.origin}/auth` : undefined;
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
    } catch (err: any) {
      setError(err.message || "Could not continue with Google.");
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
    const password = readField("password");
    const fullName = readField("fullName");
    const age = Number(readField("age") || 0);
    const sex = readField("sex");
    const bloodGroup = readField("bloodGroup");
    const genotype = readField("genotype");
    const occupation = readField("occupation");
    const location = readField("location");
    const averageWaterDaily = readField("averageWaterDaily");
    const exerciseFrequency = readField("exerciseFrequency");
    const exerciseType = readField("exerciseType");
    const allergies = readListField(readField("allergies"));
    const conditions = readListField(readField("conditions"));

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

      if (mode === "signup" && role === "patient") {
        if (!age || age < 1) throw new Error("Add your age.");
        if (!sex) throw new Error("Select your sex.");
        if (!location) throw new Error("Add your location.");
        if (!occupation) throw new Error("Add your occupation.");
        if (!bloodGroup) throw new Error("Select your blood group.");
        if (!genotype) throw new Error("Select your genotype.");
        if (!averageWaterDaily) throw new Error("Select your average daily water intake.");
        if (!exerciseFrequency) throw new Error("Select how often you exercise.");
      }

      if (mode === "signup") {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              role,
              full_name: fullName,
              age,
              sex,
              blood_group: bloodGroup,
              genotype,
              occupation,
              location,
              average_water_daily: averageWaterDaily,
              exercise_frequency: exerciseFrequency,
              exercise_type: exerciseType,
              allergies,
              conditions,
            },
          },
        });

        if (signUpError) throw signUpError;

        if (data.session && role === "patient") {
          await ensurePatientAccount({
            data: {
              accessToken: data.session.access_token,
              fullName,
              age,
              sex,
              bloodGroup,
              genotype,
              occupation,
              location,
              averageWaterDaily,
              exerciseFrequency,
              exerciseType,
              allergies,
              conditions,
            },
          });
        }

        setNotice(
          data.session
            ? "Account created. Opening your workspace..."
            : "Account created. Check your email to confirm your login.",
        );

        if (data.session) {
          void navigate({ to: role === "doctor" ? "/doctor" : "/chat" });
        }
      } else {
        const { data, error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (signInError) throw signInError;

        const signedInRole = getUserRole(data.user);
        setNotice("Signed in. Opening your workspace...");
        void navigate({ to: signedInRole === "doctor" ? "/doctor" : "/chat" });
      }
    } catch (err: any) {
      setError(err.message || "Could not complete sign in.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto grid min-h-screen max-w-6xl lg:grid-cols-[0.9fr_1.1fr]">
        <section className="flex flex-col justify-between border-r border-border bg-surface px-8 py-8">
          <div>
            <div className="flex items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary text-lg font-extrabold text-primary-foreground">
                C
              </div>
              <div>
                <div className="font-serif text-xl text-foreground">Curable</div>
                <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                  Continuity of Care
                </div>
              </div>
            </div>

            <div className="mt-20">
              <div className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
                Real accounts
              </div>
              <h1 className="mt-3 font-serif text-4xl leading-tight text-foreground">
                Patient memory and doctor review under one identity.
              </h1>
              <p className="mt-4 max-w-md text-sm leading-relaxed text-muted-foreground">
                Patients get continuous AI context. Doctors get a structured review queue and
                consultation workspace.
              </p>
            </div>
          </div>

          <div className="mt-10 grid gap-3 text-sm">
            <div className="rounded-md border border-border bg-card p-4">
              <UserRound className="h-4 w-4 text-primary" />
              <div className="mt-2 font-medium text-foreground">Patient account</div>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Chat, profile, medications, memory, reports, and consultation access.
              </p>
            </div>
            <div className="rounded-md border border-border bg-card p-4">
              <Stethoscope className="h-4 w-4 text-primary" />
              <div className="mt-2 font-medium text-foreground">Doctor account</div>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Review AI reports, validate guidance, and start doctor-patient chats.
              </p>
            </div>
          </div>
        </section>

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

            <div className="mt-6">
              <h2 className="font-serif text-2xl text-foreground">
                {mode === "signin" ? "Welcome back" : "Create your workspace"}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {mode === "signin"
                  ? "Use your Curable account details."
                  : "Choose whether this account is for a patient or doctor."}
              </p>
            </div>

            <button
              type="button"
              onClick={() => void handleGoogleAuth()}
              disabled={isSubmitting}
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

            {mode === "signup" ? (
              <div className="mt-5 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setRole("patient")}
                  className={`rounded-md border px-3 py-3 text-left text-sm ${
                    role === "patient"
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-border text-foreground"
                  }`}
                >
                  <UserRound className="h-4 w-4" />
                  <span className="mt-2 block font-medium">Patient</span>
                </button>
                <button
                  type="button"
                  onClick={() => setRole("doctor")}
                  className={`rounded-md border px-3 py-3 text-left text-sm ${
                    role === "doctor"
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-border text-foreground"
                  }`}
                >
                  <Stethoscope className="h-4 w-4" />
                  <span className="mt-2 block font-medium">Doctor</span>
                </button>
              </div>
            ) : null}

            <div className="mt-5 grid gap-4">
              {mode === "signup" ? (
                <label className="text-sm">
                  <span className="text-xs font-medium text-muted-foreground">Full name</span>
                  <input
                    name="fullName"
                    required
                    placeholder={role === "doctor" ? "Doctor name" : "Your full name"}
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

              {mode === "signup" && role === "patient" ? (
                <div className="rounded-md border border-border bg-surface p-4">
                  <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                    Quick health card
                  </div>
                  <div className="mt-3 grid gap-4 sm:grid-cols-2">
                    <label className="text-sm">
                      <span className="text-xs font-medium text-muted-foreground">Age</span>
                      <input
                        name="age"
                        type="number"
                        min="1"
                        placeholder="24"
                        className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring"
                      />
                    </label>
                    <label className="text-sm">
                      <span className="text-xs font-medium text-muted-foreground">Sex</span>
                      <select
                        name="sex"
                        defaultValue=""
                        className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring"
                      >
                        <option value="">Select</option>
                        <option value="Female">Female</option>
                        <option value="Male">Male</option>
                        <option value="Other">Other</option>
                      </select>
                    </label>
                    <label className="text-sm sm:col-span-2">
                      <span className="text-xs font-medium text-muted-foreground">Location</span>
                      <input
                        name="location"
                        placeholder="City, state, or country"
                        className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring"
                      />
                    </label>
                    <label className="text-sm sm:col-span-2">
                      <span className="text-xs font-medium text-muted-foreground">Occupation</span>
                      <input
                        name="occupation"
                        placeholder="Your occupation"
                        className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring"
                      />
                    </label>
                    <label className="text-sm">
                      <span className="text-xs font-medium text-muted-foreground">Blood group</span>
                      <select
                        name="bloodGroup"
                        defaultValue=""
                        className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring"
                      >
                        <option value="">Select</option>
                        {["O+", "O-", "A+", "A-", "B+", "B-", "AB+", "AB-", "Unknown"].map(
                          (group) => (
                            <option key={group} value={group}>
                              {group === "Unknown" ? "I don't know yet" : group}
                            </option>
                          ),
                        )}
                      </select>
                    </label>
                    <label className="text-sm">
                      <span className="text-xs font-medium text-muted-foreground">Genotype</span>
                      <select
                        name="genotype"
                        defaultValue=""
                        className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring"
                      >
                        <option value="">Select</option>
                        {["AA", "AS", "SS", "AC", "SC", "Unknown"].map((type) => (
                          <option key={type} value={type}>
                            {type === "Unknown" ? "I don't know yet" : type}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="text-sm">
                      <span className="text-xs font-medium text-muted-foreground">
                        Water per day
                      </span>
                      <select
                        name="averageWaterDaily"
                        defaultValue=""
                        className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring"
                      >
                        <option value="">Select</option>
                        <option value="Less than 1 liter">Less than 1 liter</option>
                        <option value="1-2 liters">1-2 liters</option>
                        <option value="2-3 liters">2-3 liters</option>
                        <option value="More than 3 liters">More than 3 liters</option>
                        <option value="Not sure">Not sure</option>
                      </select>
                    </label>
                    <label className="text-sm">
                      <span className="text-xs font-medium text-muted-foreground">
                        Exercise per week
                      </span>
                      <select
                        name="exerciseFrequency"
                        defaultValue=""
                        className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring"
                      >
                        <option value="">Select</option>
                        <option value="0 times per week">0 times</option>
                        <option value="1-2 times per week">1-2 times</option>
                        <option value="3-4 times per week">3-4 times</option>
                        <option value="5 or more times per week">5+ times</option>
                      </select>
                    </label>
                    <label className="text-sm sm:col-span-2">
                      <span className="text-xs font-medium text-muted-foreground">
                        Exercise type
                      </span>
                      <input
                        name="exerciseType"
                        placeholder="Walking, gym, football, none, etc."
                        className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring"
                      />
                    </label>
                    <label className="text-sm sm:col-span-2">
                      <span className="text-xs font-medium text-muted-foreground">
                        Allergies
                      </span>
                      <input
                        name="allergies"
                        placeholder="Penicillin, peanuts, dust, or none"
                        className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring"
                      />
                    </label>
                    <label className="text-sm sm:col-span-2">
                      <span className="text-xs font-medium text-muted-foreground">
                        Known conditions
                      </span>
                      <input
                        name="conditions"
                        placeholder="Asthma, hypertension, diabetes, or none"
                        className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring"
                      />
                    </label>
                  </div>
                  <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                    Medications can be skipped now and added later from the medication area.
                  </p>
                </div>
              ) : null}
            </div>

            {error ? (
              <div className="mt-5 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                {error}
              </div>
            ) : null}

            {notice ? (
              <div className="mt-5 rounded-md border border-success/30 bg-success/10 p-3 text-sm text-success">
                {notice}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={isSubmitting}
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
