"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | undefined;

export class SupabaseConfigurationError extends Error {
  constructor() {
    super("Supabase configuration is missing.");
    this.name = "SupabaseConfigurationError";
  }
}

export function getSupabaseBrowserClient(): SupabaseClient {
  if (client) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!url || !key) throw new SupabaseConfigurationError();
  client = createClient(url, key);
  return client;
}
