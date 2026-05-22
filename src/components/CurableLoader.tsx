export function CurableLoader({ message = "Loading Curable..." }: { message?: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="flex flex-col items-center gap-5 text-center">
        <div className="curable-loader" role="img" aria-label="Curable loading">
          <svg
            className="curable-loader__mark"
            viewBox="0 0 96 96"
            aria-hidden="true"
            focusable="false"
          >
            <path className="curable-loader__track" d="M65 22a31 31 0 1 0 0 52" />
            <path className="curable-loader__stroke" d="M65 22a31 31 0 1 0 0 52" />
          </svg>
        </div>
        <p className="text-sm font-semibold text-muted-foreground">{message}</p>
      </div>
    </div>
  );
}
