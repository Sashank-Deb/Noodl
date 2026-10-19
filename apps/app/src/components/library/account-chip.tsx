"use client";

import { useState } from "react";
import { toast } from "sonner";
import { HardDrive, Loader2, LogOut, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useAuth } from "@/context/auth";
import { schedulePush, useSyncStatus } from "@/lib/sync";
import { clearLocalData } from "@/lib/db";
import { persistEditor, useEditor } from "@/store/editor-store";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

function GoogleG() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.1A6.6 6.6 0 0 1 5.5 12c0-.73.13-1.44.34-2.1V7.06H2.18A11 11 0 0 0 1 12c0 1.77.42 3.45 1.18 4.94l3.66-2.84z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"
      />
    </svg>
  );
}

const AVATAR_HUES = [12, 38, 145, 175, 200, 225, 260, 290, 330];

function initials(name: string | null, email: string | null) {
  const src = (name || email?.split("@")[0] || "?").trim();
  const parts = src.split(/[\s._-]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "?") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

/** Google profile photo; falls back to coloured initials if missing or it fails to load. */
function UserAvatar({ user, size = "size-8" }: { user: NonNullable<ReturnType<typeof useAuth>["user"]>; size?: string }) {
  const [failed, setFailed] = useState<string | null>(null);
  const photo = user.photoURL && failed !== user.photoURL ? user.photoURL : null;
  if (photo)
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={photo}
        alt=""
        referrerPolicy="no-referrer"
        onError={() => setFailed(photo)}
        className={`${size} shrink-0 rounded-full object-cover`}
      />
    );
  let h = 0;
  for (const c of user.uid) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const hue = AVATAR_HUES[h % AVATAR_HUES.length];
  return (
    <span
      aria-hidden
      className={`${size} grid shrink-0 place-items-center rounded-full text-[12px] font-semibold text-white`}
      style={{ background: `oklch(0.62 0.14 ${hue})` }}
    >
      {initials(user.name, user.email)}
    </span>
  );
}

export function AccountChip() {
  const {
    user,
    configured,
    loading,
    signInWithGoogle,
    signOut,
  } = useAuth();
  const { lastSyncedAt } = useSyncStatus();
  const [busy, setBusy] = useState(false);
  const [confirmOut, setConfirmOut] = useState(false);

  const doSignOut = async (keep: boolean) => {
    setConfirmOut(false);
    await signOut();
    if (!keep) {
      useEditor.getState().load(null);
      await clearLocalData();
      toast("Signed out and removed your notes from this device.");
    } else toast("Signed out. A copy of your notes stays on this device.");
  };

  const google = async () => {
    setBusy(true);
    try {
      // Google sign-in leaves the page and comes back to /app/; save first.
      await persistEditor();
      await signInWithGoogle();
    } catch {
      toast.error("Sign-in didn't start. Try again.");
      setBusy(false);
    }
  };

  return (
    <>
      <AlertDialog open={confirmOut} onOpenChange={setConfirmOut}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Keep a copy on this device?</AlertDialogTitle>
            <AlertDialogDescription>
              Your notes are safe in your account either way. Remove them if
              this is a shared computer. Notes you keep here will be merged into
              whichever account signs in next.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button variant="outline" onClick={() => void doSignOut(false)}>
              Remove from this device
            </Button>
            <AlertDialogAction onClick={() => void doSignOut(true)}>
              Keep a copy
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="flex w-full min-w-0 items-center gap-2.5 rounded-[10px] px-2 py-1.5 text-left hover:bg-sidebar-accent"
          >
            {user ? (
              <UserAvatar user={user} />
            ) : (
              <span className="grid size-8 shrink-0 place-items-center rounded-full border border-dashed border-input bg-secondary text-secondary-foreground">
                {loading ? <Loader2 className="size-4 animate-spin" /> : <HardDrive className="size-4" />}
              </span>
            )}
            <span className="flex min-w-0 flex-col">
              <span className="truncate text-[13px] font-semibold">
                {user ? (user.name ?? user.email) : "Guest"}
              </span>
              <span className="truncate text-xs font-medium text-primary">
                {user
                  ? (user.email ?? "Signed in")
                  : loading
                    ? "Signing in…"
                    : configured
                    ? "Sign in with Google to sync"
                    : "Saved in this browser"}
              </span>
            </span>
          </button>
        </PopoverTrigger>
        <PopoverContent side="top" align="start" className="w-80 rounded-xl">
          {user ? (
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-3">
                <UserAvatar user={user} size="size-10" />
                <div className="min-w-0">
                  <p className="truncate font-medium">{user.name ?? user.email}</p>
                  <p className="truncate text-muted-foreground">{user.email}</p>
                </div>
              </div>
              <p className="text-muted-foreground">
                {lastSyncedAt
                  ? `Last synced ${new Date(lastSyncedAt).toLocaleTimeString()}.`
                  : "Sync starts in a moment."}
              </p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => schedulePush(0)}
                >
                  <RefreshCw className="size-3.5" /> Sync now
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setConfirmOut(true)}
                >
                  <LogOut className="size-3.5" /> Sign out
                </Button>
              </div>
            </div>
          ) : !configured ? (
            <div className="space-y-2 text-sm">
              <p className="font-medium">
                Your notes are saved in this browser.
              </p>
              <p className="text-muted-foreground">
                Cloud sync isn&apos;t set up for this deployment. Export a
                backup from Settings to move notes between devices.
              </p>
            </div>
          ) : (
            <div className="space-y-3 text-sm">
              <p>
                <span className="font-medium">
                  Your notes are saved in this browser.
                </span>{" "}
                <span className="text-muted-foreground">
                  Sign in with your Google (Gmail) account to back them up, open them on other devices and use AI.
                </span>
              </p>
              <Button className="w-full" onClick={google} disabled={busy}>
                {busy ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <GoogleG />
                )}{" "}
                Sign in with Google
              </Button>
              <p className="text-xs text-muted-foreground">
                Notes on this device are merged into your account.
              </p>
            </div>
          )}
        </PopoverContent>
      </Popover>
    </>
  );
}
