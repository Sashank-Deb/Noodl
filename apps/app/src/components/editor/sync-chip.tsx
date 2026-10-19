"use client";

import { CloudCheck, CloudOff, HardDrive, RefreshCw, TriangleAlert } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useSyncStatus } from "@/lib/sync";
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
  const conflicts = useLiveQuery(() => db().notes.filter((n) => !!n.conflictOf && !n.deletedAt).count(), []) ?? 0;
  const s = conflicts ? "conflict" : !user || !settings.syncEnabled ? "local" : state;

  const cfg = {
    local: { icon: HardDrive, label: "Local only", color: "var(--status-local)", tip: "Saved in this browser. Sign in to sync across devices." },
    synced: { icon: CloudCheck, label: "Synced", color: "var(--status-synced)", tip: lastSyncedAt ? `Last synced ${new Date(lastSyncedAt).toLocaleTimeString()}` : "Synced" },
    syncing: { icon: RefreshCw, label: "Syncing", color: "var(--status-syncing)", tip: "Saving to your account…" },
    offline: { icon: CloudOff, label: "Offline", color: "var(--status-offline)", tip: "Offline. Changes are saved here and will sync later." },
    error: { icon: CloudOff, label: "Sync paused", color: "var(--status-offline)", tip: "Couldn't reach the server. Changes are safe on this device." },
    conflict: { icon: TriangleAlert, label: "Needs review", color: "var(--status-conflict)", tip: `${conflicts} note${conflicts === 1 ? " was" : "s were"} changed on two devices. Click to review.` },
  }[s];
  const Icon = cfg.icon;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          role={s === "conflict" ? "button" : "status"}
          aria-live="polite"
          tabIndex={0}
          onClick={() => s === "conflict" && useUI.getState().setConflictsOpen(true)}
          onKeyDown={(e) => s === "conflict" && (e.key === "Enter" || e.key === " ") && (e.preventDefault(), useUI.getState().setConflictsOpen(true))}
          className="mr-1 inline-flex h-7 cursor-default data-[c=true]:cursor-pointer items-center gap-1.5 rounded-full px-2.5 text-[13px] font-medium"
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
  );
}
