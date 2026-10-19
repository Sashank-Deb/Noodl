/**
 * Firebase is optional and lazy-loaded. With no env config the app runs fully
 * local (guest mode) and never downloads the Firebase SDK. With config, the SDK
 * modules are dynamically imported the first time they are needed, so guests
 * and first paint stay light.
 */
import type { FirebaseApp } from "firebase/app";

const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
};

export const RECAPTCHA_SITE_KEY = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;
export const GEMINI_MODEL = process.env.NEXT_PUBLIC_GEMINI_MODEL || "gemini-3.1-flash-lite";

export const firebaseConfigured = Boolean(config.apiKey && config.projectId && config.appId);

let appPromise: Promise<FirebaseApp> | null = null;

export function getFirebaseApp(): Promise<FirebaseApp> {
  if (!firebaseConfigured) return Promise.reject(new Error("Firebase is not configured"));
  if (!appPromise) {
    appPromise = (async () => {
      const { initializeApp, getApps } = await import("firebase/app");
      const app = getApps()[0] ?? initializeApp(config);
      // App Check protects Firestore and AI Logic from abuse (required for
      // AI Logic from Nov 2026). reCAPTCHA v3 is free.
      if (RECAPTCHA_SITE_KEY && typeof window !== "undefined") {
        const { initializeAppCheck, ReCaptchaV3Provider } = await import("firebase/app-check");
        if (process.env.NODE_ENV !== "production") {
          // Lets local dev obtain a debug token (register it in the console).
          (self as unknown as { FIREBASE_APPCHECK_DEBUG_TOKEN?: boolean }).FIREBASE_APPCHECK_DEBUG_TOKEN = true;
        }
        try {
          initializeAppCheck(app, {
            provider: new ReCaptchaV3Provider(RECAPTCHA_SITE_KEY),
            isTokenAutoRefreshEnabled: true,
          });
        } catch {
          /* already initialised (fast refresh) */
        }
      }
      return app;
    })();
  }
  return appPromise;
}
