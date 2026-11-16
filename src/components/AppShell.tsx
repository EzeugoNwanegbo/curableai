import { Link, Navigate, Outlet, useLocation } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { CurableLoader } from "@/components/CurableLoader";
import "./demo/demo.css";
export function AppShell() {
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
  const doctor = auth.role === "doctor";
  if (
    (doctor &&
      ["/chat", "/profile", "/medications", "/notifications"].includes(location.pathname)) ||
    (!doctor && location.pathname === "/doctor")
  )
    return <Navigate to="/" replace />;
  const nav = doctor
    ? [
        ["/", "Overview"],
        ["/doctor", "Review requests"],
        ["/consultation", "Conversations"],
      ]
    : [
        ["/", "Overview"],
        ["/chat", "Ask Curable"],
        ["/profile", "Health records"],
        ["/medications", "Medicines"],
        ["/consultation", "Doctor conversations"],
      ];
  return (
    <div className="cd cd-live-app">
      <aside className="cd-sidebar">
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
          {nav.map(([to, label]) => (
            <Link
              className={location.pathname === to ? "active" : ""}
              aria-current={location.pathname === to ? "page" : undefined}
              to={to}
              key={to}
            >
              {label}
            </Link>
          ))}
        </nav>
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
        <header className="cd-topbar">
          <span>Student health</span>
          <span>Your health, in context</span>
        </header>
        <Outlet />
      </div>
    </div>
  );
}
