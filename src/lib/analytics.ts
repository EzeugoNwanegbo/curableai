import posthog from "posthog-js";

const postHogKey = import.meta.env.VITE_POSTHOG_KEY;
const postHogHost = import.meta.env.VITE_POSTHOG_HOST || "https://us.i.posthog.com";

let initialized = false;

function analyticsPage(pathname: string) {
  if (pathname === "/") return "home";
  if (pathname.startsWith("/chat")) return "chat";
  if (pathname.startsWith("/records")) return "health_records";
  if (pathname.startsWith("/medications")) return "medications";
  if (pathname.startsWith("/consultation")) return "doctors";
  if (pathname.startsWith("/apply-doctor")) return "doctor_application";
  if (pathname.startsWith("/doctor")) return "doctor_workspace";
  if (pathname.startsWith("/admin")) return "admin";
  if (pathname.startsWith("/auth")) return "sign_in";
  return "other";
}

export function trackPage(pathname: string) {
  if (!postHogKey || import.meta.env.DEV || typeof window === "undefined") return;

  if (!initialized) {
    posthog.init(postHogKey, {
      api_host: postHogHost,
      defaults: "2026-05-30",
      autocapture: false,
      capture_pageview: false,
      capture_pageleave: false,
      disable_session_recording: true,
      disable_surveys: true,
      disable_external_dependency_loading: true,
      person_profiles: "never",
      persistence: "memory",
      ip: false,
    });
    initialized = true;
  }

  // Send a fixed page category only. Never forward URLs, text, identity, or health details.
  posthog.capture("curable_page_view", { page: analyticsPage(pathname) });
}
