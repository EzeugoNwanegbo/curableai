import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { ensurePatientAccount } from "@/api/auth";
import { supabase } from "@/lib/supabase";

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
const AUTH_CACHE_KEY = "curable:last-account";

interface CachedAccount {
  role: UserRole;
  patientId: string | null;
  displayName: string;
}

function readCachedAccount(): CachedAccount | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(AUTH_CACHE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<CachedAccount>;
    if (parsed.role !== "patient" && parsed.role !== "doctor") return null;

    return {
      role: parsed.role,
      patientId: typeof parsed.patientId === "string" ? parsed.patientId : null,
      displayName: parsed.displayName || "Curable user",
    };
  } catch {
    return null;
  }
}

function writeCachedAccount(account: CachedAccount | null) {
  if (typeof window === "undefined") return;

  if (!account) {
    window.localStorage.removeItem(AUTH_CACHE_KEY);
    return;
  }

  window.localStorage.setItem(AUTH_CACHE_KEY, JSON.stringify(account));
}

export function getUserRole(user: User | null): UserRole {
  return user?.user_metadata?.role === "doctor" ? "doctor" : "patient";
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
  const [cachedAccount, setCachedAccount] = useState<CachedAccount | null>(() =>
    readCachedAccount(),
  );
  const [session, setSession] = useState<Session | null>(null);
  const [patientId, setPatientId] = useState<string | null>(cachedAccount?.patientId ?? null);
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  const user = session?.user || null;
  const role = user ? getUserRole(user) : (cachedAccount?.role ?? null);
  const displayName = user
    ? getUserDisplayName(user)
    : (cachedAccount?.displayName ?? "Curable user");

  const ensurePatient = async (currentSession: Session, profile?: RefreshPatientInput) => {
    const currentRole = getUserRole(currentSession.user);

    if (currentRole !== "patient") {
      setPatientId(null);
      const account = {
        role: currentRole,
        patientId: null,
        displayName: getUserDisplayName(currentSession.user),
      };
      setCachedAccount(account);
      writeCachedAccount(account);
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

    setPatientId(patient.id);
    const account = {
      role: currentRole,
      patientId: patient.id,
      displayName: getUserDisplayName(currentSession.user),
    };
    setCachedAccount(account);
    writeCachedAccount(account);
  };

  const applySession = async (nextSession: Session | null) => {
    setIsLoading(true);
    setAuthError(null);
    setSession(nextSession);

    try {
      if (nextSession) {
        await ensurePatient(nextSession);
      } else {
        setPatientId(null);
        setCachedAccount(null);
        writeCachedAccount(null);
      }
    } catch (err: any) {
      setPatientId(null);
      setAuthError(err.message || "Could not prepare this account.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (active) void applySession(data.session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (active) void applySession(nextSession);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

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
        await supabase.auth.signOut();
        setSession(null);
        setPatientId(null);
        setCachedAccount(null);
        writeCachedAccount(null);
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
