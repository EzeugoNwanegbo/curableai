import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { Session, User } from "@supabase/supabase-js";
import { ensurePatientAccount } from "@/api/auth";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

export type UserRole = "patient" | "doctor";

interface RefreshPatientInput {
  fullName?: string;
  age?: number;
  sex?: string;
  bloodGroup?: string;
  genotype?: string;
  occupation?: string;
  location?: string;
  averageWaterDaily?: string;
  exerciseFrequency?: string;
  exerciseType?: string;
  allergies?: string[];
  conditions?: string[];
}

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  role: UserRole | null;
  patientId: string | null;
  displayName: string;
  isLoading: boolean;
  authError: string | null;
  refreshPatient: (profile?: RefreshPatientInput) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);
export function getUserRole(user: User | null): UserRole {
  return user?.app_metadata?.role === "doctor" ? "doctor" : "patient";
}

export function getUserDisplayName(user: User | null) {
  return (
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    user?.email?.split("@")[0]?.replace(/[._-]+/g, " ") ||
    "Curable user"
  );
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [patientId, setPatientId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const revision = useRef(0);
  const queryClient = useQueryClient();
  const accountId = useRef<string | null>(null);
  const user = session?.user || null;
  const role = user ? getUserRole(user) : null;
  const displayName = getUserDisplayName(user);

  const ensurePatient = async (
    currentSession: Session,
    profile?: RefreshPatientInput,
    expectedRevision = revision.current,
  ) => {
    const currentRole = getUserRole(currentSession.user);

    if (currentRole !== "patient") {
      setPatientId(null);
      return;
    }

    const patient = await ensurePatientAccount({
      data: {
        accessToken: currentSession.access_token,
        fullName: profile?.fullName,
        age: profile?.age,
        sex: profile?.sex,
        bloodGroup: profile?.bloodGroup,
        genotype: profile?.genotype,
        occupation: profile?.occupation,
        location: profile?.location,
        averageWaterDaily: profile?.averageWaterDaily,
        exerciseFrequency: profile?.exerciseFrequency,
        exerciseType: profile?.exerciseType,
        allergies: profile?.allergies,
        conditions: profile?.conditions,
      },
    });

    if (expectedRevision === revision.current) setPatientId(patient.id);
  };

  useEffect(() => {
    let active = true;
    const applySession = async (nextSession: Session | null) => {
      const current = ++revision.current;
      if (accountId.current !== (nextSession?.user.id ?? null)) {
        queryClient.clear();
        accountId.current = nextSession?.user.id ?? null;
      }
      setIsLoading(true);
      setSession(null);
      setPatientId(null);
      setAuthError(null);
      try {
        if (nextSession) {
          const { data, error } = await supabase.auth.getUser(nextSession.access_token);
          if (error || !data.user)
            throw new Error("Your session has expired. Please sign in again.");
          if (!active || current !== revision.current) return;
          const verifiedSession = { ...nextSession, user: data.user };
          setSession(verifiedSession);
          if (data.user.user_metadata?.role === "doctor" && getUserRole(data.user) !== "doctor") {
            throw new Error(
              "Your doctor account is awaiting approval. Contact the Curable administrator.",
            );
          }
          await ensurePatient(verifiedSession, undefined, current);
        }
      } catch (error) {
        if (active && current === revision.current) {
          setAuthError(error instanceof Error ? error.message : "Could not prepare this account.");
        }
      } finally {
        if (active && current === revision.current) setIsLoading(false);
      }
    };
    if (!isSupabaseConfigured) {
      setAuthError("Supabase is not configured. Add the project URL and publishable key.");
      setIsLoading(false);
      return;
    }
    // Defer Supabase calls until the auth event releases its internal lock.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      queueMicrotask(() => {
        if (active) void applySession(nextSession);
      });
    });
    return () => {
      active = false;
      // This counter invalidates pending requests; it is not a DOM ref.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      revision.current++;
      subscription.unsubscribe();
    };
  }, [queryClient]);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user,
      role,
      patientId,
      displayName,
      isLoading,
      authError,
      refreshPatient: async (profile) => {
        if (!session) throw new Error("Please sign in first.");
        setAuthError(null);
        await ensurePatient(session, profile);
      },
      signOut: async () => {
        const { error } = await supabase.auth.signOut();
        if (error) {
          setAuthError(error.message);
          return;
        }
        revision.current++;
        setSession(null);
        setPatientId(null);
      },
    }),
    [authError, displayName, isLoading, patientId, role, session, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider.");
  }
  return context;
}
