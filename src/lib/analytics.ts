import posthog from "posthog-js";

const postHogKey = import.meta.env.VITE_POSTHOG_KEY;
const postHogHost = import.meta.env.VITE_POSTHOG_HOST || "https://us.i.posthog.com";

let initialized = false;

export function trackPage() {
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
      before_send: (event) => {
        if (!event) return event;
        event.properties = { $geoip_disable: true };
        return event;
      },
    });
    initialized = true;
  }

  // Count app navigation without sending URLs, page labels, text, or identity.
  posthog.capture("curable_app_view");
}
