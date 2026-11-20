import { HealthConsent } from "@/components/HealthConsent";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { Link, Navigate, Outlet, useBlocker, useLocation } from "@tanstack/react-router";
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
  const toggleRef = useRef<HTMLButtonElement>(null);
  const swipeStart = useRef<{ x: number; y: number } | null>(null);
  useBlocker({
    disabled: !menuOpen,
    enableBeforeUnload: false,
    shouldBlockFn: ({ action }) => {
      if (action !== "BACK") return false;
      setMenuOpen(false);
      toggleRef.current?.focus();
      return true;
    },
  });
  useEffect(() => {
    if (!menuOpen) return;
    function dismiss(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMenuOpen(false);
        toggleRef.current?.focus();
      }
    }
    const mobile = window.matchMedia("(max-width: 800px)");
    const resize = () => { if (!mobile.matches) setMenuOpen(false); };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    mobile.addEventListener("change", resize);
    window.addEventListener("keydown", dismiss);
    return () => {
      document.body.style.overflow = previousOverflow;
      mobile.removeEventListener("change", resize);
      window.removeEventListener("keydown", dismiss);
    };
  }, [menuOpen]);
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
    location.pathname !== "/apply-doctor" &&
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
          ref={toggleRef}
          className="curable-menu-toggle"
          aria-expanded={menuOpen}
          aria-controls="curable-menu"
          onClick={() => setMenuOpen(!menuOpen)}
        >
          {menuOpen ? "Close menu" : "Menu"}
        </button>
        {menuOpen && <button type="button" tabIndex={-1} aria-label="Dismiss menu"
          className="curable-menu-backdrop" onClick={() => { setMenuOpen(false); toggleRef.current?.focus(); }} />}
        <aside
          onTouchStart={(event) => {
            const touch = event.touches[0];
            swipeStart.current = menuOpen && event.touches.length === 1 ? { x: touch.clientX, y: touch.clientY } : null;
          }}
          onTouchCancel={() => { swipeStart.current = null; }}
          onTouchEnd={(event) => {
            const start = swipeStart.current;
            swipeStart.current = null;
            if (!start || event.touches.length) return;
            const touch = event.changedTouches[0];
            const left = start.x - touch.clientX;
            if (left > 60 && left > 2 * Math.abs(touch.clientY - start.y)) {
              setMenuOpen(false);
              toggleRef.current?.focus();
            }
          }}
          id="curable-menu" className={`cd-sidebar ${menuOpen ? "is-open" : ""}`}>
          <Link className="cd-brand" to="/" onClick={() => setMenuOpen(false)}>
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
        <div className="cd-body" inert={menuOpen}>
          {location.pathname === "/chat" ? <HealthConsent><Outlet /></HealthConsent> : <Outlet />}
        </div>
      </div>
    </SideMenuContext.Provider>
  );
}
