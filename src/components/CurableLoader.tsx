import type { CSSProperties } from "react";

const cTiles = [
  { x: 2, y: 0, delay: 0 },
  { x: 1, y: 0, delay: 1 },
  { x: 0, y: 1, delay: 2 },
  { x: 0, y: 2, delay: 3 },
  { x: 0, y: 3, delay: 4 },
  { x: 1, y: 4, delay: 5 },
  { x: 2, y: 4, delay: 6 },
  { x: 3, y: 0, delay: 7 },
  { x: 3, y: 4, delay: 8 },
];

export function CurableLoader({ message = "Loading Curable..." }: { message?: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="flex flex-col items-center gap-5 text-center">
        <div className="curable-loader" role="img" aria-label="Curable loading">
          <div className="curable-loader__glow" />
          <svg
            className="curable-loader__snake"
            viewBox="0 0 112 112"
            aria-hidden="true"
            focusable="false"
          >
            <path d="M72 20C51 20 34 35 34 56s17 36 38 36" />
            <path d="M52 29c11 7 11 16 0 23s-11 16 0 23 11 15 0 22" />
          </svg>
          {cTiles.map((tile) => (
            <span
              key={`${tile.x}-${tile.y}`}
              className="curable-loader__tile"
              style={
                {
                  "--tile-x": tile.x,
                  "--tile-y": tile.y,
                  "--tile-delay": tile.delay,
                } as CSSProperties
              }
            />
          ))}
          <span className="curable-loader__cross" aria-hidden="true" />
        </div>
        <p className="text-sm font-semibold text-muted-foreground">{message}</p>
      </div>
    </div>
  );
}
