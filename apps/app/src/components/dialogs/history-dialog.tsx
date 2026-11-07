"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { GitCommitVertical, History, RotateCcw, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { listSnapshots, saveNote, takeSnapshot, type Snapshot } from "@/lib/db";
import { cloneNote } from "@/lib/tree";
import { useEditor } from "@/store/editor-store";
import type { MindNode, Note } from "@/lib/types";

const fmtFull = (t: number) =>
  new Date(t).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

const fmtRelative = (t: number) => {
  const s = (Date.now() - t) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 172800) return "yesterday";
  return new Date(t).toLocaleDateString(undefined, { day: "numeric", month: "short" });
};

/** Short hash-like identifier from snapshot id. */
const shortHash = (id: number) => id.toString(36).slice(-7).padStart(7, "0");

export function HistoryDialog({ open, onOpenChange, onOpenNote }: { open: boolean; onOpenChange: (o: boolean) => void; onOpenNote: (id: string) => void }) {
  const note = useEditor((s) => s.note);
  const [snaps, setSnaps] = useState<Snapshot[] | null>(null);
  const [sel, setSel] = useState<number | null>(null);

  useEffect(() => {
    if (!open || !note) return;
    let alive = true;
    void listSnapshots(note.id).then((l) => {
      if (!alive) return;
      setSnaps(l);
      setSel(l[0]?.id ?? null);
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, note?.id]);

  const snap = snaps?.find((s) => s.id === sel) ?? null;
  const asNote = (s: Snapshot): Note => ({ ...note!, title: s.title, rootId: s.rootId, nodes: s.nodes });

  const restore = async () => {
    if (!snap || !note) return;
    await takeSnapshot(note, "Before restoring a version");
    useEditor.getState().apply((d) => {
      d.rootId = snap.rootId;
      d.nodes = snap.nodes as typeof d.nodes;
    });
    useEditor.getState().requestFit();
    onOpenChange(false);
    toast(`Restored the version from ${fmtFull(snap.at)}`, { action: { label: "Undo", onClick: () => useEditor.getState().undo() } });
  };

  const restoreCopy = async () => {
    if (!snap || !note) return;
    const copy = cloneNote(asNote(snap), `${snap.title} (${fmtFull(snap.at)})`);
    await saveNote(copy);
    onOpenChange(false);
    onOpenNote(copy.id);
  };

  const diffStats = snap && note ? getDiffStats(asNote(snap), note) : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="size-4" /> Version history
          </DialogTitle>
          <DialogDescription>Local snapshots saved as you edit — click any version to see what changed.</DialogDescription>
        </DialogHeader>
        {!snaps ? null : snaps.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No earlier versions yet. Versions are saved every few minutes while you edit.</p>
        ) : (
          <div className="grid max-h-[60vh] gap-4 sm:grid-cols-[240px_1fr]">
            {/* ── Timeline (left) ─────────────────────────────── */}
            <div className="min-h-0 overflow-auto" role="listbox" aria-label="Versions">
              <ol className="relative ml-3 border-l border-border">
                {snaps.map((s, i) => {
                  const selected = s.id === sel;
                  return (
                    <li key={s.id} className="relative">
                      {/* Commit dot on the timeline */}
                      <span className={cn(
                        "absolute -left-[9px] top-3.5 grid size-[18px] place-items-center rounded-full border-2 border-background",
                        selected ? "bg-primary" : "bg-muted-foreground/40",
                      )}>
                        <GitCommitVertical className="size-2.5 text-primary-foreground" style={{ opacity: selected ? 1 : 0 }} />
                      </span>
                      <button
                        type="button"
                        role="option"
                        aria-selected={selected}
                        onClick={() => setSel(s.id!)}
                        className={cn(
                          "ml-4 w-full rounded-lg px-3 py-2 text-left transition-colors hover:bg-accent",
                          selected && "bg-accent text-accent-foreground",
                        )}
                      >
                        <span className="flex items-baseline justify-between gap-2">
                          <span className="text-sm font-semibold">{s.reason}</span>
                          <span className="shrink-0 text-[11px] text-muted-foreground tabular-nums">{fmtRelative(s.at)}</span>
                        </span>
                        <span className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                          <code className="rounded bg-muted px-1 py-px font-mono text-[10px]">{shortHash(s.id!)}</code>
                          <span>{s.nodeCount} nodes</span>
                          {i === 0 && <span className="rounded-full bg-primary/15 px-1.5 py-px text-[10px] font-medium text-primary">latest</span>}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ol>
            </div>

            {/* ── Diff panel (right) ──────────────────────────── */}
            <div className="flex min-h-0 flex-col rounded-xl border">
              {/* Diff header */}
              {snap && (
                <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
                  <div className="flex items-center gap-2 text-sm">
                    <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">{shortHash(snap.id!)}</code>
                    <span className="text-muted-foreground">{fmtFull(snap.at)}</span>
                  </div>
                  {diffStats && (
                    <div className="flex items-center gap-2.5 text-xs font-medium tabular-nums">
                      {diffStats.added > 0 && <span className="text-green-600 dark:text-green-400">+{diffStats.added}</span>}
                      {diffStats.removed > 0 && <span className="text-red-600 dark:text-red-400">−{diffStats.removed}</span>}
                      {diffStats.changed > 0 && <span className="text-amber-600 dark:text-amber-400">~{diffStats.changed}</span>}
                      {diffStats.added === 0 && diffStats.removed === 0 && diffStats.changed === 0 && (
                        <span className="text-muted-foreground">no changes</span>
                      )}
                    </div>
                  )}
                </div>
              )}
              {/* Diff body */}
              <div className="min-h-0 flex-1 overflow-auto font-mono text-[13px] leading-[22px]">
                {snap && note && (
                  <DiffPreview snapshot={asNote(snap)} current={note} />
                )}
              </div>
              {/* Actions */}
              <div className="flex justify-end gap-2 border-t px-3 py-2">
                <Button variant="ghost" size="sm" onClick={restoreCopy} disabled={!snap} className="gap-1.5">
                  <Copy className="size-3.5" /> Restore as copy
                </Button>
                <Button size="sm" onClick={restore} disabled={!snap} className="gap-1.5">
                  <RotateCcw className="size-3.5" /> Restore
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ── Diff engine ──────────────────────────────────────────────────────────────

type DiffStatus = "unchanged" | "added" | "removed" | "changed";

interface DiffLine {
  text: string;
  depth: number;
  status: DiffStatus;
  oldText?: string;
}

function walkNodes(nodes: Note["nodes"], rootId: string, depth = 0, out: { id: string; text: string; depth: number }[] = []) {
  const n = nodes[rootId];
  if (!n) return out;
  out.push({ id: n.id, text: n.text, depth });
  for (const cid of n.children) walkNodes(nodes, cid, depth + 1, out);
  return out;
}

function buildDiff(snapshot: Note, current: Note): DiffLine[] {
  const snapItems = walkNodes(snapshot.nodes, snapshot.rootId);
  const curItems = walkNodes(current.nodes, current.rootId);

  const curById = new Map<string, MindNode>();
  for (const n of Object.values(current.nodes)) curById.set(n.id, n);

  const lines: DiffLine[] = [];
  const seen = new Set<string>();

  for (const item of snapItems) {
    seen.add(item.id);
    const cur = curById.get(item.id);
    if (!cur) {
      lines.push({ text: item.text, depth: item.depth, status: "removed" });
    } else if (cur.text !== item.text) {
      lines.push({ text: cur.text, depth: item.depth, status: "changed", oldText: item.text });
    } else {
      lines.push({ text: item.text, depth: item.depth, status: "unchanged" });
    }
  }

  for (const item of curItems) {
    if (!seen.has(item.id)) {
      lines.push({ text: item.text, depth: item.depth, status: "added" });
    }
  }

  return lines;
}

function getDiffStats(snapshot: Note, current: Note) {
  const lines = buildDiff(snapshot, current);
  return {
    added: lines.filter((l) => l.status === "added").length,
    removed: lines.filter((l) => l.status === "removed").length,
    changed: lines.filter((l) => l.status === "changed").length,
  };
}

const lineColors: Record<DiffStatus, string> = {
  unchanged: "",
  added: "bg-green-500/10 border-l-green-500",
  removed: "bg-red-500/10 border-l-red-500",
  changed: "bg-amber-500/10 border-l-amber-500",
};

const lineTextColors: Record<DiffStatus, string> = {
  unchanged: "text-foreground",
  added: "text-green-700 dark:text-green-400",
  removed: "text-red-700 dark:text-red-400 line-through",
  changed: "text-amber-700 dark:text-amber-400",
};

const linePrefix: Record<DiffStatus, string> = {
  unchanged: " ",
  added: "+",
  removed: "−",
  changed: "~",
};

function DiffPreview({ snapshot, current }: { snapshot: Note; current: Note }) {
  const lines = buildDiff(snapshot, current);
  const hasChanges = lines.some((l) => l.status !== "unchanged");

  return (
    <div>
      <table className="w-full border-collapse">
        <tbody>
          {lines.map((l, i) => (
            <tr key={i} className={cn("border-l-2 border-l-transparent", lineColors[l.status])}>
              {/* Line number */}
              <td className="w-8 select-none px-2 text-right text-[11px] text-muted-foreground/50 align-top">{i + 1}</td>
              {/* Prefix */}
              <td className={cn("w-4 select-none text-center align-top", lineTextColors[l.status])}>
                {linePrefix[l.status]}
              </td>
              {/* Content */}
              <td className={cn("px-2 py-px", lineTextColors[l.status])} style={{ paddingLeft: l.depth * 16 + 8 }}>
                {l.text || <span className="italic opacity-40">empty</span>}
                {l.status === "changed" && l.oldText != null && (
                  <span className="ml-2 text-[11px] text-muted-foreground line-through opacity-60">{l.oldText}</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!hasChanges && <p className="py-6 text-center text-xs text-muted-foreground font-sans">This version is identical to the current note.</p>}
    </div>
  );
}
