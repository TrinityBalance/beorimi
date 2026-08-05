"use client";

import { getSupabaseBrowserClient, SupabaseConfigurationError } from "@/lib/supabase-browser";

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

export async function createAccount(email: string, password: string) {
  const { data, error } = await client().auth.signUp({
    email,
    password,
    options: { emailRedirectTo: `${window.location.origin}/login` },
  });
  if (error) throw error;
  return data;
}
