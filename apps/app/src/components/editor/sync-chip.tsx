"use client";

import { useCallback, useEffect, useState } from "react";
import { CloudCheck, CloudOff, CloudUpload, HardDrive, Loader2, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { hasDirtyNotes, syncNow, useSyncStatus } from "@/lib/sync";
import { persistEditor, useEditor } from "@/store/editor-store";
import { useAuth } from "@/context/auth";
import { useSettings } from "@/context/settings";
import { cn } from "@/lib/utils";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { useUI } from "@/store/ui-store";

export function SyncChip() {
  const { user } = useAuth();
  const { settings } = useSettings();
  const { state, lastSyncedAt } = useSyncStatus();
  const activeNoteId = useEditor((s) => s.note?.id ?? null);
  const conflicts = useLiveQuery(
    () => activeNoteId ? db().notes.filter((n) => n.conflictOf === activeNoteId && !n.deletedAt).count() : 0,
    [activeNoteId],
  ) ?? 0;
  const [syncing, setSyncing] = useState(false);
  const [hasUnsyncedLocal, setHasUnsyncedLocal] = useState(false);
  const signedIn = !!user && settings.syncEnabled;
  const s = conflicts ? "conflict" : !signedIn ? "local" : state;

  // Poll for dirty notes so we can show the Sync Now state
  useEffect(() => {
    if (!signedIn) return;
    const check = () => void hasDirtyNotes().then(setHasUnsyncedLocal);
    check();
    const t = setInterval(check, 2000);
    return () => clearInterval(t);
  }, [signedIn]);

  // Prompt before closing if there are unsynced changes
  useEffect(() => {
    if (!signedIn) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsyncedLocal) {
        e.preventDefault();
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [signedIn, hasUnsyncedLocal]);

  const doSync = useCallback(async () => {
    setSyncing(true);
    try {
      await persistEditor();
      await syncNow();
      setHasUnsyncedLocal(false);
      toast.success("Synced to cloud");
    } catch {
      toast.error("Sync failed. Your changes are safe locally.");
    } finally {
      setSyncing(false);
    }
  }, []);

  // Determine the effective display state for signed-in users:
  // syncing (manual sync in progress) takes priority, then unsynced, then the underlying state.
  const displayState = syncing ? "syncing" : (signedIn && hasUnsyncedLocal && s !== "conflict") ? "dirty" : s;

  const cfg = {
    local:    { icon: HardDrive,      label: "Local only",            color: "var(--status-local)",    tip: "Saved in this browser. Sign in to sync across devices.", clickable: false },
    synced:   { icon: CloudCheck,     label: "Synced",                color: "var(--status-synced)",   tip: lastSyncedAt ? `Last synced ${new Date(lastSyncedAt).toLocaleTimeString()}` : "Synced", clickable: false },
    syncing:  { icon: Loader2,        label: "Syncing in Progress",   color: "var(--status-syncing)",  tip: "Saving to your account…", clickable: false },
    dirty:    { icon: CloudUpload,    label: "Sync Now",              color: "var(--status-syncing)",  tip: "You have unsynced changes. Click to sync.", clickable: true },
    offline:  { icon: CloudOff,       label: "Offline",               color: "var(--status-offline)",  tip: "Offline. Changes are saved here and will sync when you click Sync.", clickable: false },
    error:    { icon: CloudOff,       label: "Sync paused",           color: "var(--status-offline)",  tip: "Couldn't reach the server. Changes are safe on this device.", clickable: false },
    conflict: { icon: TriangleAlert,  label: "Needs review",          color: "var(--status-conflict)", tip: `${conflicts} note${conflicts === 1 ? " was" : "s were"} changed on two devices. Click to review.`, clickable: true },
  }[displayState];
  const Icon = cfg.icon;
  const isClickable = cfg.clickable || displayState === "conflict";

  const handleClick = () => {
    if (displayState === "conflict") {
      useUI.getState().setConflictsOpen(true);
    } else if (displayState === "dirty") {
      void doSync();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (isClickable && (e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      handleClick();
    }
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          role={isClickable ? "button" : "status"}
          aria-live="polite"
          tabIndex={0}
          onClick={handleClick}
          onKeyDown={handleKeyDown}
          className={cn(
            "inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 text-[13px] font-medium transition-colors",
            isClickable ? "cursor-pointer hover:brightness-90" : "cursor-default",
            displayState === "dirty" && "animate-pulse",
          )}
          style={{ color: cfg.color, background: `color-mix(in srgb, ${cfg.color} 14%, var(--background))` }}
        >
          <Icon className={cn("size-3.5", displayState === "syncing" && "motion-safe:animate-spin")} aria-hidden />
          <span className="hidden sm:inline">{cfg.label}</span>
          <span className="sr-only sm:hidden">{cfg.label}</span>
        </span>
      </TooltipTrigger>
      <TooltipContent>{cfg.tip}</TooltipContent>
    </Tooltip>
  );
}
