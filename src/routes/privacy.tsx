import { createFileRoute } from "@tanstack/react-router";
import { HealthConsent } from "@/components/HealthConsent";

export const Route = createFileRoute("/privacy")({ component: PrivacyPage });

function PrivacyPage() {
  return <main className="container-page py-10"><h1 className="font-serif text-3xl">Privacy</h1><HealthConsent /></main>;
}
