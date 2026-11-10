import { Link } from "@tanstack/react-router";
import "./demo/demo.css";
export function Welcome() {
  return (
    <div className="cd">
      <header className="cd-welcome-nav">
        <Link className="cd-brand" to="/">
          curable<span>.</span>
        </Link>
        <Link to="/auth">Sign in</Link>
      </header>
      <main className="cd-welcome-main">
        <section className="cd-hero">
          <div className="cd-hero-copy">
            <span className="cd-pill">YOUR STUDENT HEALTH COMPANION</span>
            <h1>
              Your health.
              <br />
              Less confusing.
              <br />
              <em>More you.</em>
            </h1>
            <p>
              Ask about symptoms, understand medicines and make sense of clinic results. Keep your
              health context together, and choose a doctor’s review when you want one.
            </p>
            <div className="cd-welcome-actions">
              <Link className="cd-primary" to="/auth" search={{ redirect: "/chat" }}>
                Talk to Curable
              </Link>
              <Link to="/auth" search={{ mode: "signup" }}>
                Create your account
              </Link>
            </div>
            <p className="cd-small-note">
              Private accounts · Saved conversations · Optional doctor review
            </p>
          </div>
        </section>
        <div className="cd-prompt-grid">
          {[
            [
              "/chat",
              "Ask a health question",
              "A real conversation informed by the context you choose to save.",
            ],
            [
              "/profile",
              "Keep your records together",
              "Add health information or explore clearly labelled fictional clinic records.",
            ],
            [
              "/consultation",
              "Choose a doctor’s review",
              "Check your summary before sharing. Chat with a doctor after they accept.",
            ],
          ].map(([to, title, text]) => (
            <Link key={to} to="/auth" search={{ redirect: to }} className="cd-prompt">
              <h2>{title}</h2>
              <p>{text}</p>
            </Link>
          ))}
        </div>
        <footer className="cd-footer">
          <span>Veritas partnership concept · No live university EMR connected.</span>
          <Link to="/" search={{ demo: true }}>
            Explore the investor demo
          </Link>
        </footer>
      </main>
    </div>
  );
}
