import { Link } from "@tanstack/react-router";
import "./demo/demo.css";
export function Welcome() {
  return (
    <div className="cd cd-welcome">
      <header className="cd-welcome-nav">
        <Link className="cd-brand" to="/">
          curable<span>.</span>
        </Link>
        <Link to="/auth">Sign in</Link>
      </header>
      <main className="cd-welcome-main">
        <section className="cd-hero">
          <div className="cd-hero-copy">
            <span className="cd-pill">For university students</span>
            <h1>Know what to say at your next clinic visit.</h1>
            <p>
              Put your symptoms, medicines and questions in one note you can bring to your
              clinician.
            </p>
            <div className="cd-welcome-actions">
              <Link className="cd-primary" to="/" search={{ prep: true }}>
                Create a visit note
              </Link>
              <Link to="/" search={{ demo: true }}>
                Try a sample conversation
              </Link>
            </div>
            <p className="cd-small-note">Free to use. No account needed.</p>
          </div>
        </section>
      </main>
    </div>
  );
}
