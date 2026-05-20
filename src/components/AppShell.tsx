import { Link, Navigate, Outlet, useLocation } from "@tanstack/react-router";
import { useState } from "react";
import {
  Pill,
  Stethoscope,
  User,
  MessageSquare,
  Home,
  LogOut,
  ShieldAlert,
  PanelLeftClose,
  PanelLeftOpen,
  UserPlus,
} from "lucide-react";
import { useAuth, type UserRole } from "@/lib/auth";

const patientNav = [
  { to: "/", label: "Overview", icon: Home },
  { to: "/chat", label: "Chat", icon: MessageSquare },
  { to: "/medications", label: "Medications", icon: Pill },
  { to: "/profile", label: "Health Profile", icon: User },
  { to: "/consultation", label: "Add Doctor", icon: UserPlus },
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
  const [isMenuOpen, setIsMenuOpen] = useState(false);
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

  if (auth.isLoading && needsAuth && !auth.role) {
    return <div className="min-h-screen bg-background" aria-hidden="true" />;
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
        body="This dashboard is for doctor accounts. Patient accounts can use chat, medications, health profile, and doctor setup."
        action="Go to chat"
        to="/chat"
      />
    );
  }

  const nav = auth.role === "doctor" ? doctorNav : patientNav;
  const mobileNav = nav.slice(0, 5);

  return (
    <div className="min-h-screen bg-background pb-20 lg:pb-0">
      <aside
        className={`fixed left-0 top-0 hidden h-screen flex-col border-r border-border bg-card/90 py-7 shadow-elegant backdrop-blur transition-[width] duration-200 lg:flex ${
          isMenuOpen ? "w-72 px-5" : "w-[72px] px-3"
        }`}
      >
        <div
          className={`mb-10 flex items-center ${
            isMenuOpen ? "justify-between gap-3" : "flex-col gap-3"
          }`}
        >
          <Link
            to="/"
            className={`flex items-center gap-2 ${isMenuOpen ? "" : "justify-center"}`}
            aria-label="Curable home"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary text-lg font-extrabold text-primary-foreground shadow-elegant">
              C
            </div>
            {isMenuOpen ? (
              <div>
                <div className="text-lg font-extrabold leading-none">Curable</div>
                <div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Health companion
                </div>
              </div>
            ) : null}
          </Link>
          <button
            type="button"
            onClick={() => setIsMenuOpen((value) => !value)}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label={isMenuOpen ? "Collapse side menu" : "Expand side menu"}
          >
            {isMenuOpen ? (
              <PanelLeftClose className="h-4 w-4" />
            ) : (
              <PanelLeftOpen className="h-4 w-4" />
            )}
          </button>
        </div>

        <nav className="flex flex-1 flex-col gap-1">
          {nav.map(({ to, label, icon: Icon }) => {
            const active = location.pathname === to;
            return (
              <Link
                key={to}
                to={to}
                title={isMenuOpen ? undefined : label}
                className={`group flex items-center rounded-lg text-sm font-medium transition-all ${
                  active
                    ? "bg-primary text-primary-foreground shadow-elegant"
                    : "text-foreground/70 hover:bg-muted hover:text-foreground"
                } ${isMenuOpen ? "gap-3 px-3 py-2.5" : "h-11 justify-center px-0"}`}
              >
                <Icon className="h-4 w-4" />
                {isMenuOpen ? label : null}
              </Link>
            );
          })}
        </nav>

        {isMenuOpen ? (
          <div className="mt-6 rounded-lg border border-accent/20 bg-accent/10 p-4">
            <div className="text-sm font-semibold leading-snug text-foreground">
              Curable asks the next useful question and keeps the picture clear.
            </div>
          </div>
        ) : null}

        {auth.session ? (
          <div
            className={`mt-4 rounded-lg border border-border bg-background/70 ${
              isMenuOpen ? "p-4" : "p-2"
            }`}
          >
            {isMenuOpen ? (
              <>
                <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  {roleLabel(auth.role)} account
                </div>
                <div className="mt-1 truncate text-sm font-medium text-foreground">
                  {auth.displayName}
                </div>
              </>
            ) : null}
            <button
              type="button"
              onClick={() => void auth.signOut()}
              className={`inline-flex w-full items-center justify-center gap-2 rounded-full border border-border bg-card text-xs font-semibold text-foreground transition-colors hover:bg-muted ${
                isMenuOpen ? "mt-3 px-3 py-2" : "h-10 px-0"
              }`}
              aria-label="Sign out"
            >
              <LogOut className="h-3.5 w-3.5" />
              {isMenuOpen ? "Sign out" : null}
            </button>
          </div>
        ) : null}
      </aside>

      <main className={isMenuOpen ? "lg:pl-72" : "lg:pl-[72px]"}>
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
                <span className="max-w-full truncate">{label}</span>
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
