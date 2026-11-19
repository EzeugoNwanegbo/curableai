import { createFileRoute } from "@tanstack/react-router";
import { Welcome } from "@/components/Welcome";
import { LiveOverview } from "@/components/LiveOverview";
import { useAuth } from "@/lib/auth";
import { CurableDemo } from "@/components/demo/CurableDemo";
import { VisitPrep } from "@/components/VisitPrep";
export const Route = createFileRoute("/")({
  validateSearch: (s: Record<string, unknown>): { demo?: boolean; prep?: boolean } => ({
    prep: s.prep === true || s.prep === "true" ? true : undefined,
    demo: s.demo === true || s.demo === "true" ? true : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Curable · Your health, understood" },
      {
        name: "description",
        content: "Prepare a note with your symptoms, medicines and questions for your next clinic visit.",
      },
    ],
  }),
  component: Overview,
});

function Overview() {
  const { session } = useAuth();
  const { demo, prep } = Route.useSearch();
  if (prep) return <VisitPrep />;
  return demo ? <CurableDemo /> : session ? <LiveOverview /> : <Welcome />;
}
