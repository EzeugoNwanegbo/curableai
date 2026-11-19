import { createContext, useContext, useState } from "react";
import { Link, Navigate, Outlet, useLocation } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { CurableLoader } from "@/components/CurableLoader";
import "./demo/demo.css";
const SideMenuContext = createContext<{ target: HTMLDivElement | null; close: () => void }>({
  target: null,
  close: () => {},
});
export const useSideMenu = () => useContext(SideMenuContext);

export function AppShell() {
  const [historyTarget, setHistoryTarget] = useState<HTMLDivElement | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();
  const auth = useAuth();
  const publicPage = location.pathname === "/" || location.pathname === "/auth";
  if (location.pathname === "/auth" || (location.pathname === "/" && !auth.session))
    return <Outlet />;
  if (auth.isLoading) return <CurableLoader message="Getting Curable ready…" />;
  if (!auth.session && !publicPage)
    return <Navigate to="/auth" search={{ redirect: location.href }} replace />;
  if (auth.authError)
    return (
      <div className="cd cd-access">
        <h1>Let’s finish setting up your account.</h1>
        <p>{auth.authError}</p>
        <Link to="/auth">Back to sign in</Link>
        <button onClick={() => void auth.signOut()}>Sign out</button>
      </div>
    );
  if (
    auth.session &&
    auth.role === "patient" &&
    auth.user?.user_metadata?.health_setup_pending === true
  )
    return <Navigate to="/auth" replace />;
  const doctor = auth.role === "doctor";
  if (
    (doctor &&
      ["/chat", "/profile", "/medications", "/notifications"].includes(location.pathname)) ||
    (!doctor && location.pathname === "/doctor")
  )
    return <Navigate to={doctor ? "/doctor" : "/chat"} replace />;
  const nav = doctor
    ? [
        ["/doctor", "Review requests"],
        ["/consultation", "Conversations"],
      ]
    : [
        ["/chat", "Curable AI"],
        ["/profile", "Health record"],
        ["/medications", "Medication"],
        ["/consultation", "Doctors"],
      ];
  return (
    <SideMenuContext.Provider value={{ target: historyTarget, close: () => setMenuOpen(false) }}>
      <div className="cd cd-live-app">
        <button
          type="button"
          className="curable-menu-toggle"
          aria-expanded={menuOpen}
          aria-controls="curable-menu"
          onClick={() => setMenuOpen(!menuOpen)}
        >
          {menuOpen ? "Close menu" : "Menu"}
        </button>
        <aside id="curable-menu" className={`cd-sidebar ${menuOpen ? "is-open" : ""}`}>
          <Link className="cd-brand" to="/">
            curable<span className="cd-brand-dot">.</span>
          </Link>
          <div className="cd-workspace">
            <div>
              Student health<small>{doctor ? "Doctor workspace" : "Your personal space"}</small>
            </div>
          </div>
          <p className="cd-nav-label">Your space</p>
          <nav aria-label="Main navigation">
            {auth.user?.app_metadata?.curable_admin === true && (
              <Link to="/admin" onClick={() => setMenuOpen(false)}>
                Admin
              </Link>
            )}
            {nav.map(([to, label]) => (
              <Link
                className={location.pathname === to ? "active" : ""}
                aria-current={location.pathname === to ? "page" : undefined}
                onClick={() => setMenuOpen(false)}
                to={to}
                key={to}
              >
                {label}
              </Link>
            ))}
          </nav>
          <div ref={setHistoryTarget} className="min-h-0 overflow-y-auto" />
          <div className="cd-sidebar-bottom">
            <div className="cd-person">
              <div>
                {auth.displayName}
                <small>{doctor ? "Approved doctor" : "Student account"}</small>
              </div>
            </div>
            <button className="cd-doctor-switch" onClick={() => void auth.signOut()}>
              Sign out
            </button>
          </div>
        </aside>
        <div className="cd-body">
          <Outlet />
        </div>
      </div>
    </SideMenuContext.Provider>
  );
}
