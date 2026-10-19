"use client";

/**
 * Auth is optional. Guests never download the Firebase Auth SDK unless they
 * open the sign-in dialog (or signed in before on this device).
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { User } from "firebase/auth";
import { firebaseConfigured, getFirebaseApp } from "@/lib/firebase";
import { startSync, stopSync } from "@/lib/sync";
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
const EMAIL_FOR_LINK = "mn:emailForSignIn";

async function auth() {
  const app = await getFirebaseApp();
  const mod = await import("firebase/auth");
  return { a: mod.getAuth(app), mod };
}

const toUser = (u: User): AuthUser => ({ uid: u.uid, name: u.displayName, email: u.email, photoURL: u.photoURL });

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const { settings } = useSettings();

  const listen = useCallback(async () => {
    if (listening || !firebaseConfigured) return;
    setListening(true);
    setLoading(true);
    const { a, mod } = await auth();
    // Complete an email-link sign-in if we landed on one.
    if (mod.isSignInWithEmailLink(a, window.location.href)) {
      let email = localStorage.getItem(EMAIL_FOR_LINK);
      if (!email) email = window.prompt("Confirm your email to finish signing in") ?? "";
      if (email) {
        try {
          await mod.signInWithEmailLink(a, email, window.location.href);
        } finally {
          localStorage.removeItem(EMAIL_FOR_LINK);
          const url = new URL(window.location.href);
          ["apiKey", "oobCode", "mode", "lang", "continueUrl"].forEach((k) => url.searchParams.delete(k));
          window.history.replaceState(null, "", url.toString());
        }
      }
    }
    mod.onAuthStateChanged(a, (u) => {
      setUser(u ? toUser(u) : null);
      setLoading(false);
      try {
        if (u) localStorage.setItem(WAS_SIGNED_IN, "1");
        else localStorage.removeItem(WAS_SIGNED_IN);
      } catch {}
    });
  }, [listening]);

  useEffect(() => {
    if (!firebaseConfigured) return;
    let should = false;
    try {
      should = localStorage.getItem(WAS_SIGNED_IN) === "1" || window.location.search.includes("oobCode=");
    } catch {}
    if (!should) return;
    const t = setTimeout(() => void listen(), 0);
    return () => clearTimeout(t);
  }, [listen]);

  // Start/stop cloud sync with the session.
  useEffect(() => {
    if (user && settings.syncEnabled) void startSync(user.uid);
    else void stopSync();
  }, [user, settings.syncEnabled]);

  const signInWithGoogle = useCallback(async () => {
    await listen();
    const { a, mod } = await auth();
    const provider = new mod.GoogleAuthProvider();
    try {
      await mod.signInWithPopup(a, provider);
    } catch (e) {
      const code = (e as { code?: string }).code;
      if (code === "auth/popup-blocked" || code === "auth/operation-not-supported-in-this-environment") {
        await mod.signInWithRedirect(a, provider);
      } else throw e;
    }
  }, [listen]);

  const sendEmailLink = useCallback(async (email: string) => {
    const { a, mod } = await auth();
    await mod.sendSignInLinkToEmail(a, email, { url: window.location.origin + "/", handleCodeInApp: true });
    localStorage.setItem(EMAIL_FOR_LINK, email);
  }, []);

  const signOut = useCallback(async () => {
    const { a, mod } = await auth();
    await stopSync();
    await mod.signOut(a);
  }, []);

  const value = useMemo(
    () => ({ user, loading, configured: firebaseConfigured, signInWithGoogle, sendEmailLink, signOut }),
    [user, loading, signInWithGoogle, sendEmailLink, signOut],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
