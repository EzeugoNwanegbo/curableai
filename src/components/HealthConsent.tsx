import { useState, type ReactNode } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { hasHealthConsent, healthConsentVersion } from "@/lib/health-consent";

export function HealthConsent({ children }: { children?: ReactNode }) {
  const { user, signOut } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const active = hasHealthConsent(user?.user_metadata);
  if (children && active) return <>{children}</>;

  async function changeConsent(allow: boolean) {
    setBusy(true);
    setError("");
    try {
      const { error } = await supabase.auth.updateUser({
        data: {
          health_ai_consent: allow ? healthConsentVersion : null,
          health_ai_consent_changed_at: new Date().toISOString(),
        },
      });
      if (error) throw error;
    } catch {
      setError("Your choice could not be saved. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mx-auto max-w-lg space-y-4 px-5 py-8">
      <h2 className="text-xl font-medium">Your health information</h2>
      <p>
        Curable saves your health answers, medicines and chats to personalize future replies. The
        app processes data in the US and stores records in Ireland.
      </p>
      <p>
        For AI replies and draft doctor notes, we send filtered health details to OpenAI. DeepSeek
        may process them if enabled as a backup. We remove known identifiers, but details you type
        could still identify you.
      </p>
      <p>
        You choose whether to send a note to a doctor. You can turn off future AI processing in
        Privacy. Turning it off leaves earlier records in your account.
      </p>
      <button
        type="button"
        disabled={busy}
        className="min-h-11 rounded-lg bg-primary px-4 text-primary-foreground"
        onClick={() => void changeConsent(!active)}
      >
        {busy
          ? "Saving…"
          : active
            ? "Withdraw AI consent"
            : "Agree to health data and AI processing"}
      </button>
      {!active && children && (
        <button type="button" className="block min-h-11" onClick={() => void signOut()}>
          Decline and sign out
        </button>
      )}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
