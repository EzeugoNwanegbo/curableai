export const healthConsentVersion = "2026-11-20-v1";

export function hasHealthConsent(metadata?: Record<string, unknown>) {
  return metadata?.health_ai_consent === healthConsentVersion;
}
