import { Link } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import "./demo/demo.css";
export function LiveOverview() {
  const { displayName, role } = useAuth();
  return (
    <div className="cd">
      <main className="cd-main">
        <div className="cd-page-heading">
          <div>
            <p className="cd-eyebrow">YOUR HEALTH, UNDERSTOOD</p>
            <h1>Hello, {displayName.split(" ")[0]}.</h1>
            <p>
              {role === "doctor"
                ? "Review requests and continue care with your students."
                : "A clearer picture of your health, one conversation at a time."}
            </p>
          </div>
        </div>
        <section className="cd-hero">
          <div className="cd-hero-copy">
            <span className="cd-pill">CURABLE · STUDENT HEALTH</span>
            <h2>
              Your health.
              <br />
              Less confusing.
              <br />
              <em>More you.</em>
            </h2>
            <p>
              {role === "doctor"
                ? "Read the student’s confirmed summary, accept their request, and continue in a separate consultation."
                : "Ask about symptoms, medicines or clinic results. Your saved health context helps Curable ask more relevant questions."}
            </p>
            <Link className="cd-primary" to={role === "doctor" ? "/doctor" : "/chat"}>
              {role === "doctor" ? "Open review requests" : "Ask Curable"}
            </Link>
          </div>
        </section>
        <div className="cd-prompt-grid" style={{ marginTop: 32 }}>
          {(role === "doctor"
            ? [
                ["/doctor", "Review requests", "Summaries shared by students assigned to you."],
                [
                  "/consultation",
                  "Your consultations",
                  "Continue the conversation after accepting a request.",
                ],
              ]
            : [
                [
                  "/profile",
                  "Your health records",
                  "View your profile or load a fictional clinic record.",
                ],
                ["/medications", "Your medicines", "Keep your prescription context together."],
                [
                  "/consultation",
                  "Doctor conversations",
                  "Choose a doctor and follow your review request.",
                ],
              ]
          ).map(([to, title, description]) => (
            <Link className="cd-prompt" key={to} to={to}>
              <h3>{title}</h3>
              <p>{description}</p>
            </Link>
          ))}
        </div>
        <footer className="cd-footer">
          Veritas partnership concept · Sample records are clearly labelled. No live university EMR
          is connected.
        </footer>
      </main>
    </div>
  );
}
