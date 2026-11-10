import { createFileRoute } from "@tanstack/react-router";
import { LiveOverview } from "@/components/LiveOverview";
import { useAuth } from "@/lib/auth";
import { CurableDemo } from "@/components/demo/CurableDemo";
export const Route = createFileRoute("/")({
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
  return session ? <LiveOverview /> : <CurableDemo />;
}
