import { createFileRoute } from "@tanstack/react-router";
import { Welcome } from "@/components/Welcome";
import { LiveOverview } from "@/components/LiveOverview";
import { useAuth } from "@/lib/auth";
import { CurableDemo } from "@/components/demo/CurableDemo";
export const Route = createFileRoute("/")({
  validateSearch: (s: Record<string, unknown>): { demo?: boolean } => ({
    demo: s.demo === true || s.demo === "true" ? true : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Curable · Your health, understood" },
      {
        name: "description",
        content: "A personalized student health companion. Explore the Veritas student care demo.",
      },
    ],
  }),
  component: Overview,
});

function Overview() {
  const { session } = useAuth();
  const { demo } = Route.useSearch();
  return session ? <LiveOverview /> : demo ? <CurableDemo /> : <Welcome />;
}
