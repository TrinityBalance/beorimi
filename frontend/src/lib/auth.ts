"use client";

import { getSupabaseBrowserClient, SupabaseConfigurationError } from "@/lib/supabase-browser";
import { privacyConsentMetadata } from "@/lib/privacy-consent";

export class AuthConfigurationError extends SupabaseConfigurationError {}

export class AuthRequiredError extends Error {
  constructor() {
    super("로그인이 필요해요.");
    this.name = "AuthRequiredError";
  }
}

function client() {
  try {
    return getSupabaseBrowserClient();
  } catch (error) {
    if (error instanceof SupabaseConfigurationError) throw new AuthConfigurationError();
    throw error;
  }
}

export async function getAccessToken(): Promise<string> {
  const { data, error } = await client().auth.getSession();
  if (error || !data.session?.access_token) throw new AuthRequiredError();
  return data.session.access_token;
}

export async function signInWithPassword(email: string, password: string) {
  const { data, error } = await client().auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function createAccount(
  email: string,
  password: string,
  privacyConsentAccepted: boolean,
  nextPath = "/",
) {
  if (!privacyConsentAccepted) {
    throw new Error("개인정보 수집·이용에 동의해주세요.");
  }

  const redirectUrl = new URL("/login", window.location.origin);
  redirectUrl.searchParams.set("next", nextPath);
  const { data, error } = await client().auth.signUp({
    email,
    password,
    options: {
      data: privacyConsentMetadata(),
      emailRedirectTo: redirectUrl.toString(),
    },
  });
  if (error) throw error;
  return data;
}

export async function getCurrentUser() {
  const { data, error } = await client().auth.getUser();
  if (error || !data.user) throw new AuthRequiredError();
  return data.user;
}

export async function recordPrivacyConsent() {
  const user = await getCurrentUser();
  const { data, error } = await client().auth.updateUser({
    data: privacyConsentMetadata(user.user_metadata),
  });
  if (error || !data.user) throw error ?? new Error("동의 정보를 저장하지 못했어요.");
  return data.user;
}

export async function signOutCurrentUser() {
  const { error } = await client().auth.signOut({ scope: "local" });
  if (error) throw error;
}

export async function deleteCurrentAccount() {
  const accessToken = await getAccessToken();
  const response = await fetch("/api/account", {
    method: "DELETE",
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { detail?: string } | null;
    throw new Error(body?.detail ?? "회원탈퇴를 완료하지 못했어요.");
  }
  await client().auth.signOut({ scope: "local" });
}
