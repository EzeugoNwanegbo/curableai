import { Link, Navigate, Outlet, useLocation } from "@tanstack/react-router";
import {
  Pill,
  Stethoscope,
  User,
  Bell,
  MessageSquare,
  Home,
  LogOut,
  Loader2,
  ShieldAlert,
} from "lucide-react";
import { useAuth, type UserRole } from "@/lib/auth";

const patientNav = [
  { to: "/", label: "Overview", icon: Home },
  { to: "/chat", label: "AI Follow-up", icon: MessageSquare },
  { to: "/medications", label: "Medications", icon: Pill },
  { to: "/profile", label: "Health Profile", icon: User },
  { to: "/notifications", label: "Notifications", icon: Bell },
  { to: "/consultation", label: "Consultation", icon: Stethoscope },
];

const doctorNav = [
  { to: "/", label: "Overview", icon: Home },
  { to: "/doctor", label: "Doctor Dashboard", icon: Stethoscope },
  { to: "/consultation", label: "Consultation", icon: MessageSquare },
];

const patientOnlyPaths = new Set(["/chat", "/medications", "/profile", "/notifications"]);
const doctorOnlyPaths = new Set(["/doctor"]);
const publicPaths = new Set(["/", "/auth"]);

function roleLabel(role: UserRole | null) {
  return role === "doctor" ? "Doctor" : "Patient";
}

export function AppShell() {
  const location = useLocation();
  const auth = useAuth();
  const isAuthPage = location.pathname === "/auth";
  const needsAuth = !publicPaths.has(location.pathname);

  if (isAuthPage) {
    return <Outlet />;
  }

  if (!auth.session && location.pathname === "/") {
    return (
      <div className="min-h-screen bg-background">
        <div className="fixed right-5 top-5 z-20">
          <Link
            to="/auth"
            className="rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-elegant transition-all hover:-translate-y-0.5 hover:bg-primary/90"
          >
            Sign in
          </Link>
        </div>
        <Outlet />
      </div>
    );
  }

  if (auth.isLoading && needsAuth) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="font-serif text-lg text-muted-foreground">
            Preparing your Curable account...
          </p>
        </div>
      </div>
    );
  }

  if (needsAuth && !auth.session) {
    return <Navigate to="/auth" replace />;
  }

  if (auth.authError && needsAuth) {
    return (
      <AccessMessage
        title="Account setup needs attention"
        body={auth.authError}
        action="Back to sign in"
      />
    );
  }

  if (auth.role === "doctor" && patientOnlyPaths.has(location.pathname)) {
    return (
      <AccessMessage
        title="Patient area"
        body="This page is for patient accounts. Doctors can use the dashboard and consultation room."
        action="Go to doctor dashboard"
        to="/doctor"
      />
    );
  }

  if (auth.role === "patient" && doctorOnlyPaths.has(location.pathname)) {
    return (
      <AccessMessage
        title="Doctor area"
        body="This dashboard is for doctor accounts. Patient accounts can use AI follow-up, medications, profile, notifications, and consultations."
        action="Go to AI follow-up"
        to="/chat"
      />
    );
  }

  const nav = auth.role === "doctor" ? doctorNav : patientNav;
  const mobileNav = nav.slice(0, 5);

  return (
    <div className="min-h-screen bg-background pb-20 lg:pb-0">
      <aside className="fixed left-0 top-0 hidden h-screen w-72 flex-col border-r border-border bg-card/90 px-5 py-7 shadow-elegant backdrop-blur lg:flex">
        <Link to="/" className="mb-10 flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-lg font-extrabold text-primary-foreground shadow-elegant">
            C
          </div>
          <div>
            <div className="text-lg font-extrabold leading-none">Curable</div>
            <div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Health companion
            </div>
          </div>
        </Link>

        <nav className="flex flex-1 flex-col gap-1">
          {nav.map(({ to, label, icon: Icon }) => {
            const active = location.pathname === to;
            return (
              <Link
                key={to}
                to={to}
                className={`group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
                  active
                    ? "bg-primary text-primary-foreground shadow-elegant"
                    : "text-foreground/70 hover:bg-muted hover:text-foreground"
                }`}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-6 rounded-lg border border-accent/20 bg-accent/10 p-4">
          <div className="text-sm font-semibold leading-snug text-foreground">
            Curable asks the next useful question and keeps the picture clear.
          </div>
        </div>

        {auth.session ? (
          <div className="mt-4 rounded-lg border border-border bg-background/70 p-4">
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              {roleLabel(auth.role)} account
            </div>
            <div className="mt-1 truncate text-sm font-medium text-foreground">
              {auth.displayName}
            </div>
            <button
              type="button"
              onClick={() => void auth.signOut()}
              className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-full border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground transition-colors hover:bg-muted"
            >
              <LogOut className="h-3.5 w-3.5" /> Sign out
            </button>
          </div>
        ) : null}
      </aside>

      <main className="lg:pl-72">
        <Outlet />
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 px-2 py-2 shadow-deep backdrop-blur lg:hidden">
        <div className="mx-auto grid max-w-md grid-cols-5 gap-1">
          {mobileNav.map(({ to, label, icon: Icon }) => {
            const active = location.pathname === to;
            return (
              <Link
                key={to}
                to={to}
                className={`flex min-h-12 flex-col items-center justify-center gap-1 rounded-lg px-1 text-[10px] font-semibold transition-colors ${
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <Icon className="h-4 w-4" />
                <span className="max-w-full truncate">{label.replace("AI Follow-up", "Chat")}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

function AccessMessage({
  title,
  body,
  action,
  to = "/auth",
}: {
  title: string;
  body: string;
  action: string;
  to?: "/" | "/auth" | "/chat" | "/doctor";
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md rounded-lg border border-border bg-card p-8 text-center shadow-elegant">
        <ShieldAlert className="mx-auto h-10 w-10 text-primary" />
        <h1 className="mt-4 font-serif text-2xl text-foreground">{title}</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p>
        <Link
          to={to}
          className="mt-6 inline-flex items-center justify-center rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
        >
          {action}
        </Link>
      </div>
    </div>
  );
}
