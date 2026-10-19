"use client";

/**
 * Auth is optional (Supabase Auth: Google OAuth + email magic link). Guests
 * never download supabase-js unless they open sign-in, signed in before on
 * this device, or land here from a sign-in redirect.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { getSupabase, supabaseConfigured } from "@/lib/supabase";
import { startSync, stopSync } from "@/lib/sync";
import { useAIStatus } from "@/lib/ai/ai";
import { useSettings } from "./settings";

export interface AuthUser {
  uid: string;
  name: string | null;
  email: string | null;
  photoURL: string | null;
}

interface AuthCtx {
  user: AuthUser | null;
  loading: boolean;
  configured: boolean;
  signInWithGoogle: () => Promise<void>;
  sendEmailLink: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthCtx>({
  user: null,
  loading: false,
  configured: false,
  signInWithGoogle: async () => {},
  sendEmailLink: async () => {},
  signOut: async () => {},
});

const WAS_SIGNED_IN = "mn:wasSignedIn";

const toUser = (u: User): AuthUser => ({
  uid: u.id,
  name: (u.user_metadata?.full_name as string) ?? (u.user_metadata?.name as string) ?? null,
  email: u.email ?? null,
  photoURL: (u.user_metadata?.avatar_url as string) ?? (u.user_metadata?.picture as string) ?? null,
});

/** Where Supabase sends people back after Google / the email link. */
const redirectTo = () => `${window.location.origin}/app/`;

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(false);
  const listening = useRef(false);
  const { settings } = useSettings();

  const listen = useCallback(async () => {
    if (listening.current || !supabaseConfigured) return;
    listening.current = true;
    setLoading(true);
    const sb = await getSupabase();
    sb.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ? toUser(session.user) : null);
      setLoading(false);
      try {
        if (session?.user) localStorage.setItem(WAS_SIGNED_IN, "1");
        else localStorage.removeItem(WAS_SIGNED_IN);
      } catch {}
    });
    // Picks up the session (and finishes an OAuth / magic-link redirect: ?code=…).
    const { data } = await sb.auth.getSession();
    setUser(data.session?.user ? toUser(data.session.user) : null);
    setLoading(false);
    const url = new URL(window.location.href);
    if (url.searchParams.has("code") || url.hash.includes("access_token")) {
      url.searchParams.delete("code");
      url.hash = "";
      window.history.replaceState(null, "", url.toString());
    }
  }, []);

  useEffect(() => {
    if (!supabaseConfigured) return;
    let should = false;
    try {
      should =
        localStorage.getItem(WAS_SIGNED_IN) === "1" ||
        new URLSearchParams(window.location.search).has("code") ||
        window.location.hash.includes("access_token");
    } catch {}
    if (!should) return;
    const t = setTimeout(() => void listen(), 0);
    return () => clearTimeout(t);
  }, [listen]);

  // AI needs a session; start/stop cloud sync with it too.
  useEffect(() => {
    useAIStatus.getState().setSignedIn(!!user);
  }, [user]);

  useEffect(() => {
    if (user && settings.syncEnabled) void startSync(user.uid);
    else void stopSync();
  }, [user, settings.syncEnabled]);

  const signInWithGoogle = useCallback(async () => {
    await listen();
    const sb = await getSupabase();
    const { error } = await sb.auth.signInWithOAuth({ provider: "google", options: { redirectTo: redirectTo() } });
    if (error) throw error;
  }, [listen]);

  const sendEmailLink = useCallback(
    async (email: string) => {
      await listen();
      const sb = await getSupabase();
      const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo() } });
      if (error) throw error;
    },
    [listen],
  );

  const signOut = useCallback(async () => {
    const sb = await getSupabase();
    await stopSync();
    await sb.auth.signOut();
  }, []);

  const value = useMemo(
    () => ({ user, loading, configured: supabaseConfigured, signInWithGoogle, sendEmailLink, signOut }),
    [user, loading, signInWithGoogle, sendEmailLink, signOut],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
