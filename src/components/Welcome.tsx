import { Link } from "@tanstack/react-router";
import "./demo/demo.css";
export function Welcome() {
  return (
    <main className="cd cd-welcome grid min-h-svh place-items-center px-6 text-center">
      <div className="grid justify-items-center gap-8">
        <h1 className="!text-5xl sm:!text-7xl">DOCTOR IN YOUR POCKET</h1>
        <Link className="cd-primary" to="/auth">
          Try now
        </Link>
      </div>
    </main>
  );
}
