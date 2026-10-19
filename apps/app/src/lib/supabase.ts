/**
 * Supabase is optional and lazy-loaded. With no env config the app runs fully
 * local (guest mode) and never downloads supabase-js. With config, the client
 * is created the first time sign-in or sync needs it.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
// Supabase calls this the "publishable" (formerly "anon") key. It is public by design;
// row-level security in supabase/migrations protects the data.
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabaseConfigured = Boolean(url && key);

/** Where the AI function lives (same origin on Vercel). Override for local dev. */
export const AI_ENDPOINT = process.env.NEXT_PUBLIC_AI_ENDPOINT || "/api/ai";

let clientPromise: Promise<SupabaseClient> | null = null;

export function getSupabase(): Promise<SupabaseClient> {
  if (!supabaseConfigured) return Promise.reject(new Error("Supabase is not configured"));
  if (!clientPromise) {
    clientPromise = import("@supabase/supabase-js").then(({ createClient }) =>
      createClient(url!, key!, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: "pkce" },
      }),
    );
  }
  return clientPromise;
}

/** Current access token, or null for guests. */
export async function getAccessToken(): Promise<string | null> {
  if (!supabaseConfigured) return null;
  const sb = await getSupabase();
  const { data } = await sb.auth.getSession();
  return data.session?.access_token ?? null;
}
