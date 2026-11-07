"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { listSnapshots, saveNote, takeSnapshot, type Snapshot } from "@/lib/db";
import { schedulePush } from "@/lib/sync";
import { cloneNote } from "@/lib/tree";
import { useEditor } from "@/store/editor-store";
import type { MindNode, Note } from "@/lib/types";

const fmt = (t: number) =>
  new Date(t).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

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
    // Only reload the list when the dialog opens or the note changes.
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
    toast(`Restored the version from ${fmt(snap.at)}`, { action: { label: "Undo", onClick: () => useEditor.getState().undo() } });
  };

  const restoreCopy = async () => {
    if (!snap || !note) return;
    const copy = cloneNote(asNote(snap), `${snap.title} (${fmt(snap.at)})`);
    await saveNote(copy);
    schedulePush();
    onOpenChange(false);
    onOpenNote(copy.id);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="size-4" /> Version history
          </DialogTitle>
          <DialogDescription>The last 20 versions of this note, saved on this device as you edit and before AI changes.</DialogDescription>
        </DialogHeader>
        {!snaps ? null : snaps.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No earlier versions yet. Versions are saved every few minutes while you edit.</p>
        ) : (
          <div className="grid max-h-[60vh] gap-3 sm:grid-cols-[220px_1fr]">
            <ul className="space-y-0.5 overflow-auto" role="listbox" aria-label="Versions">
              {snaps.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={s.id === sel}
                    onClick={() => setSel(s.id!)}
                    className={cn("w-full rounded-lg px-2.5 py-2 text-left hover:bg-accent", s.id === sel && "bg-accent text-accent-foreground")}
                  >
                    <span className="block text-sm font-medium">{fmt(s.at)}</span>
                    <span className="block text-xs text-muted-foreground">
                      {s.reason} · {s.nodeCount} nodes
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            <div className="flex min-h-0 flex-col rounded-xl border">
              <div className="min-h-0 flex-1 overflow-auto p-4 text-sm">
                {snap && note && (
                  <DiffPreview snapshot={asNote(snap)} current={note} />
                )}
              </div>
              <div className="flex justify-end gap-2 border-t p-2">
                <Button variant="ghost" size="sm" onClick={restoreCopy} disabled={!snap}>
                  Restore as copy
                </Button>
                <Button size="sm" onClick={restore} disabled={!snap}>
                  Restore this version
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

type DiffStatus = "unchanged" | "added" | "removed" | "changed";

interface DiffLine {
  text: string;
  depth: number;
  status: DiffStatus;
  oldText?: string; // for "changed" nodes, the previous text
}

/** Walk a node tree depth-first and collect {id, text, depth}. */
function walkNodes(nodes: Note["nodes"], rootId: string, depth = 0, out: { id: string; text: string; depth: number }[] = []) {
  const n = nodes[rootId];
  if (!n) return out;
  out.push({ id: n.id, text: n.text, depth });
  for (const cid of n.children) walkNodes(nodes, cid, depth + 1, out);
  return out;
}

/** Build a diff between a snapshot and the current note. */
function buildDiff(snapshot: Note, current: Note): DiffLine[] {
  const snapNodes = snapshot.nodes;
  const curNodes = current.nodes;

  // Walk both trees
  const snapItems = walkNodes(snapNodes, snapshot.rootId);
  const curItems = walkNodes(curNodes, current.rootId);

  const curById = new Map<string, MindNode>();
  for (const n of Object.values(curNodes)) curById.set(n.id, n);

  const snapById = new Map<string, MindNode>();
  for (const n of Object.values(snapNodes)) snapById.set(n.id, n);

  const lines: DiffLine[] = [];
  const seen = new Set<string>();

  // Walk through snapshot nodes — they form the "old" baseline
  for (const item of snapItems) {
    seen.add(item.id);
    const cur = curById.get(item.id);
    if (!cur) {
      // Node was in snapshot but not in current → it was removed since that version
      lines.push({ text: item.text, depth: item.depth, status: "removed" });
    } else if (cur.text !== item.text) {
      lines.push({ text: cur.text, depth: item.depth, status: "changed", oldText: item.text });
    } else {
      lines.push({ text: item.text, depth: item.depth, status: "unchanged" });
    }
  }

  // Walk current nodes for ones not in snapshot → added since that version
  for (const item of curItems) {
    if (!seen.has(item.id)) {
      lines.push({ text: item.text, depth: item.depth, status: "added" });
    }
  }

  return lines;
}

const statusStyles: Record<DiffStatus, string> = {
  unchanged: "",
  added: "bg-green-500/15 text-green-700 dark:text-green-400",
  removed: "bg-red-500/15 text-red-700 dark:text-red-400 line-through",
  changed: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
};

const statusPrefix: Record<DiffStatus, string> = {
  unchanged: "",
  added: "+ ",
  removed: "− ",
  changed: "~ ",
};

function DiffPreview({ snapshot, current }: { snapshot: Note; current: Note }) {
  const lines = buildDiff(snapshot, current);
  const hasChanges = lines.some((l) => l.status !== "unchanged");

  return (
    <div>
      {hasChanges && (
        <div className="mb-3 flex gap-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1"><span className="inline-block size-2.5 rounded-sm bg-green-500/30" /> Added</span>
          <span className="inline-flex items-center gap-1"><span className="inline-block size-2.5 rounded-sm bg-red-500/30" /> Removed</span>
          <span className="inline-flex items-center gap-1"><span className="inline-block size-2.5 rounded-sm bg-amber-500/30" /> Changed</span>
        </div>
      )}
      <ul className="space-y-0.5">
        {lines.map((l, i) => (
          <li
            key={i}
            style={{ paddingLeft: l.depth * 16 }}
            className={cn("rounded px-1.5 py-0.5", statusStyles[l.status])}
          >
            <span className="font-mono text-xs opacity-60">{statusPrefix[l.status]}</span>
            {l.text || <span className="text-muted-foreground italic">Untitled</span>}
            {l.status === "changed" && l.oldText != null && (
              <span className="ml-2 text-xs text-muted-foreground line-through">{l.oldText}</span>
            )}
          </li>
        ))}
      </ul>
      {!hasChanges && <p className="py-4 text-center text-xs text-muted-foreground">This version is identical to the current note.</p>}
    </div>
  );
}
