import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { nitro } from "nitro/vite";

// Nitro produces Vercel Functions on Vercel and a Node server for local production.
// The shared configuration already supplies React, Tailwind and TanStack Start.
export default defineConfig({
  cloudflare: false,
  tanstackStart: { server: { entry: "server" } },
  plugins: [nitro()],
});
