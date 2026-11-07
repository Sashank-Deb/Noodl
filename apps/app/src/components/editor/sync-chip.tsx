"use client";

import { useCallback, useEffect, useState } from "react";
import { CloudCheck, CloudOff, CloudUpload, HardDrive, Loader2, RefreshCw, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
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

  // Poll for dirty notes so we can show the Sync button
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

  const cfg = {
    local: { icon: HardDrive, label: "Local only", color: "var(--status-local)", tip: "Saved in this browser. Sign in to sync across devices." },
    synced: { icon: CloudCheck, label: "Synced", color: "var(--status-synced)", tip: lastSyncedAt ? `Last synced ${new Date(lastSyncedAt).toLocaleTimeString()}` : "Synced" },
    syncing: { icon: RefreshCw, label: "Syncing", color: "var(--status-syncing)", tip: "Saving to your account…" },
    offline: { icon: CloudOff, label: "Offline", color: "var(--status-offline)", tip: "Offline. Changes are saved here and will sync when you click Sync." },
    error: { icon: CloudOff, label: "Sync paused", color: "var(--status-offline)", tip: "Couldn't reach the server. Changes are safe on this device." },
    conflict: { icon: TriangleAlert, label: "Needs review", color: "var(--status-conflict)", tip: `${conflicts} note${conflicts === 1 ? " was" : "s were"} changed on two devices. Click to review.` },
  }[s];
  const Icon = cfg.icon;

  return (
    <div className="flex items-center gap-1">
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            role={s === "conflict" ? "button" : "status"}
            aria-live="polite"
            tabIndex={0}
            onClick={() => s === "conflict" && useUI.getState().setConflictsOpen(true)}
            onKeyDown={(e) => s === "conflict" && (e.key === "Enter" || e.key === " ") && (e.preventDefault(), useUI.getState().setConflictsOpen(true))}
            className="inline-flex h-7 cursor-default data-[c=true]:cursor-pointer items-center gap-1.5 rounded-full px-2.5 text-[13px] font-medium"
            data-c={s === "conflict"}
            style={{ color: cfg.color, background: `color-mix(in srgb, ${cfg.color} 14%, var(--background))` }}
          >
            <Icon className={cn("size-3.5", s === "syncing" && "motion-safe:animate-spin")} aria-hidden />
            <span className="hidden sm:inline">{cfg.label}</span>
            <span className="sr-only sm:hidden">{cfg.label}</span>
          </span>
        </TooltipTrigger>
        <TooltipContent>{cfg.tip}</TooltipContent>
      </Tooltip>

      {signedIn && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={hasUnsyncedLocal ? "default" : "ghost"}
              size="sm"
              className={cn("h-7 gap-1.5 px-2", hasUnsyncedLocal && "animate-pulse")}
              onClick={() => void doSync()}
              disabled={syncing}
              aria-label="Sync to cloud"
            >
              {syncing ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <CloudUpload className="size-3.5" />
              )}
              <span className="hidden sm:inline">{syncing ? "Syncing…" : "Sync"}</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {hasUnsyncedLocal ? "You have unsynced changes. Click to sync." : "Sync your notes to the cloud"}
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}
