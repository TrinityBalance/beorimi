import type { User } from "@supabase/supabase-js";

export const PRIVACY_CONSENT_VERSION = "2026-08-06";

type ConsentUser = Pick<User, "user_metadata">;

// AIDEV-NOTE: Signup, upload authorization, and the capture gate must use this same consent version.
export function hasPrivacyConsent(user: ConsentUser): boolean {
  return user.user_metadata?.privacy_consent_version === PRIVACY_CONSENT_VERSION &&
    typeof user.user_metadata?.privacy_consent_at === "string";
}

export function privacyConsentMetadata(existing: Record<string, unknown> = {}) {
  return {
    ...existing,
    privacy_consent_version: PRIVACY_CONSENT_VERSION,
    privacy_consent_at: new Date().toISOString(),
  };
}
