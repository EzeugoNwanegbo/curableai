export function CurableLoader({ message = "Getting your space ready…" }: { message?: string }) {
  return (
    <main className="curable-loading-screen" aria-label="Loading Curable">
      <div className="curable-loading-content">
        <div className="curable-loading-brand" aria-hidden="true">
          curable<span>.</span>
        </div>
        <div className="curable-loading-line" aria-hidden="true">
          <span />
        </div>
        <p role="status">{message}</p>
      </div>
    </main>
  );
}
